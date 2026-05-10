import { describe, it, expect } from "vitest";
import { anomaliesToText } from "../anomaly";
import type { Anomaly } from "../anomaly";

describe("anomaliesToText", () => {
  it("returns empty string for no anomalies", () => {
    expect(anomaliesToText([])).toBe("");
  });

  it("formats direct_mention correctly", () => {
    const anomaly: Anomaly = {
      type: "direct_mention",
      scope: "company",
      target: "정원엔시스",
      today: 3,
      prev_avg: 0.5,
      ratio: null,
    };
    const text = anomaliesToText([anomaly]);
    expect(text).toContain("직접 언급");
    expect(text).toContain("정원엔시스");
    expect(text).toContain("3건");
  });

  it("formats new_appearance for company correctly", () => {
    const anomaly: Anomaly = {
      type: "new_appearance",
      scope: "company",
      group: "MSP",
      target: "메가존클라우드",
      today: 2,
      prev_avg: 0,
      ratio: null,
    };
    const text = anomaliesToText([anomaly]);
    expect(text).toContain("신규 등장");
    expect(text).toContain("메가존클라우드");
    expect(text).toContain("MSP");
  });

  it("formats spike correctly", () => {
    const anomaly: Anomaly = {
      type: "spike",
      scope: "keyword",
      target: "양자내성암호",
      today: 10,
      prev_avg: 1.5,
      ratio: 6.67,
    };
    const text = anomaliesToText([anomaly]);
    expect(text).toContain("급증");
    expect(text).toContain("양자내성암호");
    expect(text).toContain("6.67배");
  });

  it("caps output at 8 anomalies", () => {
    const many: Anomaly[] = Array.from({ length: 12 }, (_, i) => ({
      type: "direct_mention" as const,
      scope: "company" as const,
      target: `회사${i}`,
      today: 1,
      prev_avg: 0,
      ratio: null,
    }));
    const text = anomaliesToText(many);
    const lines = text.split("\n").filter(Boolean);
    expect(lines).toHaveLength(8);
  });

  it("uses group fallback '비교종목' when group is undefined", () => {
    const anomaly: Anomaly = {
      type: "new_appearance",
      scope: "company",
      target: "테스트회사",
      today: 1,
      prev_avg: 0,
      ratio: null,
    };
    const text = anomaliesToText([anomaly]);
    expect(text).toContain("비교종목");
  });
});
