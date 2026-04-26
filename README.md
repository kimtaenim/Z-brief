# Z-brief

정원엔시스 IR Brief 생성기. 5개 클러스터(온프레미스AI, 피지컬AI, 버티컬AI, 보안과PQC, 밸류에이션)에서 RSS와 웹 검색으로 후보 기사를 모아 Anthropic Claude로 추리고 요약하는 Python CLI입니다.

## 빠른 시작

```bash
python -m venv .venv
.venv\Scripts\activate    # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt

cp .env.example .env
# .env 파일을 직접 열어 ANTHROPIC_API_KEY 값을 채워넣으세요
```

## 사용법

```bash
# 전체 실행 (LLM 추리 + 최종 요약, output/ 에 마크다운 저장)
python -m src.main

# 단일 클러스터만
python -m src.main --cluster physical_ai

# LLM 호출 없이 RSS 수집/필터 결과만 JSON으로 보고
python -m src.main --dry-run
```

`ANTHROPIC_API_KEY` 가 설정되어 있지 않으면 자동으로 dry-run 모드로 떨어집니다.

## 환경변수

| 이름 | 용도 |
|------|------|
| `ANTHROPIC_API_KEY` | Anthropic API 키. 비어 있으면 dry-run으로 폴백 |

## 비용 추정

호출 1회 기준 대략 $0.05 ~ $0.15 (Haiku 1차 추리기 5개 클러스터 + Sonnet 최종 요약 1회). 캐시 TTL 60분 동안은 LLM 재호출이 발생하지 않습니다.

## 디렉토리

```
Z-brief/
  config/clusters.yaml   5개 클러스터 + 전역 설정
  src/                   fetch / filter / triage / summarize / cache / render / main
  cache/                 클러스터별 JSON 캐시 (gitignore)
  output/                생성된 브리프 마크다운 (gitignore)
```

## 출력 규약 (요약)

- 제목 `정원엔시스 IR Brief - YYYY-MM-DD (KST)` (가로줄 금지)
- 상단 "오늘의 정원엔시스" -> 본문 5개 클러스터 -> "오늘의 핵심 기사" 2건 -> 총평
- 줄표(—), 물결(~), 이모지, "추천" 단어, 가로줄 금지 -> `render.sanitize()` 가 자동 치환·검출

## 다음 단계

- 웹앱(FastAPI/Next.js) 래퍼: 동일 파이프라인 그대로 호출하고 브라우저에 띄울 예정
- DART API 연동으로 정원엔시스 직접 공시는 별도 경로로 보강
- GitHub Actions 일일 스케줄

## 추후 검증 필요

- 법률신문 / 한국교육신문 / 기자협회보 / PD저널의 공식 RSS 가용성
- IEEE Spectrum Robotics, Robohub의 정확한 RSS 경로
- DART OpenAPI 활용 (정원엔시스 직접 공시는 RSS가 아닌 DART에서 받는 것이 정확)
- 미디어오늘·VentureBeat 외 버티컬 영역 영문 출처 추가 RSS

## 라이선스

사적 이용 (정원엔시스 내부).
