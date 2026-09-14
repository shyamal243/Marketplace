import { describe, it, expect } from "vitest";

function calculateGstAmount(amount: number, ratePercent: number): number {
  return Math.round((amount * ratePercent) / (100 + ratePercent));
}

function calculateCommission(amount: number, commissionPercent: number): number {
  return Math.round((amount * commissionPercent) / 100);
}

describe("GST calculation (tax-inclusive)", () => {
  it("returns 0 when rate is 0", () => {
    expect(calculateGstAmount(1000, 0)).toBe(0);
  });

  it("correctly extracts 18% GST from a tax-inclusive amount", () => {
    expect(calculateGstAmount(1000, 18)).toBe(153);
  });

  it("correctly extracts 5% GST from a tax-inclusive amount", () => {
    expect(calculateGstAmount(1050, 5)).toBe(50);
  });
});

describe("Commission calculation", () => {
  it("returns 0 when commission percent is 0", () => {
    expect(calculateCommission(1000, 0)).toBe(0);
  });

  it("correctly calculates a 5% commission", () => {
    expect(calculateCommission(2000, 5)).toBe(100);
  });

  it("correctly calculates a 10% commission with rounding", () => {
    expect(calculateCommission(999, 10)).toBe(100);
  });
});

describe("Email validation", () => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it("accepts a valid email", () => {
    expect(emailPattern.test("test@example.com")).toBe(true);
  });

  it("rejects an email with no @ symbol", () => {
    expect(emailPattern.test("notanemail.com")).toBe(false);
  });

  it("rejects an email with no domain", () => {
    expect(emailPattern.test("test@")).toBe(false);
  });

  it("rejects an email with spaces", () => {
    expect(emailPattern.test("test @example.com")).toBe(false);
  });
});
