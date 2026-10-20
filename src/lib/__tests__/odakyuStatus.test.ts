import { describe, expect, it } from "vitest";
import { extractReason, extractSection, parseEntries } from "../odakyuStatus";

const OBSERVED_AT = "2026-08-29T09:00:00.000Z";

describe("parseEntries", () => {
  it("returns normal status when no odakyu entries are present", () => {
    const result = parseEntries(
      [
        {
          "odpt:operator": "odpt.Operator:JR-East",
          "odpt:railway": "odpt.Railway:JR-East.Yamanote",
          "odpt:trainInformationText": { ja: "平常運転です。" },
        },
      ],
      OBSERVED_AT
    );
    expect(result.level).toBe("normal");
    expect(result.section).toBeNull();
  });

  it("treats an odakyu entry with no known keyword as normal", () => {
    const result = parseEntries(
      [
        {
          "odpt:operator": "odpt.Operator:Odakyu",
          "odpt:railway": "odpt.Railway:Odakyu.Tama",
          "odpt:trainInformationStatus": { ja: "平常運転" },
          "odpt:trainInformationText": { ja: "小田急多摩線は平常通り運転しています。" },
        },
      ],
      OBSERVED_AT
    );
    expect(result.level).toBe("normal");
  });

  it("detects a delay from an odakyu entry", () => {
    const result = parseEntries(
      [
        {
          "odpt:operator": "odpt.Operator:Odakyu",
          "odpt:railway": "odpt.Railway:Odakyu.Odawara",
          "odpt:trainInformationStatus": { ja: "遅延" },
          "odpt:trainInformationText": {
            ja: "小田急小田原線は、新宿駅〜町田駅間で、人身事故の影響で列車に遅れが発生しています。",
          },
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
          "odpt:operator": "odpt.Operator:Odakyu",
          "odpt:railway": "odpt.Railway:Odakyu.Enoshima",
          "odpt:trainInformationStatus": { ja: "遅延" },
          "odpt:trainInformationText": { ja: "小田急江ノ島線は遅延が発生しています。" },
        },
        {
          "odpt:operator": "odpt.Operator:Odakyu",
          "odpt:railway": "odpt.Railway:Odakyu.Odawara",
          "odpt:trainInformationStatus": { ja: "運転見合わせ" },
          "odpt:trainInformationText": {
            ja: "小田急小田原線は、車両故障のため、経堂駅〜新百合ヶ丘駅間で運転を見合わせています。",
          },
        },
      ],
      OBSERVED_AT
    );
    expect(result.level).toBe("suspended");
    expect(result.section).toBe("経堂〜新百合ヶ丘");
    expect(result.reason).toContain("車両故障");
  });

  it("falls back to the operator's Japanese name when the operator id doesn't contain 'Odakyu'", () => {
    const result = parseEntries(
      [
        {
          "odpt:operator": "小田急電鉄",
          "odpt:railway": "小田急小田原線",
          "odpt:trainInformationStatus": { ja: "遅延" },
          "odpt:trainInformationText": { ja: "遅延が発生しています。" },
        },
      ],
      OBSERVED_AT
    );
    expect(result.level).toBe("delay");
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
