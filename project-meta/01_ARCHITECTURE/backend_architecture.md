# 백엔드 아키텍처 상세

이 문서는 llms-gui 백엔드 애플리케이션 (`backend-fastapi-py/`)의 상세 구조, 주요 파일 및 모듈, API 설계에 대해 설명합니다.

## 1. 디렉토리 및 파일 구조

```
backend-fastapi-py/
├── main.py                 # FastAPI 애플리케이션 진입점, API 라우터 정의
├── services/               # 비즈니스 로직 또는 외부 연동 서비스
│   ├── file_service.py     # 파일 업로드, 조회, 목록 관련 로직
│   ├── web_crawler.py      # 웹 페이지 크롤링 로직
│   └── html_parser.py      # HTML 콘텐츠 파싱 로직
├── requirements.txt        # Python 의존성 목록
├── settings.py             # 애플리케이션 설정 관리 (주로 .env 파일 로드)
├── Dockerfile              # Docker 컨테이너 빌드 설정
├── __pycache__/            # Python 컴파일 캐시 (버전 관리 대상 아님)
├── .idea/                  # IDE 설정 폴더 (버전 관리 대상 아님)
└── .venv/                  # Python 가상 환경 (버전 관리 대상 아님)
```

## 2. 주요 파일 및 모듈 설명

*   **`main.py`**: 
    *   FastAPI 애플리케이션의 메인 파일입니다.
    *   애플리케이션 인스턴스 생성, CORS 미들웨어 설정, 로깅 설정을 수행합니다.
    *   모든 API 엔드포인트와 해당 요청/응답 모델(Pydantic)을 정의합니다.
    *   `services/` 디렉토리의 서비스 모듈을 호출하여 실제 비즈니스 로직을 처리합니다.
*   **`services/`**: 실제 비즈니스 로직을 포함하는 서비스 모듈들이 위치합니다.
    *   `file_service.py`: 파일 업로드 처리, 저장, 경로 관리, 파일 존재 여부 확인, 파일 목록 조회 등의 기능을 담당합니다.
    *   `web_crawler.py`: 주어진 URL의 웹 페이지 콘텐츠를 크롤링하는 기능을 담당합니다. `playwright`를 사용하여 동적 콘텐츠 로딩, iframe 내부 접근, 특정 요소 대기 등의 고급 크롤링 옵션을 지원합니다.
    *   `html_parser.py`: HTML 콘텐츠와 추출 규칙 리스트를 입력받아, 규칙에 따라 데이터를 추출하는 기능을 담당합니다. `BeautifulSoup`과 유사한 방식으로 특정 선택자를 사용하여 텍스트, 속성 등을 추출할 수 있습니다.
*   **`requirements.txt`**: 프로젝트 실행에 필요한 Python 패키지 목록을 정의합니다.
*   **`settings.py`**: `pydantic-settings`를 사용하여 `.env` 파일 또는 환경 변수로부터 애플리케이션 설정을 로드합니다. 현재는 기본 설정만 존재하지만, 향후 로그 레벨, API 키, 타임아웃 값 등을 관리할 수 있습니다.
*   **`Dockerfile`**: 애플리케이션을 Docker 컨테이너로 빌드하기 위한 지침을 포함합니다. Python 환경 설정, 의존성 설치, 애플리케이션 실행 명령 등을 정의합니다.

## 3. API 설계

백엔드 API는 FastAPI를 사용하여 구축되었으며, 요청 및 응답 본문은 Pydantic 모델을 통해 유효성이 검사됩니다.

### 3.1. 공통 사항

*   **CORS (Cross-Origin Resource Sharing)**: `http://localhost:5173` (Vite 개발 서버 기본 포트) 등 특정 오리진에서의 요청을 허용하도록 설정되어 있습니다. 프로덕션 환경에서는 실제 프론트엔드 URL을 추가해야 합니다.
*   **로깅**: 표준 `logging` 모듈을 사용하여 요청 처리, 오류 발생 등의 주요 이벤트를 기록합니다.
*   **오류 처리**: FastAPI의 `HTTPException`을 사용하여 적절한 HTTP 상태 코드와 오류 메시지를 클라이언트에 반환합니다. 일반 예외 발생 시 500 Internal Server Error로 처리됩니다.

