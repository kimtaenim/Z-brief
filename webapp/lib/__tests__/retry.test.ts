/**
 * retry.test.ts — withRetry TDD: 구현 전에 먼저 작성
 *
 * WHY 이 테스트가 필요한가:
 *   triageCluster()와 summarizeBrief()는 Anthropic API 일시 오류 시
 *   재시도 없이 즉시 전체 파이프라인을 실패시킨다.
 *   withRetry 유틸리티를 만들기 전에 기대 동작을 먼저 명세한다.
 */

import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../retry";

describe("withRetry", () => {
  it("첫 번째 시도에서 성공하면 결과를 즉시 반환한다", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("첫 번째 실패 후 두 번째에 성공하면 결과를 반환한다", async () => {
    // Anthropic 529 Overloaded 패턴: 수백 ms 후 재시도하면 성공
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("529 Overloaded"))
      .mockResolvedValue("recovered");
    const result = await withRetry(fn, { delayMs: 0 });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("모든 시도 실패 시 마지막 오류를 throw한다", async () => {
    const err = new Error("500 Internal Server Error");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { attempts: 2, delayMs: 0 })).rejects.toThrow("500");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("attempts 옵션으로 재시도 횟수를 제어할 수 있다", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(withRetry(fn, { attempts: 3, delayMs: 0 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("401 인증 오류는 재시도 없이 즉시 throw한다", async () => {
    // WHY: 401은 ANTHROPIC_API_KEY 문제이므로 재시도해도 동일하게 실패한다.
    // 재시도하면 오히려 문제 진단을 지연시킨다.
    const fn = vi.fn().mockRejectedValue(new Error("401 authentication_error"));
    await expect(withRetry(fn, { attempts: 3, delayMs: 0 })).rejects.toThrow("401");
    expect(fn).toHaveBeenCalledTimes(1); // 재시도 없이 1번만
  });

  it("403 인증 오류도 재시도 없이 즉시 throw한다", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("403 Forbidden"));
    await expect(withRetry(fn, { attempts: 3, delayMs: 0 })).rejects.toThrow("403");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
