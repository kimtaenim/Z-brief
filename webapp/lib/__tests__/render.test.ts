import { describe, it, expect } from "vitest";
import { sanitize } from "../render";

describe("sanitize", () => {
  it("replaces em dash with hyphen", () => {
    const { text, report } = sanitize("AI—시장");
    expect(text).toBe("AI-시장");
    expect(report.replaced["—"]).toBe(1);
  });

  it("replaces tilde with hyphen", () => {
    const { text, report } = sanitize("성장~둔화");
    expect(text).toBe("성장-둔화");
    expect(report.replaced["~"]).toBe(1);
  });

  it("removes horizontal rules (--- variants)", () => {
    const input = "본문\n---\n다음";
    const { text, report } = sanitize(input);
    expect(text).not.toContain("---");
    expect(report.replaced.horizontal_rule).toBe(1);
  });

  it("removes horizontal rules (=== variants)", () => {
    const input = "제목\n===\n내용";
    const { text, report } = sanitize(input);
    expect(text).not.toContain("===");
    expect(report.replaced.horizontal_rule).toBe(1);
  });

  it("removes emoji", () => {
    const { text, report } = sanitize("요약 🚀 완료");
    expect(text).toBe("요약  완료");
    expect(report.replaced.emoji).toBe(1);
  });

  it("records banned word violation without removing text", () => {
    const { text, report } = sanitize("이 주식을 추천합니다", ["추천"]);
    expect(text).toContain("추천");
    expect(report.violations).toContain("banned_word:추천");
  });

  it("no violations for clean text", () => {
    const { text, report } = sanitize("정상 텍스트입니다.");
    expect(text).toBe("정상 텍스트입니다.");
    expect(report.violations).toHaveLength(0);
    expect(Object.keys(report.replaced)).toHaveLength(0);
  });

  it("handles multiple replacements in one pass", () => {
    const { text } = sanitize("A—B~C");
    expect(text).toBe("A-B-C");
  });
});