### 3.2. API 엔드포인트 상세

#### 3.2.1. 루트

*   **엔드포인트**: `GET /`
*   **설명**: 애플리케이션의 기본 상태를 확인하는 간단한 엔드포인트입니다.
*   **요청**: 없음
*   **응답 (JSON)**:
    ```json
    {
      "message": "Hello World"
    }
    ```

#### 3.2.2. 웹 크롤러

*   **엔드포인트**: `POST /api/web-crawler/fetch`
*   **설명**: 지정된 URL의 웹 페이지 콘텐츠를 크롤링합니다.
*   **요청 모델 (`WebCrawlerRequest`)**:
    *   `url` (HttpUrl, 필수): 크롤링할 URL.
    *   `waitForSelectorOnPage` (str, 선택): 페이지 로드 후 특정 CSS 선택자가 나타날 때까지 대기.
    *   `iframeSelector` (str, 선택): 크롤링할 대상이 iframe 내부에 있는 경우 해당 iframe의 CSS 선택자.
    *   `waitForSelectorInIframe` (str, 선택): iframe 내부에서 특정 CSS 선택자가 나타날 때까지 대기.
    *   `timeout` (int, 기본값: 30000ms): 크롤링 작업 타임아웃.
    *   `headers` (Dict[str, str], 선택): 요청 시 사용할 커스텀 HTTP 헤더.
    *   `extract_element_selector` (str, 선택): 크롤링 결과에서 특정 요소만 추출할 경우 해당 요소의 CSS 선택자.
    *   `output_format` (str, 선택, 기본값: 'html'): 현재는 주로 HTML을 반환하지만, 향후 텍스트, JSON 등으로 확장 가능성 있음 (코드상에서는 `extracted_content`, `extracted_data` 필드가 응답에 포함됨).
*   **응답 모델 (`WebCrawlerResponse`)**:
    *   `url` (str): 요청된 URL.
    *   `status` (str): 크롤링 상태 ("success", "error").
    *   `error` (str, 선택): 오류 발생 시 오류 메시지.
    *   `title` (str, 선택): 페이지 제목.
    *   `text` (str, 선택): 페이지의 주요 텍스트 콘텐츠 (Playwright가 추출).
    *   `html` (str, 선택): 페이지의 전체 HTML 콘텐츠.
    *   `extracted_content` (str, 선택): `extract_element_selector`로 지정된 요소의 HTML 또는 텍스트.
    *   `extracted_data` (Dict[str, Any], 선택): 구조화된 데이터 추출 시 사용 (현재 `web_crawler.py`에서는 명시적으로 채우지 않음).

#### 3.2.3. HTML 파서

*   **엔드포인트**: `POST /api/html-parser/parse`
*   **설명**: 제공된 HTML 콘텐츠를 주어진 추출 규칙에 따라 파싱합니다.
*   **요청 모델 (`HtmlParseRequest`)**:
    *   `html_content` (str, 필수): 파싱할 HTML 문자열.
    *   `extraction_rules` (List[ExtractionRule], 필수): 추출 규칙 리스트. `ExtractionRule`은 `services/html_parser.py`에 정의되어 있으며, 각 규칙은 이름, 선택자, 추출 타입(텍스트, 속성 등), 속성명(타입이 'attribute'인 경우) 등을 포함합니다.
