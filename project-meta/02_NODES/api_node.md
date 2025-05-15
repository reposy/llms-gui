# API 노드

### 1. 개요

`API` 노드는 지정된 URL과 설정(메서드, 헤더, 본문 등)을 사용하여 외부 HTTP API를 호출하고 그 응답을 반환하는 **프론트엔드 기반 노드**입니다. RESTful API 등 다양한 웹 API와 상호작용하는 데 사용됩니다.

-   **입력:** 이전 노드로부터 데이터를 받을 수 있으며, 설정에 따라 URL 또는 요청 본문(Request Body)으로 사용될 수 있습니다.
-   **처리 (`core/ApiNode.ts`):**
    -   설정된 URL 또는 입력값을 최종 요청 URL로 결정합니다.
    -   설정된 HTTP 메서드(`GET`, `POST`, `PUT`, `DELETE`, `PATCH`)를 확인합니다.
    -   설정된 헤더(`headers`), 쿼리 파라미터(`queryParams`)를 준비합니다.
    -   요청 본문(`body`)을 준비합니다:
        -   'Use Input as Body' 옵션이 켜져 있으면 이전 노드의 출력을 본문으로 사용합니다.
        -   꺼져 있고 메서드가 GET/DELETE가 아니면, 설정된 본문 형식(`bodyFormat`: 'raw' 또는 'key-value')에 따라 본문을 구성합니다.
            -   `raw`: 설정된 텍스트(`body`)를 그대로 사용합니다.
            -   `key-value`: 활성화된 키-값 쌍(`bodyParams`)들을 객체로 만들어 사용합니다.
        -   본문이 있는 경우, 설정된 `contentType` (기본값: 'application/json') 헤더가 자동으로 추가될 수 있습니다.
    -   구성된 파라미터(URL, 메서드, 헤더, 본문, 쿼리 파라미터)를 사용하여 `services/apiService.ts`의 `callApi` 함수를 호출합니다.
    -   `callApi` 함수는 내부적으로 `axios` 라이브러리를 사용하여 실제 HTTP 요청을 대상 API 서버로 보냅니다.
-   **출력:** API 서버로부터 받은 **응답 데이터 (response data)** 를 다음 노드로 전달합니다. 응답 데이터의 형식은 API 서버가 반환하는 내용에 따라 달라집니다 (JSON 객체, 텍스트, XML 등).

### 2. 프론트엔드 UI (노드 설정 패널 - `APIConfig.tsx`)

-   **URL:** 호출할 API 엔드포인트의 주소입니다. (필수)
-   **Method:** 사용할 HTTP 메서드를 선택합니다 (GET, POST, PUT, DELETE, PATCH).
-   **Headers:** 요청에 포함할 HTTP 헤더를 설정합니다. (이름-값 쌍으로 추가/삭제)
-   **Query Params:** URL에 추가될 쿼리 파라미터를 설정합니다. (이름-값 쌍으로 추가/삭제)
-   **Body:** 요청 본문을 설정하는 섹션입니다 (GET, DELETE 메서드에서는 비활성화될 수 있음).
    -   **Use Input as Body:** 체크 시, 이전 노드의 출력을 요청 본문으로 사용합니다. 아래의 본문 설정은 무시됩니다.
    -   **Body Format:** 본문 형식을 선택합니다.
        -   `raw`: 텍스트 영역에 입력된 내용을 그대로 본문으로 사용합니다. (JSON, XML, 일반 텍스트 등)
        -   `key-value`: 키-값 쌍 목록을 정의하여 본문을 구성합니다. (주로 `application/x-www-form-urlencoded` 또는 `multipart/form-data` 형식의 요청을 모방할 때 사용될 수 있으나, 현재 구현은 주로 JSON 객체 생성에 가까울 수 있음 - 확인 필요)
    -   **(Format: raw)** **Content Type:** `raw` 형식일 때 요청 헤더에 포함될 `Content-Type`을 지정합니다. (기본값: `application/json`)
    -   **(Format: raw)** **Body (Textarea):** `raw` 형식일 때 사용할 본문 내용을 직접 입력합니다.
    -   **(Format: key-value)** **Body Params:** 키-값 쌍 목록을 추가/삭제/활성화/비활성화하여 본문을 구성합니다.

### 3. 실행 로직 (`core/ApiNode.ts`, `services/apiService.ts`)

1.  `execute` 메서드가 호출되고, 노드 설정을 가져옵니다.
2.  URL과 요청 본문을 결정합니다. (입력값 사용 여부 확인)
3.  헤더, 쿼리 파라미터 등을 최종적으로 구성합니다.
4.  `apiService.callApi(params)` 함수를 호출합니다.
5.  `callApi` 함수는 `axios`를 사용하여 구성된 파라미터로 HTTP 요청을 보냅니다.
6.  API 서버로부터 응답을 받습니다.
7.  응답 데이터를 추출하여 `storeOutput`으로 저장하고 다음 노드로 반환합니다.
8.  오류 발생 시 (네트워크 오류, 4xx/5xx 응답 등) 노드 상태를 'error'로 표시합니다.

### 4. 백엔드 상호작용 및 역할

-   API 노드는 **백엔드 API 서버 (`/api/...`와 같은 내부 백엔드)와 직접 상호작용하지 않습니다.** (외부 API를 호출합니다)
-   API 호출은 프론트엔드 내 `services/apiService.ts`를 통해 이루어지며, 이 서비스는 브라우저 환경에서 직접 **대상 외부 API 서버**로 HTTP 요청을 보냅니다.
-   **주의:** 브라우저에서 직접 외부 API를 호출하므로, 대상 서버에 CORS(Cross-Origin Resource Sharing) 정책이 적절히 설정되어 있지 않으면 요청이 차단될 수 있습니다. CORS 문제가 발생할 경우, 백엔드를 통해 API 호출을 프록시하는 방식의 구현 변경이 필요할 수 있습니다.

### 5. 데이터 흐름 및 출력 형식

-   **입력:** (선택적) URL 문자열 또는 요청 본문으로 사용될 데이터 (Any 타입).
-   **처리:** 프론트엔드 서비스(`axios`를 사용하는 `services/apiService.ts`)를 통한 외부 API HTTP 호출.
-   **출력:** API 응답 본문 데이터 (타입은 API 서버 응답에 따라 다름: Object, String, Array, etc.). 