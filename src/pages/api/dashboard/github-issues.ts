import { env as workerEnv } from 'cloudflare:workers';
import type { APIContext } from 'astro';
import {
  ISSUE_REPOS, normalizeIssue, normalizePull, normalizeRun, summarizeRepo,
} from '../../../lib/githubIssueFeed.mjs';
import { jsonResponse } from '../../../lib/security/request.mjs';

type FeedItem = Record<string, any>;
type RepoResult = {
  repo: string;
  label: string;
  access: 'connected' | 'needs_token' | 'unavailable' | 'partial';
  issues: FeedItem[];
  pulls: FeedItem[];
  recentRun: FeedItem | null;
  summary: { shownOpenIssues: number; shownOpenPRs: number; shownHumanGates: number } | null;
  fetchedAt: string | null;
  truncated: { issues: boolean; pulls: boolean };
};

let snapshot: { expires: number; hasToken: boolean; repos: RepoResult[] } | null = null;
const CACHE_MS = 300_000;
const REQUEST_TIMEOUT_MS = 7000;

// Repositories and routes are server-selected; no arbitrary URL or owner input from the browser.
async function githubGet(repo: string, route: string, token: string): Promise<any> {
  const url = 'https://api.github.com/repos/' + repo + '/' + route;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'MASA-Dashboard-GitHub-ReadOnly',
  };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error('github_' + response.status);
  return response.json();
}

async function readRepo(config: (typeof ISSUE_REPOS)[number], token: string): Promise<RepoResult> {
  const base: RepoResult = {
    repo: config.slug,
    label: config.label,
    access: 'unavailable',
    issues: [],
    pulls: [],
    recentRun: null,
    summary: null,
    fetchedAt: null,
    truncated: { issues: false, pulls: false },
  };
  if (config.private && !token) {
    return { ...base, access: 'needs_token' };
  }
  const [issuesResult, pullsResult, runsResult] = await Promise.allSettled([
    githubGet(config.slug, 'issues?state=all&sort=updated&direction=desc&per_page=100', token),
    githubGet(config.slug, 'pulls?state=open&sort=updated&direction=desc&per_page=60', token),
    githubGet(config.slug, 'actions/runs?per_page=40', token),
  ]);

  const rawIssues = issuesResult.status === 'fulfilled' && Array.isArray(issuesResult.value)
    ? issuesResult.value : null;
  const rawPulls = pullsResult.status === 'fulfilled' && Array.isArray(pullsResult.value)
    ? pullsResult.value : null;
  const rawRuns = runsResult.status === 'fulfilled' && Array.isArray(runsResult.value?.workflow_runs)
    ? runsResult.value.workflow_runs : null;
  const successfulSections = [rawIssues, rawPulls, rawRuns].filter((item) => item !== null).length;
  if (!successfulSections) return base;

  const nonNull = <T>(item: T | null): item is T => item !== null;
  const issues = (rawIssues || []).map((item: any) => normalizeIssue(item, config.slug)).filter(nonNull);
  const runs = (rawRuns || []).map((item: any) => normalizeRun(item, config.slug)).filter(nonNull);
  const pulls = (rawPulls || []).map((item: any) => normalizePull(item, config.slug, runs)).filter(nonNull);
  return {
    ...base,
    access: successfulSections === 3 ? 'connected' : 'partial',
    issues,
    pulls,
    recentRun: runs[0] || null,
    summary: rawIssues && rawPulls ? summarizeRepo(issues, pulls) : null,
    fetchedAt: new Date().toISOString(),
    truncated: { issues: (rawIssues?.length || 0) === 100, pulls: (rawPulls?.length || 0) === 60 },
  };
}

export const GET = async (_context: APIContext) => {
  // Authentication and same-origin/private-cache headers come from src/middleware.ts.
  // This handler never returns an access token, raw GitHub body, or private issue text.
  const env = workerEnv as unknown as { GITHUB_ISSUES_READ_TOKEN?: string };
  const token = typeof env.GITHUB_ISSUES_READ_TOKEN === 'string'
    ? env.GITHUB_ISSUES_READ_TOKEN.trim() : '';
  const now = Date.now();
  if (snapshot && snapshot.hasToken === Boolean(token) && now < snapshot.expires) {
    return jsonResponse({ ok: true, repos: snapshot.repos, cache: 'short-lived' });
  }
  try {
    const repos = await Promise.all(ISSUE_REPOS.map((config) => readRepo(config, token)));
    snapshot = { expires: Date.now() + CACHE_MS, hasToken: Boolean(token), repos };
    return jsonResponse({ ok: true, repos, cache: 'fresh' });
  } catch {
    return jsonResponse({ ok: false, error: 'github_feed_unavailable' }, 503);
  }
};
