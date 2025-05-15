# Web Crawler 노드

### 1. 개요

`Web Crawler` 노드는 지정된 URL의 웹 페이지 콘텐츠를 가져오는 **백엔드 기반 노드**입니다. 동적 웹 페이지의 콘텐츠 로딩을 기다리는 옵션 등을 제공하여 안정적으로 HTML을 가져올 수 있도록 설계되었습니다.

-   **입력:** 이전 노드로부터 URL 문자열을 받거나, 노드 설정에서 직접 URL을 지정할 수 있습니다. 입력값이 URL 문자열이고 노드 설정에 URL이 비어있으면 입력값을 URL로 사용합니다.
-   **처리:** 백엔드 API (`/api/web-crawler/fetch`)를 호출하여 실제 웹 페이지 크롤링을 수행합니다. 백엔드는 주어진 URL에 접속하고, 설정된 경우 특정 CSS 선택자(`waitForSelector`)가 나타날 때까지 대기하거나 지정된 시간(`timeout`)만큼 기다린 후 페이지의 **전체 HTML 소스 코드**를 가져옵니다.
-   **출력:** 가져온 웹 페이지의 **순수한 HTML 문자열**을 다음 노드로 전달합니다.

### 2. 프론트엔드 UI (노드 설정 패널)

-   **URL:** 크롤링할 웹 페이지의 주소입니다.
-   **Wait for Selector (Optional):** 페이지 로딩 시 이 CSS 선택자에 해당하는 요소가 나타날 때까지 기다립니다. 동적 콘텐츠 로딩이 완료된 후 HTML을 가져오고 싶을 때 유용합니다. (예: `.main-content`, `#article-body`)
-   **Timeout (ms):** 페이지 로딩 및 `waitForSelector` 대기를 위한 최대 시간 (밀리초 단위)입니다. 이 시간이 지나면 대기를 중단하고 현재까지 로드된 HTML을 반환하거나 오류를 발생시킬 수 있습니다.
-   **HTTP Headers:** 크롤링 요청 시 포함할 추가적인 HTTP 헤더를 설정합니다. (예: `User-Agent` 변경)
    -   헤더 이름과 값을 입력하고 'Add' 버튼으로 추가합니다.
    -   기존 헤더 옆의 'Remove' 버튼으로 삭제합니다.

### 3. 실행 로직 및 백엔드 상호작용

1.  노드의 `execute` 메서드 (`core/WebCrawlerNode.ts` - 또는 유사한 프론트엔드 노드 파일)가 호출됩니다.
2.  설정된 URL 또는 입력값으로 사용할 최종 `targetUrl`을 결정합니다.
3.  설정된 `waitForSelector`, `timeout`, `headers` 정보를 포함하여 백엔드 API (`/api/web-crawler/fetch`)에 POST 요청을 보냅니다. 요청 본문에는 `include_html: true` (또는 유사한 파라미터로 백엔드가 HTML을 반환하도록 지시)가 포함될 수 있으며, 실제 백엔드 API 요청 스펙을 따라야 합니다 (예: `WebCrawlerRequest` 모델 참고).
4.  백엔드 서비스(`backend-fastapi-py/services/web_crawler.py`)는 해당 URL을 크롤링하고 설정된 대기 조건(selector, timeout)을 적용한 후, 결과 객체(성공 시 `status: 'success'`, `html: '...'` 등)를 반환합니다. (실제 응답은 `WebCrawlerResponse` 모델 참고)
5.  프론트엔드 `execute` 메서드는 백엔드 응답을 받고, 상태가 'success'이고 `html` 필드가 있는지 확인합니다.
6.  성공적으로 HTML 콘텐츠를 받으면, 이 **HTML 문자열**을 `storeOutput`으로 저장하고 다음 노드로 반환합니다.
7.  백엔드에서 오류가 발생하거나 HTML 콘텐츠가 없으면 노드 상태를 'error'로 표시합니다.

### 4. 데이터 흐름 및 출력 형식

-   **입력:** (선택적) URL 문자열
-   **처리:** 백엔드 웹 크롤링 실행 (API: `/api/web-crawler/fetch`)
-   **출력:** 크롤링된 페이지의 **HTML 문자열 (String)** 