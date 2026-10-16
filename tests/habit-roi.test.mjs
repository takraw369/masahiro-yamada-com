import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateHabitRoi, habitRoiPresets } from '../src/lib/habitRoi.ts';

test('smoking example: 600 yen daily, 20000 yen upfront', () => {
  const result = calculateHabitRoi(habitRoiPresets.smoke);
  assert.equal(result.annualGrossSavings, 219000);
  assert.equal(result.annualNetSavings, 219000);
  assert.equal(result.oneYearNet, 199000);
  assert.equal(result.tenYearNet, 2170000);
  assert.equal(result.breakEvenMonths, 1.1);
});

test('replacement purchase cost is deducted before reporting annual savings', () => {
  const result = calculateHabitRoi(habitRoiPresets.drink);
  assert.equal(result.annualNetSavings, 43800);
  assert.equal(result.tenYearNet, 436000);
});

test('negative savings do not have a break-even point', () => {
  const result = calculateHabitRoi({
    beforeYen: 0, afterYen: 100, occurrencesPerWeek: 7,
    initialYen: 5000, minutesBefore: 0, minutesAfter: 0,
  });
  assert.equal(result.annualNetSavings, -36500);
  assert.equal(result.breakEvenMonths, null);
  assert.equal(result.oneYearNet, -41500);
});

test('elapsed time is shown separately, not monetized', () => {
  const result = calculateHabitRoi({
    beforeYen: 100, afterYen: 100, occurrencesPerWeek: 7,
    initialYen: 0, minutesBefore: 20, minutesAfter: 10,
  });
  assert.equal(result.annualNetSavings, 0);
  assert.equal(result.annualHoursReclaimed, 60.8);
});

test('invalid or out-of-range values are bounded', () => {
  const result = calculateHabitRoi({
    beforeYen: NaN, afterYen: -100, occurrencesPerWeek: 99,
    initialYen: -1, minutesBefore: Infinity, minutesAfter: -1,
  });
  assert.equal(result.annualNetSavings, 0);
  assert.equal(result.annualHoursReclaimed, 0);
  assert.equal(result.breakEvenMonths, null);
});
