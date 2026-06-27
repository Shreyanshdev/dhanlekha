import { describe, it, expect } from 'vitest';
import {
  roundPaise,
  percentageOf,
  lineAmount,
  toRupees,
  toPaise,
} from '../src/utils/money';

describe('money: roundPaise', () => {
  it('leaves whole paise untouched', () => {
    expect(roundPaise(0)).toBe(0);
    expect(roundPaise(100)).toBe(100);
    expect(roundPaise(99900)).toBe(99900);
  });

  it('rounds fractional paise to the nearest whole paise (half-up)', () => {
    expect(roundPaise(10.4)).toBe(10);
    expect(roundPaise(10.5)).toBe(11);
    expect(roundPaise(10.49)).toBe(10);
    expect(roundPaise(10.51)).toBe(11);
  });

  it('handles negative amounts (credits/reversals)', () => {
    // Math.round rounds half toward +Infinity, so -10.5 → -10.
    expect(roundPaise(-10.5)).toBe(-10);
    expect(roundPaise(-10.6)).toBe(-11);
    expect(roundPaise(-100)).toBe(-100);
  });
});

describe('money: percentageOf', () => {
  it('computes GST on the canonical example', () => {
    // 18% GST on ₹999.00 (99900 paise) → ₹179.82 (17982 paise).
    expect(percentageOf(99900, 18)).toBe(17982);
  });

  it('rounds the result to whole paise', () => {
    // 2.5% of 12345 = 308.625 → 309.
    expect(percentageOf(12345, 2.5)).toBe(309);
    // 10% of 20000 = 2000 exactly.
    expect(percentageOf(20000, 10)).toBe(2000);
  });

  it('returns 0 for 0% or a 0 base', () => {
    expect(percentageOf(50000, 0)).toBe(0);
    expect(percentageOf(0, 18)).toBe(0);
  });

  it('handles 100%', () => {
    expect(percentageOf(54321, 100)).toBe(54321);
  });

  it('never produces a fractional paise across a sweep of rates', () => {
    for (let rate = 0; rate <= 28; rate += 0.5) {
      const result = percentageOf(73331, rate);
      expect(Number.isInteger(result)).toBe(true);
    }
  });
});

describe('money: lineAmount', () => {
  it('multiplies price by quantity', () => {
    expect(lineAmount(10000, 3)).toBe(30000);
    expect(lineAmount(0, 5)).toBe(0);
    expect(lineAmount(12345, 1)).toBe(12345);
  });

  it('rounds fractional quantities to whole paise', () => {
    // 999 paise * 2.5 = 2497.5 → 2498.
    expect(lineAmount(999, 2.5)).toBe(2498);
    // 333 paise * 3 = 999 (no rounding needed).
    expect(lineAmount(333, 3)).toBe(999);
  });
});

describe('money: rupee <-> paise conversion', () => {
  it('toPaise converts rupees to integer paise', () => {
    expect(toPaise(999)).toBe(99900);
    expect(toPaise(0.01)).toBe(1);
    expect(toPaise(12.34)).toBe(1234);
    // Documents the IEEE-754 reality: 1.005 * 100 === 100.4999…, so it rounds
    // down to 100. This is exactly why rupee floats must only be used at the
    // input boundary and never for storage/arithmetic.
    expect(toPaise(1.005)).toBe(100);
  });

  it('toRupees converts paise to rupees for display', () => {
    expect(toRupees(99900)).toBe(999);
    expect(toRupees(1)).toBe(0.01);
    expect(toRupees(0)).toBe(0);
  });

  it('round-trips an integer-rupee value losslessly', () => {
    for (const rupees of [1, 50, 999, 2499, 100000]) {
      expect(toRupees(toPaise(rupees))).toBe(rupees);
    }
  });
});
