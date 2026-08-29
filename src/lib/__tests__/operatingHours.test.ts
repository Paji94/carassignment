import { describe, expect, it } from "vitest";
import { isOperatingHours } from "../operatingHours";

function jstDate(hour: number, minute: number): Date {
  // JSTでの時刻をUTCに変換して Date を作る（JST = UTC+9）
  const utcHour = hour - 9;
  return new Date(Date.UTC(2026, 0, 1, utcHour, minute));
}

describe("isOperatingHours", () => {
  it("is true during daytime (10:00 JST)", () => {
    expect(isOperatingHours(jstDate(10, 0))).toBe(true);
  });

  it("is true just after first train (04:30 JST)", () => {
    expect(isOperatingHours(jstDate(4, 30))).toBe(true);
  });

  it("is false in the middle of the quiet window (03:00 JST)", () => {
    expect(isOperatingHours(jstDate(3, 0))).toBe(false);
  });

  it("is false right before first train (04:00 JST)", () => {
    expect(isOperatingHours(jstDate(4, 0))).toBe(false);
  });

  it("is true late at night before quiet hours start (01:00 JST)", () => {
    expect(isOperatingHours(jstDate(1, 0))).toBe(true);
  });

  it("is false right at quiet hours start (01:30 JST)", () => {
    expect(isOperatingHours(jstDate(1, 30))).toBe(false);
  });
});
