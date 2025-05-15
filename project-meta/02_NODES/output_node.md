# Output 노드

### 1. 개요

`Output` 노드는 워크플로우의 최종 결과를 표시하거나 특정 중간 결과를 확인하는 데 사용되는 **프론트엔드 기반 노드**입니다. 이전 노드로부터 전달받은 데이터를 지정된 형식(JSON 또는 Text)으로 보여주고, 결과를 파일로 다운로드하는 기능을 제공합니다.

-   **입력:** 이전 노드로부터 어떤 타입의 데이터든 받을 수 있습니다 (문자열, 숫자, 객체, 배열 등).
-   **처리 (`components/nodes/OutputNode.tsx` 또는 유사 컴포넌트):**
    -   노드 상태 저장소(`useNodeStateStore`)로부터 입력 데이터(`nodeState.result`)와 실행 상태(`nodeState.status`)를 가져옵니다.
    -   노드 콘텐츠 저장소(`useNodeContentStore`)로부터 표시 형식(`content.format`, 기본값: 'text') 설정을 가져옵니다.
    -   `formatResultBasedOnFormat` (또는 유사한 유틸리티 함수)를 사용하여 `nodeState.result`를 현재 설정된 `format`에 맞춰 문자열로 변환합니다.
        -   `json` 형식: 객체/배열은 들여쓰기 된 JSON 문자열로, 다른 타입은 문자열로 변환됩니다.
        -   `text` 형식: 문자열은 그대로, 객체/배열도 가독성을 위해 JSON 문자열 형태로 변환될 수 있습니다.
-   **출력:** Output 노드는 일반적으로 워크플로우의 종단점이므로, 다음 노드로 데이터를 전달하지 않습니다.

### 2. 프론트엔드 UI (`components/nodes/OutputNode.tsx` 또는 `OutputNodeConfig.tsx`)

-   **노드 헤더 (또는 설정 패널):**
    -   **JSON/TEXT 토글 버튼:** 표시 형식을 JSON 또는 TEXT로 전환합니다. 이 설정은 `useNodeContentStore`에 저장됩니다.
    -   **다운로드 버튼:** 현재 표시된 결과를 파일(`.json` 또는 `.txt`)로 다운로드합니다. (실행 상태가 'success'이고 결과가 있을 때 활성화)
-   **콘텐츠 영역 (`<pre>` 태그 또는 유사한 뷰어):**
    -   이전 노드의 실행 상태(`status`)에 따라 다른 내용을 표시합니다:
        -   `success`: `nodeState.result`를 선택된 `format`에 맞춰 포맷팅한 문자열을 표시합니다.
        -   `running`: "처리 중..." 텍스트를 표시합니다.
        -   `error`: `nodeState.error` 메시지를 표시합니다.
        -   `idle` 또는 `undefined`: "실행 대기 중..." 또는 "결과 없음" 텍스트를 표시합니다.

### 3. 실행 로직

-   Output 노드는 자체적인 `execute` 로직을 가지지 않는 경우가 많습니다. 주된 역할은 이전 노드로부터 `nodeState.result` (또는 직접적인 `input`)를 받아 UI에 표시하는 것입니다.
-   상태 변경 (`nodeState` 또는 `content.format`)이 감지되면 컴포넌트가 리렌더링되고, 표시될 내용을 결정하는 함수가 호출되어 UI를 업데이트합니다.

### 4. 백엔드 상호작용 및 역할

-   Output 노드는 **프론트엔드 기반 노드**이며, 백엔드와 상호작용하지 않습니다.

### 5. 데이터 흐름 및 출력 형식

-   **입력:** Any 타입 (이전 노드의 출력).
-   **처리:** 입력 데이터를 설정된 형식(JSON/TEXT)에 따라 문자열로 포맷팅하여 UI에 표시.
-   **출력:** 없음 (워크플로우 종단점 역할). 