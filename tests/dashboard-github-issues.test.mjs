import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ISSUE_REPOS, issueLink, normalizeIssue, normalizePull, normalizeRun, summarizeRepo,
} from '../src/lib/githubIssueFeed.mjs';

const page = readFileSync(new URL('../src/pages/dashboard/github-issues.astro', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/pages/api/dashboard/github-issues.ts', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/layouts/DashboardLayout.astro', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');
const middleware = readFileSync(new URL('../src/middleware.ts', import.meta.url), 'utf8');

test('only the two approved repositories can generate outward links', () => {
  assert.deepEqual(ISSUE_REPOS.map((row) => row.slug), [
    'takraw369/masa-automation', 'takraw369/masahiro-yamada-com',
  ]);
  assert.equal(issueLink('attacker/evil', 222), '');
  assert.equal(issueLink('takraw369/masa-automation', -2), '');
  assert.equal(issueLink('takraw369/masa-automation', 222), 'https://github.com/takraw369/masa-automation/issues/222');
});

test('issues do not double count pull requests; explicit human gate labels only', () => {
  const issue = normalizeIssue({ number:222, title:'Ship business', state:'open', labels:[{name:'MASA_GATE'}],updated_at:'2026-10-12T00:00:00Z' }, ISSUE_REPOS[0].slug);
  assert.equal(issue.humanGate,true);
  assert.equal(issue.kind,'issue');
  assert.equal(issue.url,'https://github.com/takraw369/masa-automation/issues/222');
  assert.equal(normalizeIssue({number:299,pull_request:{url:'https://api.github.com/'},title:'PR'},ISSUE_REPOS[1].slug),null);
  assert.equal(normalizeIssue({number:215,labels:[],title:'Open'},ISSUE_REPOS[1].slug).humanGate,false);
});

test('CI belongs to PR only when SHA and CI workflow name both match', () => {
  const repo=ISSUE_REPOS[1].slug;
  const runs = [
    normalizeRun({id:42,name:'Deploy to Cloudflare Workers',head_sha:'abc',status:'completed',conclusion:'success'},repo),
    normalizeRun({id:43,name:'CI',head_sha:'unrelated',status:'completed',conclusion:'success'},repo),
    normalizeRun({id:44,name:'CI',head_sha:'abc',status:'completed',conclusion:'failure'},repo),
  ];
  const pr = normalizePull({number:300,title:'PR',state:'open',head:{sha:'abc'},labels:[]},repo,runs);
  assert.equal(pr.ci.conclusion,'failure');
  assert.equal(pr.ci.url,'https://github.com/takraw369/masahiro-yamada-com/actions/runs/44');
  assert.equal(normalizePull({number:300,head:{sha:'different'}},repo,runs).ci,null);
});

test('shown counts never silently include closed or draft as approval gate', () => {
  const repo=ISSUE_REPOS[1].slug;
  const issues=[
    normalizeIssue({number:1,state:'open',labels:[]},repo),
    normalizeIssue({number:2,state:'closed',labels:[{name:'human-gate'}]},repo),
  ];
  const pulls=[
    normalizePull({number:3,state:'open',draft:true,labels:[]},repo),
    normalizePull({number:4,state:'open',labels:[{name:'needs-approval'}]},repo),
  ];
  assert.deepEqual(summarizeRepo(issues,pulls),{shownOpenIssues:1,shownOpenPRs:2,shownHumanGates:1});
});

test('read-only API is protected and never sends a bearer secret to browser', () => {
  assert.match(middleware,/pathname\.startsWith\('\/api\/dashboard'\)/);
  assert.match(middleware,/verifyDashboardSession/);
  assert.match(api,/GITHUB_ISSUES_READ_TOKEN/);
  assert.match(api,/config\.private && !token/);
  assert.match(api,/return \{ \.\.\.base, access: 'needs_token' \}/);
  assert.match(api,/jsonResponse\(\{ ok: true, repos/);
  assert.doesNotMatch(page,/GITHUB_ISSUES_READ_TOKEN.*(fetch|Bearer)/);
  assert.doesNotMatch(api,/\bPOST\b|\bPUT\b|\bPATCH\b|CREATE TABLE/i);
});

test('new page is available from home and global navigation, with useful filters', () => {
  assert.match(home,/href:'\/dashboard\/github-issues'/);
  assert.match(layout,/href: '\/dashboard\/github-issues'/);
  for(const mode of ['open','prs','gates','closed']){
    assert.match(page,new RegExp('data-mode="'+mode+'"'));
  }
  assert.match(page,/\/api\/dashboard\/github-issues/);
  assert.match(page,/credentials:'same-origin'/);
  assert.match(page,/textContent/);
  assert.match(page,/noopener noreferrer/);
});
