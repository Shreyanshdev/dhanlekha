/**
 * Money convention — Sprint 17 "money representation audit" decision.
 *
 * The canonical monetary unit across the ERP is the **integer paise** (the
 * smallest Indian currency unit; ₹1 = 100 paise). This matches the majority of
 * the existing schema (products, payments, plans, ledger snapshots are already
 * stored in paise) and gives a single, exact unit for the upcoming double-entry
 * General Ledger (Sprint 18), where floating-point drift is unacceptable.
 *
 * RULES:
 *   1. Every monetary value stored or transmitted is an integer number of paise.
 *   2. All arithmetic that can produce a fraction of a paise (percentages,
 *      multi-quantity lines, proportional discounts) MUST be rounded back to a
 *      whole paise using the helpers below — never left as a float.
 *   3. Rupee values (e.g. for display) are derived only at the presentation
 *      edge via `toRupees`, never used for storage or further calculation.
 *
 * Some legacy columns are typed DECIMAL but hold paise-valued numbers; this is
 * harmless given the above rules. A non-destructive type-tightening migration
 * can align those column types later without changing any stored value.
 */

/** Round any (possibly fractional) paise amount to a whole paise. */
export function roundPaise(amount: number): number {
  return Math.round(amount);
}

/**
 * Apply a percentage rate to a paise base, rounding the result to whole paise.
 * Example: percentageOf(99900, 18) → 17982  (18% GST on ₹999.00).
 */
export function percentageOf(basePaise: number, ratePercent: number): number {
  return roundPaise((basePaise * ratePercent) / 100);
}

/** Multiply a unit price (paise) by a quantity, rounding to whole paise. */
export function lineAmount(unitPricePaise: number, quantity: number): number {
  return roundPaise(unitPricePaise * quantity);
}

/** Convert paise → rupees (presentation only). */
export function toRupees(paise: number): number {
  return paise / 100;
}

/** Convert rupees → integer paise (input boundary only). */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
