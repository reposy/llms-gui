# 🗂️ 백엔드 코드 아키텍처 개요 (backend-code-architecture-overview.md)

이 문서는 백엔드(FastAPI) 프로젝트의 코드 구조, 주요 의존성, 설정 관리, 로깅 및 핵심 개발 원칙을 설명합니다.

**핵심 개발 원칙:**

*   **단순성 및 명확성:** 각 모듈과 함수는 명확한 단일 책임을 가집니다.
*   **일관성:** 코드 스타일, 네이밍 컨벤션, API 응답 구조 등의 일관성을 유지합니다.
*   **재사용성:** 중복 코드를 최소화하고 로직을 재사용 가능한 함수로 분리합니다.
*   **유지보수성:** 가독성 높고 잘 구조화된 코드를 작성합니다.

## 1. 디렉토리 구조

```
backend-fastapi-py/
├── services/             # 핵심 비즈니스 로직 (현재는 웹 크롤링만)
│   └── web_crawler.py    # Playwright 기반 웹 크롤링 서비스
├── project-meta/         # 프로젝트 관련 문서
│   └── ... (가이드 문서 등)
├── settings.py           # Pydantic 기반 설정 관리
├── main.py               # FastAPI 애플리케이션 정의 및 API 엔드포인트
├── requirements.txt      # Python 의존성 목록
├── Dockerfile            # Docker 이미지 빌드 정의
└── .env                  # 환경 변수 파일 (선택적, Git 무시 대상)
```

## 2. 주요 기술 스택 및 의존성

*   **웹 프레임워크:** FastAPI
*   **웹 서버:** Uvicorn (주로 개발 환경에서 사용)
*   **웹 크롤링:** Playwright (Chromium 브라우저 사용)
*   **HTML 파싱:** BeautifulSoup4 (lxml 파서 사용 권장)
*   **HTTP 클라이언트:** Httpx (현재 제거됨 - LLM 서비스 제거)
*   **설정 관리:** Pydantic-Settings
*   **데이터 유효성 검증:** Pydantic
*   **런타임 환경:** Docker

주요 의존성은 `requirements.txt` 파일에 관리됩니다. 새로운 의존성 추가 시 반드시 이 파일을 업데이트하고 Docker 이미지를 재빌드해야 합니다 (`docker compose up -d --build`).

## 3. 설정 관리 (`settings.py`)

*   애플리케이션 설정(향후 추가될 수 있는 API 키, 기본값 등)은 `settings.py` 파일에서 Pydantic의 `BaseSettings`를 사용하여 중앙 집중식으로 관리합니다.
*   `BaseSettings`는 `.env` 파일이나 환경 변수로부터 설정을 자동으로 로드할 수 있습니다.
*   코드 내에서는 `from .settings import settings`와 같이 임포트하여 설정 값에 접근합니다.

## 4. 로깅 설정 (`main.py`)

*   애플리케이션의 로깅 설정은 `main.py` 상단에서 `logging.basicConfig`를 사용하여 표준화된 형식으로 구성됩니다.
*   각 모듈에서는 `logging.getLogger(__name__)`을 사용하여 로거 인스턴스를 얻고 로그를 기록합니다.
*   기본 로그 레벨은 INFO 이며, 표준 로그 포맷은 `시간 - 로거 이름 - 로그 레벨 - 메시지` 형식입니다.

## 5. 웹 크롤링 서비스 (`services/web_crawler.py`)

*   `crawl_webpage` 함수는 웹 크롤링의 주 진입점입니다.
*   내부적으로 Playwright 초기화, 페이지 설정, 네비게이션 및 대기, 콘텐츠 추출 등의 로직이 비공개 헬퍼 함수(`_setup_browser_and_page`, `_navigate_and_wait` 등)로 분리되어 가독성과 유지보수성을 높였습니다.
*   Playwright와 BeautifulSoup을 사용하여 동적 웹 페이지의 HTML, 텍스트, 특정 요소 데이터를 추출합니다.
*   오류 발생 시 일관된 형식(`status`, `error` 포함)의 결과를 반환하며, `finally` 블록을 통해 브라우저 리소스를 안전하게 정리합니다.

## 6. API 엔드포인트 (`main.py`)

*   현재 `/api/web-crawler/fetch` (POST) 엔드포인트만 제공하며, 웹 크롤링 요청을 받아 처리합니다.
*   Pydantic 모델(`WebCrawlerRequest`, `WebCrawlerResponse`)을 사용하여 요청 및 응답 데이터의 유효성을 검증하고 구조를 명확히 합니다.
*   **오류 응답 처리:** 모든 엔드포인트는 내부 오류 발생 시에도 HTTP 200 OK 상태 코드를 반환하며, 응답 본문의 `status` 필드를 `"error"`로, `error` 필드에 오류 메시지를 담아 전달합니다. 프론트엔드는 이 `status` 필드를 확인하여 성공/실패 여부를 판단해야 합니다.

## 7. Docker 환경

*   `Dockerfile`은 Python 3.9 슬림 이미지를 기반으로 하며, `requirements.txt` 설치 및 Playwright 브라우저 설치(`playwright install --with-deps`) 단계를 포함합니다.
*   애플리케이션은 `uvicorn main:app --host 0.0.0.0 --port 8000` 명령어로 컨테이너 내에서 실행됩니다.
*   의존성 변경 시에는 반드시 `--build` 플래그를 사용하여 이미지를 재빌드해야 합니다. 