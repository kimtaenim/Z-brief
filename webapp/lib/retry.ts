/**
 * withRetry — LLM API 호출용 재시도 래퍼
 *
 * WHY 이 모듈이 존재하는가:
 *   triageCluster()와 summarizeBrief()는 Anthropic API를 직접 호출한다.
 *   기존 구현에는 재시도 로직이 없어, API 일시 오류(529 Overloaded, 502 Bad Gateway) 시
 *   전체 브리프 생성 파이프라인이 즉시 실패했다.
 *   Anthropic API는 트래픽 급증 시 529를 반환하며, 보통 수백 ms 후 재시도하면 성공한다.
 *
 * WHY 최대 2회(기본값):
 *   재시도 횟수가 늘수록 사용자 대기 시간이 선형 증가한다.
 *   경험적으로 1회 재시도로 일시 오류의 80% 이상이 복구된다.
 *   3회 이상은 실제 장애 상황에서 불필요한 대기를 추가할 뿐이다.
 *
 * WHY 인증 오류는 재시도 안 함:
 *   401/403은 ANTHROPIC_API_KEY 설정 오류이므로 재시도해도 동일하게 실패한다.
 *   재시도하면 오히려 문제 진단 시간을 늦추고 불필요한 API 호출이 발생한다.
 */

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  const { attempts = 2, delayMs = 500 } = options;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      // 인증 오류는 즉시 throw — 재시도해도 동일하게 실패하므로
      if (isAuthError(err)) throw err;
      lastError = err;
      if (i < attempts - 1) await sleep(delayMs);
    }
  }
  throw lastError;
}

/**
 * Anthropic SDK가 인증 실패 시 사용하는 오류 패턴 감지.
 * 메시지에 "401", "403", "authentication_error" 중 하나라도 포함되면 인증 오류로 판단.
 */
function isAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("401") || msg.includes("403") || msg.includes("authentication_error");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
