# HTMLParserNode 구현 가이드

## 1. 목적 및 개요

`HTMLParserNode`는 WebCrawler 노드 등으로부터 전달받은 HTML 문자열을 입력으로 받아, 사용자가 정의한 규칙에 따라 원하는 데이터를 추출하고 구조화된 형태(JSON)로 출력하는 노드입니다. 이를 통해 복잡한 HTML 문서에서 필요한 정보만 선별적으로 가공하여 후속 노드에서 활용할 수 있도록 지원합니다.

## 2. 핵심 기능 요구사항

*   **HTML 파싱:** 입력된 HTML 문자열을 파싱하여 DOM(Document Object Model)과 유사한 내부 구조로 변환합니다. (백엔드 `BeautifulSoup` 활용)
*   **데이터 추출 규칙:**
    *   사용자는 UI 설정 패널을 통해 여러 개의 추출 규칙을 정의하고 관리할 수 있습니다.
    *   각 규칙은 다음 요소를 포함해야 합니다:
        *   `name` (문자열): 추출된 데이터의 키(key)로 사용될 고유한 이름.
        *   `selector` (문자열): 데이터를 추출할 HTML 요소를 지정하는 CSS 선택자.
        *   `target` (선택 옵션): 선택된 요소에서 추출할 대상 (`text`: 텍스트 내용, `attribute`: 특정 속성 값, `html`: 요소 자체의 HTML).
        *   `attribute_name` (문자열, `target`이 `attribute`일 때 필요): 추출할 HTML 속성의 이름 (예: `href`, `src`, `data-id`).
        *   `multiple` (불리언): `true`이면 선택자와 일치하는 모든 요소에서 데이터를 추출하여 배열로 반환하고, `false`이면 일치하는 첫 번째 요소에서만 데이터를 추출하여 단일 값으로 반환합니다.
*   **데이터 구조화 및 출력:**
    *   모든 추출 규칙을 적용한 후, 결과를 단일 JSON 객체로 구조화하여 출력합니다.
    *   객체의 키는 각 규칙의 `name`이 되며, 값은 해당 규칙에 따라 추출된 데이터(단일 값 또는 배열)가 됩니다.
    *   예시 출력: `{"product_title": "...", "prices": [100, 200], "image_url": "..."}`
*   **오류 처리:**
    *   유효하지 않은 HTML 입력 처리.
    *   유효하지 않은 CSS 선택자 처리.
    *   선택자와 일치하는 요소가 없을 경우의 처리 (예: `null` 또는 빈 배열 반환).
    *   오류 발생 시 노드 상태를 'error'로 설정하고, 오류 메시지를 명확히 표시합니다.

## 3. 구현 아키텍처 (제안)

일관성과 유지보수성을 위해 프론트엔드와 백엔드의 역할을 명확히 분담합니다.

### 3.1. 프론트엔드 (React + Zustand + @xyflow/react)

*   **`HTMLParserNode.tsx` (UI 컴포넌트):**
    *   노드의 시각적 표현 (입력/출력 핸들, 기본 정보 표시).
    *   실행 상태 표시.
    *   결과 요약 또는 전체 결과 표시 (결과 크기에 따라 조절).
*   **`HTMLParserNodeConfig.tsx` (설정 패널 UI):**
    *   사용자가 추출 규칙(`name`, `selector`, `target`, `attribute_name`, `multiple`)을 추가, 수정, 삭제할 수 있는 인터페이스를 제공합니다. (예: 테이블 또는 리스트 형태 UI)
    *   `useNodeContentStore`를 사용하여 노드의 설정(추출 규칙 목록)을 관리합니다.
