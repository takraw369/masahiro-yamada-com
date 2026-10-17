// Dashboard-only read model of GitHub's real issues, PRs and CI.
export const ISSUE_REPOS = Object.freeze([
  { slug: 'takraw369/masa-automation', label: 'MASA Automation', private: true, ciWorkflow: 'Flow Runner CI' },
  { slug: 'takraw369/masahiro-yamada-com', label: 'MASA Website', private: false, ciWorkflow: 'CI' },
]);
const isHumanGate = (labels) => labels.some((label) =>
  /^(masa[-_ ]?gate|human[-_ ]?gate|needs[-_ ]?approval|approval[-_ ]?required|human[-_ ]?review)$/i.test(label));
const safeString = (value, max = 200) =>
  typeof value === 'string' ? value.slice(0, max) : '';
const safeDate = (value) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
export function issueLink(repo, number, kind = 'issues') {
  if (!ISSUE_REPOS.some((item) => item.slug === repo)) return '';
  if (!Number.isSafeInteger(number) || number < 1) return '';
  return 'https://github.com/' + repo + '/' + (kind === 'pull' ? 'pull' : 'issues') + '/' + number;
}
export function normalizeIssue(raw, repo) {
  if (!raw || raw.pull_request || !Number.isSafeInteger(raw.number)) return null;
  const labels = Array.isArray(raw.labels)
    ? raw.labels.map((item) => safeString(typeof item === 'string' ? item : item?.name, 56)).filter(Boolean).slice(0, 12)
    : [];
  return {
    kind: 'issue',
    repo,
    number: raw.number,
    title: safeString(raw.title, 320),
    state: raw.state === 'closed' ? 'closed' : 'open',
    labels,
    humanGate: isHumanGate(labels),
    updatedAt: safeDate(raw.updated_at),
    url: issueLink(repo, raw.number),
  };
}
export function normalizeRun(raw, repo) {
  if (!raw || !Number.isSafeInteger(raw.id)) return null;
  return {
    id: raw.id,
    name: safeString(raw.name, 80),
    status: raw.status === 'completed' ? 'completed' : (raw.status === 'queued' ? 'queued' : 'in_progress'),
    conclusion: ['success', 'failure', 'cancelled', 'skipped', 'timed_out'].includes(raw.conclusion) ? raw.conclusion : null,
    headSha: safeString(raw.head_sha, 44),
    branch: safeString(raw.head_branch, 130),
    url: 'https://github.com/' + repo + '/actions/runs/' + raw.id,
    updatedAt: safeDate(raw.updated_at),
  };
}
export function normalizePull(raw, repo, runs = []) {
  if (!raw || !Number.isSafeInteger(raw.number)) return null;
  const labels = Array.isArray(raw.labels)
    ? raw.labels.map((item) => safeString(typeof item === 'string' ? item : item?.name, 56)).filter(Boolean).slice(0, 12)
    : [];
  const headSha = safeString(raw.head?.sha, 44);
  // Never confuse "latest repo CI" with a PR's actual checks.
  const workflowName = ISSUE_REPOS.find((item) => item.slug === repo)?.ciWorkflow;
  const ci = runs.find((run) => run.name === workflowName && headSha && run.headSha === headSha) || null;
  return {
    kind: 'pr',
    repo,
    number: raw.number,
    title: safeString(raw.title, 320),
    state: raw.state === 'closed' ? 'closed' : 'open',
    draft: raw.draft === true,
    humanGate: isHumanGate(labels),
    labels,
    updatedAt: safeDate(raw.updated_at),
    url: issueLink(repo, raw.number, 'pull'),
    ci: ci ? { status: ci.status, conclusion: ci.conclusion, url: ci.url } : null,
  };
}
export function summarizeRepo(issues, pulls) {
  return {
    shownOpenIssues: issues.filter((issue) => issue.state === 'open').length,
    shownOpenPRs: pulls.filter((pr) => pr.state === 'open').length,
    shownHumanGates: [...issues, ...pulls].filter((item) => item.state === 'open' && item.humanGate).length,
  };
}
