import { describe, expect, it } from "vitest";
import { extractReason, extractSection, htmlToText, parseHtml, parseStatusText } from "../odakyuStatus";

const OBSERVED_AT = "2026-08-29T09:00:00.000Z";

describe("parseStatusText", () => {
  it("returns normal status when the page reports normal operation", () => {
    const result = parseStatusText("小田急線は、現在、平常運転しています。", OBSERVED_AT);
    expect(result.level).toBe("normal");
    expect(result.section).toBeNull();
  });

  it("detects a delay and extracts section/reason", () => {
    const result = parseStatusText(
      "小田急小田原線は、新宿駅〜町田駅間で、人身事故の影響で列車に遅れが発生しています。",
      OBSERVED_AT
    );
    expect(result.level).toBe("delay");
    expect(result.section).toBe("新宿〜町田");
    expect(result.reason).toContain("人身事故");
  });

  it("detects a service suspension and prioritizes it over a delay elsewhere on the page", () => {
    const result = parseStatusText(
      [
        "小田急江ノ島線は遅延が発生しています。",
        "小田急小田原線は、車両故障のため、経堂駅〜新百合ヶ丘駅間で運転を見合わせています。",
      ].join("\n"),
      OBSERVED_AT
    );
    expect(result.level).toBe("suspended");
    expect(result.section).toBe("経堂〜新百合ヶ丘");
    expect(result.reason).toContain("車両故障");
  });

  it("ignores an already-resumed notice instead of treating it as an active delay", () => {
    const result = parseStatusText(
      "人身事故のため、大和駅〜桜ヶ丘駅間で遅延が発生していましたが、運転を再開しました。",
      OBSERVED_AT
    );
    expect(result.level).toBe("normal");
  });

  it("only counts the still-active notice when a resumed one and an active one are both present", () => {
    const result = parseStatusText(
      [
        "小田急江ノ島線は、信号機故障のため運転を見合わせていましたが、運転を再開しました。",
        "小田急小田原線は、人身事故の影響で新宿駅〜町田駅間で遅延が発生しています。",
      ].join("\n"),
      OBSERVED_AT
    );
    expect(result.level).toBe("delay");
    expect(result.section).toBe("新宿〜町田");
  });
});

describe("htmlToText", () => {
  it("strips tags and converts common block elements to newlines", () => {
    const html = "<html><body><p>小田急線は<b>平常運転</b>しています。</p><div>ご利用ありがとうございます。</div></body></html>";
    const text = htmlToText(html);
    expect(text).toContain("小田急線は 平常運転 しています。");
    expect(text).toContain("ご利用ありがとうございます。");
  });

  it("removes script and style blocks entirely", () => {
    const html = "<script>var x = 1;</script><style>.a{color:red}</style><p>遅延情報</p>";
    const text = htmlToText(html);
    expect(text).not.toContain("var x");
    expect(text).not.toContain("color:red");
    expect(text).toContain("遅延情報");
  });
});

describe("parseHtml", () => {
  it("parses a full HTML page end-to-end", () => {
    const html = `
      <html>
        <body>
          <div class="status">
            <p>小田急小田原線は、新宿駅〜町田駅間で、人身事故の影響で遅延が発生しています。</p>
          </div>
        </body>
      </html>
    `;
    const result = parseHtml(html, OBSERVED_AT);
    expect(result.level).toBe("delay");
    expect(result.section).toBe("新宿〜町田");
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