*   **`HTMLParserNode.ts` (핵심 로직 클래스):**
    *   `Node` 클래스를 상속받습니다.
    *   `property` (노드 설정)에는 추출 규칙 목록(`extractionRules: ExtractionRule[]`)이 포함됩니다.
    *   `execute(htmlString: string)` 메서드:
        *   입력으로 HTML 문자열을 받습니다.
        *   `property`에서 추출 규칙 목록을 가져옵니다.
        *   백엔드 API 엔드포인트(`/api/html-parser/parse`)로 HTML 문자열과 추출 규칙 목록을 전송합니다.
        *   백엔드로부터 받은 구조화된 JSON 결과를 반환합니다.
*   **상태 관리 (`useNodeContentStore.ts`):**
    *   `HTMLParserNodeContent` 인터페이스 정의 (추출 규칙 목록 포함).
    *   `createDefaultNodeContent` 함수에 `html-parser` 타입 기본값 추가.

### 3.2. 백엔드 (FastAPI + Python)

*   **API 엔드포인트 (`main.py`):**
    *   `/api/html-parser/parse` 경로에 POST 메서드 핸들러를 추가합니다.
    *   요청 본문(Request Body)으로 HTML 문자열과 추출 규칙 목록을 받는 Pydantic 모델을 정의합니다. (예: `HtmlParseRequest`)
    *   `services/html_parser.py`의 파싱 함수를 호출하고 그 결과를 응답으로 반환합니다.
    *   오류 발생 시 적절한 HTTP 상태 코드와 오류 메시지를 반환합니다.
*   **서비스 로직 (`services/html_parser.py`):**
    *   `parse_html_content(html_string: str, rules: List[ExtractionRuleModel]) -> Dict[str, Any]` 와 같은 함수를 구현합니다.
    *   `BeautifulSoup` 라이브러리를 사용하여 `html_string`을 파싱합니다.
    *   입력된 `rules` 목록을 순회하며 각 규칙을 처리합니다:
        *   `soup.select()` 또는 `soup.select_one()` 메서드를 사용하여 CSS 선택자에 해당하는 요소를 찾습니다.
        *   규칙의 `target`과 `attribute_name`에 따라 텍스트, 속성 값, HTML 등을 추출합니다.
        *   `multiple` 값에 따라 단일 값 또는 값의 배열을 생성합니다.
        *   오류 발생(요소 없음 등) 시 적절히 처리합니다. (예: 로그 남기고 `None` 반환)
    *   모든 규칙의 결과를 종합하여 `{rule.name: extracted_value}` 형태의 딕셔너리를 생성하여 반환합니다.
    *   함수 내에서 발생할 수 있는 예외(파싱 오류 등)를 처리합니다.
*   **의존성 (`requirements.txt`):**
    *   `beautifulsoup4` 가 이미 설치되어 있는지 확인하고, 없다면 추가합니다. (현재는 설치되어 있음)
    *   HTML 파싱에 필요한 `lxml` 파서를 설치하는 것이 성능상 유리할 수 있습니다. (`pip install lxml`, `requirements.txt`에 `lxml` 추가)

## 4. 개발 고려사항

*   **CSS 선택자 검증:** 사용자가 입력한 CSS 선택자가 유효한지 프론트엔드 또는 백엔드에서 검증하는 로직 추가를 고려합니다.
*   **성능:** 매우 큰 HTML 문서를 처리할 경우의 성능을 고려합니다. 백엔드 파싱 로직을 최적화합니다. (`lxml` 파서 사용 권장)
*   **UI/UX:** 설정 패널에서 추출 규칙을 쉽게 추가하고 관리할 수 있도록 직관적인 UI를 제공합니다.
*   **테스트:** 다양한 HTML 구조와 추출 규칙에 대한 단위 테스트 및 통합 테스트를 작성합니다.

## 5. 향후 확장 가능성

*   XPath 지원 추가.
*   정규식(Regex) 기반 추출 지원 추가.
*   추출 전/후 데이터 변환(정리, 타입 변환 등) 기능 추가.
*   미리 정의된 공통 추출 패턴(예: 모든 링크 추출, 모든 이미지 URL 추출) 제공. 