*   **응답 모델 (`HtmlParseResponse`)**:
    *   `status` (str): 파싱 상태 ("success", "error
    *   `data` (Dict[str, Any], 선택): 추출 성공 시, 규칙 이름(또는 고유 ID)을 키로 하고 추출된 데이터를 값으로 하는 딕셔너리.
    *   `error` (str, 선택): 오류 발생 시 오류 메시지.

#### 3.2.4. 파일 API

*   **파일 업로드**
    *   **엔드포인트**: `POST /api/files/upload`
    *   **설명**: 파일을 서버에 업로드합니다. (`file_service.py`에서 최대 파일 크기, 허용 확장자 등 유효성 검사 수행 가능)
    *   **요청**: `file` (UploadFile, 필수): 업로드할 파일.
    *   **응답 (JSON)**:
        ```json
        {
          "filename": "서버에_저장된_파일명.확장자",
          "content_type": "파일의_MIME_타입",
          "size": 파일_크기_바이트단위,
          "url": "/api/files/서버에_저장된_파일명.확장자" // 파일을 직접 접근할 수 있는 URL
        }
        ```
        (실제 응답은 `file_service.py`의 `save_uploaded_file` 반환값에 따라 다름)
*   **파일 조회**
    *   **엔드포인트**: `GET /api/files/{filename}`
    *   **설명**: 업로드된 특정 파일을 다운로드하거나 내용을 확인합니다.
    *   **경로 파라미터**: `filename` (str, 필수): 조회할 파일의 서버 저장 이름.
    *   **응답**: `FileResponse` (성공 시), 404 HTTPException (파일 없음).
*   **파일 목록 조회**
    *   **엔드포인트**: `GET /api/files`
    *   **설명**: 서버에 업로드된 파일 목록을 반환합니다.
    *   **쿼리 파라미터**: `limit` (int, 선택, 기본값: 100): 반환할 최대 파일 수.
    *   **응답 (JSON List)**:
        ```json
        [
          {
            "filename": "파일1.jpg",
            "content_type": "image/jpeg",
            "size": 102400,
            "url": "/api/files/파일1.jpg",
            "uploaded_at": "업로드_시간_ISO_포맷"
          }
          // ... 다른 파일 정보
        ]
        ```
        (실제 응답은 `file_service.py`의 `list_files` 반환값에 따라 다름)

### 3.3. Flow Executor 지원 (현재 미구현)

현재 `main.py`에는 프론트엔드의 Flow Executor 페이지에서 전체 플로우를 받아 실행하는 전용 엔드포인트(예: `/api/execute-flow`)는 명시적으로 **구현되어 있지 않습니다.**

만약 Flow Executor가 백엔드를 통해 플로우를 실행해야 한다면, 다음과 같은 기능이 필요하며 이는 향후 개발 항목이 될 수 있습니다:

*   플로우 정의(JSON) 및 초기 입력 데이터를 받는 엔드포인트.
*   플로우 정의를 해석하여 각 노드 타입에 맞는 백엔드 서비스(웹 크롤러, HTML 파서, LLM 호출 등)를 순차적 또는 병렬적으로 실행하는 로직.
*   각 노드의 실행 결과를 수집하고 최종 결과를 프론트엔드로 반환하는 기능.
*   LLM 노드 실행을 위한 외부 LLM 서비스(OpenAI, Ollama 등) 연동 로직 (현재 백엔드에는 직접적인 LLM 서비스 연동 코드가 없음).

## 4. 확장성 및 고려 사항

*   **LLM 서비스 연동**: 현재 백엔드에는 직접적인 LLM 연동 로직이 없습니다. `LLMNode`와 같은 노드가 백엔드 실행을 지원하려면, LLM 서비스(OpenAI, Ollama 등)와 통신하는 모듈을 `services/`에 추가하고, 이를 호출하는 API 엔드포인트를 `main.py`에 정의해야 합니다.
*   **API 버전 관리**: 현재 API 엔드포인트에는 버전 정보(예: `/v1/`)가 포함되어 있지 않습니다. 향후 API 변경 시 하위 호환성을 유지하기 위해 버전 관리를 도입하는 것을 고려할 수 있습니다.
*   **인증 및 인가**: 현재 API는 별도의 인증/인가 메커니즘이 없습니다. 민감한 데이터를 다루거나 사용자별 접근 제어가 필요한 경우, OAuth2, API 키 등의 인증 방식을 추가해야 합니다.
*   **비동기 작업 처리**: 웹 크롤링과 같이 시간이 오래 걸릴 수 있는 작업은 백그라운드 작업 큐(예: Celery)를 사용하여 비동기적으로 처리하고, 작업 상태를 폴링하거나 웹소켓으로 알리는 방식을 고려할 수 있습니다. 현재는 FastAPI의 `async/await`를 통해 동시 요청을 처리하지만, 개별 요청 자체는 동기적으로 완료될 때까지 대기합니다.

이 문서는 백엔드 아키텍처의 주요 측면을 다루며, 코드베이스가 발전함에 따라 지속적으로 업데이트되어야 합니다. 