/**
 * PBJ strategy sandbox: hypothetical values only, not a quote or tax determination.
 * Units: 万円 unless explicitly called Yen. No persistence or external effects.
 */
export type PbjScenario = {
  purchasePriceMan: number;
  depreciationYears: number;
  fixedAnnualMan: number;
  variablePerHourMan: number;
  externalRateMan: number;
  externalHours: number;
  aceHours: number;
  aceRateMan: number;
  personalHours: number;
  personalRateMan: number;
  debtPct: number;
  interestPct: number;
};

export type PbjTravelPolicy = {
  quoteMan: number;
  approvedCapMan: number;
  dailyAllowanceYen: number;
  allowanceDays: number;
};

export const DEFAULT_PBJ_SCENARIO: PbjScenario = {
  purchasePriceMan: 100000,
  depreciationYears: 5,
  fixedAnnualMan: 8000,
  variablePerHourMan: 50,
  externalRateMan: 100,
  externalHours: 200,
  aceHours: 30,
  aceRateMan: 100,
  personalHours: 0,
  personalRateMan: 100,
  debtPct: 70,
  interestPct: 4,
};

export const DEFAULT_PBJ_TRAVEL: PbjTravelPolicy = {
  quoteMan: 600,
  approvedCapMan: 500,
  dailyAllowanceYen: 10000,
  allowanceDays: 4,
};

const nonNegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export function calculateTravelPolicy(raw: PbjTravelPolicy) {
  const quoteMan = nonNegative(raw.quoteMan);
  const approvedCapMan = nonNegative(raw.approvedCapMan);
  const approvedMan = Math.min(quoteMan, approvedCapMan);
  const pendingMan = Math.max(0, quoteMan - approvedMan);
  const allowanceYen = nonNegative(raw.dailyAllowanceYen) * nonNegative(raw.allowanceDays);
  return {
    approvedMan,
    pendingMan,
    allowanceYen,
    plannedCompanyCashMan: approvedMan + allowanceYen / 10000,
  };
}

export function calculatePbjScenario(raw: PbjScenario) {
  const purchasePriceMan = nonNegative(raw.purchasePriceMan);
  const fixedAnnualMan = nonNegative(raw.fixedAnnualMan);
  const variablePerHourMan = nonNegative(raw.variablePerHourMan);
  const externalRateMan = nonNegative(raw.externalRateMan);
  const externalHours = nonNegative(raw.externalHours);
  const aceHours = nonNegative(raw.aceHours);
  const aceRateMan = nonNegative(raw.aceRateMan);
  const personalHours = nonNegative(raw.personalHours);
  const personalRateMan = nonNegative(raw.personalRateMan);
  const debtPct = Math.min(100, nonNegative(raw.debtPct));
  const interestPct = nonNegative(raw.interestPct);
  const totalHours = externalHours + aceHours + personalHours;
  const externalRevenueMan = externalHours * externalRateMan;
  const aceInternalRevenueMan = aceHours * aceRateMan;
  const personalRevenueMan = personalHours * personalRateMan;
  const variableCostMan = totalHours * variablePerHourMan;
  const interestMan = purchasePriceMan * debtPct / 100 * interestPct / 100;
  const depreciationMan = purchasePriceMan / Math.max(1, nonNegative(raw.depreciationYears));
  const ownerCashMan =
    externalRevenueMan + aceInternalRevenueMan + personalRevenueMan -
    variableCostMan - fixedAnnualMan - interestMan;
  // ACE payment is revenue in the owner entity but an internal transfer for the company group.
  const groupCashMan = ownerCashMan - aceInternalRevenueMan;
  const ownerAccountingMan = ownerCashMan - depreciationMan;
  const externalMarginPerHourMan = externalRateMan - variablePerHourMan;
  // Includes interest and owner-use variable costs; excludes principal, tax and sale proceeds.
  const ownerBreakEvenHours = externalMarginPerHourMan > 0
    ? Math.max(0, (fixedAnnualMan + interestMan + (aceHours + personalHours) * variablePerHourMan - aceInternalRevenueMan - personalRevenueMan) / externalMarginPerHourMan)
    : null;
  const groupBreakEvenHours = externalMarginPerHourMan > 0
    ? Math.max(0, (fixedAnnualMan + interestMan + (aceHours + personalHours) * variablePerHourMan - personalRevenueMan) / externalMarginPerHourMan)
    : null;
  return {
    totalHours,
    externalRevenueMan,
    aceInternalRevenueMan,
    personalRevenueMan,
    variableCostMan,
    fixedAnnualMan,
    interestMan,
    depreciationMan,
    ownerCashMan,
    groupCashMan,
    ownerAccountingMan,
    ownerBreakEvenHours,
    groupBreakEvenHours,
    initialEquityMan: purchasePriceMan * (100 - debtPct) / 100,
  };
}
