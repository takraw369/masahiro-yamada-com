import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fromRepo = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Opportunity Radar reuses the single curated data module', () => {
  const data = fromRepo('src/data/designOpportunities.ts');
  const cockpit = fromRepo('src/components/dashboard/DashboardCockpit.tsx');
  const studio = fromRepo('src/components/dashboard/DesignOpportunityPanel.astro');
  assert.match(data, /TRG-VISUAL-EDIT-001/);
  assert.match(data, /CHANGE → LOCK → VERIFY/);
  assert.match(data, /\.slice\(0, 5\)/);
  assert.match(cockpit, /activeDesignOpportunities/);
  assert.match(studio, /activeDesignOpportunities/);
});

test('Existing cockpit layouts migrate with new opportunity widget and preserve owner gates', () => {
  const cockpit = fromRepo('src/components/dashboard/DashboardCockpit.tsx');
  assert.match(cockpit, /id:'opportunity'/);
  assert.match(cockpit, /for \(const id of widgetIds\) if \(!order\.includes\(id\)\) order\.push\(id\)/);
  assert.match(cockpit, /Drive正本の手動スナップショット/);
  assert.match(cockpit, /\/dashboard\/design-templates#design-opportunities/);
  const studioPage = fromRepo('src/pages/dashboard/design-templates.astro');
  assert.match(studioPage, /<DesignOpportunityPanel \/>/);
  assert.match(studioPage, /<DesignSourceAtlas \/>/);
});

test('Opportunity is an experiment invitation, not silent production activation', () => {
  const data = fromRepo('src/data/designOpportunities.ts');
  assert.match(data, /status: 'TRY'/);
  assert.match(data, /canonicalUrl/);
  assert.match(data, /sourceUrl/);
  assert.doesNotMatch(data, /apiKey|secret|token/i);
});
