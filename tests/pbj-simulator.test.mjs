import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PBJ_SCENARIO,
  DEFAULT_PBJ_TRAVEL,
  calculateTravelPolicy,
  calculatePbjScenario,
} from '../src/lib/pbjSimulator.ts';
import { readFileSync } from 'node:fs';

test('PBJ quotation 600万円, approved cap 500万円 and excess 100万円 are distinct', () => {
  const output = calculateTravelPolicy(DEFAULT_PBJ_TRAVEL);
  assert.equal(output.approvedMan, 500);
  assert.equal(output.pendingMan, 100);
  assert.equal(output.allowanceYen, 40000);
  assert.equal(output.plannedCompanyCashMan, 504);
});

test('approval ceiling does not fabricate a difference if quote fits budget', () => {
  const output = calculateTravelPolicy({ ...DEFAULT_PBJ_TRAVEL, quoteMan: 400, approvedCapMan: 500 });
  assert.equal(output.approvedMan, 400);
  assert.equal(output.pendingMan, 0);
});

test('owner internal ACE revenue is eliminated in group cash position', () => {
  const output = calculatePbjScenario(DEFAULT_PBJ_SCENARIO);
  assert.equal(output.totalHours, 230);
  assert.equal(output.externalRevenueMan, 20000);
  assert.equal(output.aceInternalRevenueMan, 3000);
  assert.equal(output.variableCostMan, 11500);
  assert.equal(output.interestMan, 2800);
  assert.equal(output.ownerCashMan, 700);
  assert.equal(output.groupCashMan, -2300);
  assert.equal(output.ownerAccountingMan, -19300);
  assert.equal(output.initialEquityMan, 30000);
  assert.equal(output.ownerBreakEvenHours, 186);
  assert.equal(output.groupBreakEvenHours, 246);
});

test('scenarios with no contribution margin cannot claim break-even', () => {
  const output = calculatePbjScenario({ ...DEFAULT_PBJ_SCENARIO, externalRateMan: 40 });
  assert.equal(output.ownerBreakEvenHours, null);
  assert.equal(output.groupBreakEvenHours, null);
});

test('invalid and negative quantities do not manufacture artificial benefit', () => {
  const travel = calculateTravelPolicy({ quoteMan: -60, approvedCapMan: Number.NaN, dailyAllowanceYen: -100, allowanceDays: 5 });
  assert.equal(travel.approvedMan, 0);
  assert.equal(travel.pendingMan, 0);
  assert.equal(travel.allowanceYen, 0);
  const sim = calculatePbjScenario({ ...DEFAULT_PBJ_SCENARIO, externalHours: -10, purchasePriceMan: -1 });
  assert.equal(sim.totalHours, 30);
  assert.equal(sim.initialEquityMan, 0);
});

test('Web dashboard links to embedded PBJ rather than substituting a Drive-only view', () => {
  const page = readFileSync(new URL('../src/pages/dashboard/investment.astro', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../src/layouts/DashboardLayout.astro', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../src/components/dashboard/PbjAssetSimulator.tsx', import.meta.url), 'utf8');
  assert.match(page, /<PbjAssetSimulator client:only="react" \/>/);
  assert.match(layout, /\/dashboard\/investment#pbj-simulator/);
  assert.match(component, /id="pbj-simulator"/);
  assert.match(component, /超過額・追加承認待ち/);
  assert.match(component, /個人の負担になるわけでもありません/);
});
