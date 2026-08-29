import { describe, expect, it } from "vitest";
import { extractReason, extractSection, parseEntries } from "../odakyuStatus";

const OBSERVED_AT = "2026-08-29T09:00:00.000Z";

describe("parseEntries", () => {
  it("returns normal status when no odakyu entries are present", () => {
    const result = parseEntries(
      [{ name: "JR山手線", description: "平常運転しています。" }],
      OBSERVED_AT
    );
    expect(result.level).toBe("normal");
    expect(result.section).toBeNull();
  });

  it("detects a delay from an odakyu entry", () => {
    const result = parseEntries(
      [
        {
          name: "小田急小田原線",
          description:
            "小田急小田原線は、新宿駅〜町田駅間で、人身事故の影響で列車に遅れが発生しています。",
        },
      ],
      OBSERVED_AT
    );
    expect(result.level).toBe("delay");
    expect(result.section).toBe("新宿〜町田");
    expect(result.reason).toContain("人身事故");
  });

  it("detects a service suspension and prioritizes it over a delay on another entry", () => {
    const result = parseEntries(
      [
        {
          name: "小田急江ノ島線",
          description: "小田急江ノ島線は遅延が発生しています。",
        },
        {
          name: "小田急小田原線",
          description:
            "小田急小田原線は、車両故障のため、経堂駅〜新百合ヶ丘駅間で運転を見合わせています。",
        },
      ],
      OBSERVED_AT
    );
    expect(result.level).toBe("suspended");
    expect(result.section).toBe("経堂〜新百合ヶ丘");
    expect(result.reason).toContain("車両故障");
  });

  it("ignores entries whose text has no delay keywords", () => {
    const result = parseEntries(
      [{ name: "小田急多摩線", description: "小田急多摩線は平常通り運転しています。" }],
      OBSERVED_AT
    );
    expect(result.level).toBe("normal");
  });
});

describe("extractSection", () => {
  it("extracts a station range with a tilde", () => {
    expect(extractSection("新宿〜町田間で遅延")).toBe("新宿〜町田");
  });

  it("returns null when no range is present", () => {
    expect(extractSection("全線で遅延しています")).toBeNull();
  });
});

describe("extractReason", () => {
  it("extracts a known incident keyword with surrounding context", () => {
    expect(extractReason("本日、人身事故のため遅れが生じています")).toContain("人身事故");
  });

  it("returns null when no known keyword matches", () => {
    expect(extractReason("詳細は駅係員にお尋ねください")).toBeNull();
  });
});
