# Group 노드

### 1. 개요

`Group` 노드는 내부에 포함된 다른 노드들을 하나의 단위로 묶어 관리하고, 특정 입력 소스(주로 `Input` 노드)로부터 받은 데이터 항목 각각에 대해 내부 워크플로우를 반복 실행하는 **프론트엔드 기반 노드**입니다.

-   **입력:** Group 노드 자체는 이전 노드로부터 직접적인 데이터를 받아 처리하지는 않습니다. 대신, `Iteration Config` 설정에서 지정된 입력 소스 노드(`sourceNodeId`)의 출력을 반복 실행의 대상으로 사용합니다.
-   **처리 (`core/GroupNode.ts`, `core/executionUtils.ts` (또는 `FlowRunner.ts`의 관련 로직), `store/useGroupExecutionController.ts` 등 관련 실행 제어 로직):
    -   Group 노드가 실행되면, 설정된 입력 소스 노드(`iterationConfig.sourceNodeId`)로부터 데이터 배열(`itemsToIterate`)을 가져옵니다. (예: `Input` 노드의 `items` 또는 `sharedItems` + `items` 조합, 혹은 다른 노드의 배열 출력)
    -   가져온 배열의 각 항목(`currentItem`)에 대해 다음을 반복합니다:
        -   Group 내부에 정의된 워크플로우(노드 및 연결)를 실행합니다.
        -   Group 내부의 루트 노드(Group 내에서 들어오는 연결이 없는 노드)부터 실행이 시작됩니다.
        -   각 `currentItem` (또는 `Input` 노드의 경우 `[...sharedItems, currentItem]` 형태의 조합)은 Group 내부 워크플로우의 시작 노드(루트 노드)의 입력으로 전달됩니다.
        -   `FlowExecutionContext`는 각 반복(`iterationIndex`, `iterationTotal`, `currentItemData`)에 대한 정보를 추적할 수 있습니다.
        -   Group 내부의 워크플로우가 실행되면, 그 안의 각 노드는 전달받은 데이터를 기반으로 로직을 수행합니다.
    -   모든 항목에 대한 반복 실행이 완료되면, 각 반복에서 Group 내부의 **리프 노드**(Group 내에서 나가는 연결이 없는 노드)가 생성한 결과들을 모아 Group 노드 자체의 최종 결과로 저장합니다.
-   **출력:** 각 반복 실행에서 Group 내부 리프 노드들이 반환한 결과들을 모은 **배열 (Array)**. 이 배열은 Group 노드 다음으로 연결된 노드로 전달됩니다.

### 2. 프론트엔드 UI (노드 설정 패널 - `GroupConfig.tsx`, 상세 사이드바 - `GroupDetailSidebar.tsx`)

-   **(노드 자체)**
    -   **크기 조절:** Group 노드의 경계를 드래그하여 크기를 조절할 수 있습니다 (`NodeResizer`).
    -   **라벨:** Group 노드의 이름을 편집할 수 있습니다 (`EditableNodeLabel`).
    -   **내부 노드:** 다른 노드들을 Group 노드 안으로 드래그하여 포함시킬 수 있습니다. 내부 노드는 Group의 `parentNode` 속성을 갖게 됩니다.
-   **(설정 패널 - `GroupConfig.tsx`)**
    -   **Label:** Group 노드의 이름을 설정합니다.
    -   **Iteration Config:** 반복 실행을 위한 설정을 합니다.
        -   **Source Node:** 드롭다운 목록에서 반복 데이터의 소스가 될 노드(주로 `Input` 노드)를 선택합니다. 선택된 노드의 ID가 `iterationConfig.sourceNodeId`로 저장됩니다. 이 필드가 설정되어야 반복 실행 기능이 활성화됩니다.
-   **(상세 사이드바 - `GroupDetailSidebar.tsx` 또는 유사한 컨텍스트 UI)**
    -   그룹 노드를 선택하면 나타나는 UI 영역입니다.
    -   **Group Label:** 그룹의 이름 표시 및 편집.
    -   **Source Node:** 설정된 반복 입력 소스 노드의 이름(또는 ID) 표시.
    -   **Run Group:** 이 그룹 노드를 시작점으로 하여 내부 워크플로우의 반복 실행을 수동으로 트리거합니다.
    -   **Results:** 그룹 실행이 완료된 후, 각 반복의 리프 노드 결과들이 여기에 표시될 수 있습니다.
    -   **Export JSON:** 그룹 실행 결과를 JSON 파일로 내보내는 기능이 있을 수 있습니다.

### 3. 실행 로직 (`core/GroupNode.ts`, `core/executionUtils.ts` 등)

1.  **실행 트리거:** `executionUtils.runGroupNodeExecution` (또는 유사 함수)를 통해 Group 노드의 실행이 시작됩니다.
2.  **입력 소스 가져오기:** Group 노드의 `execute` 메서드 (또는 실행 유틸리티 내에서) `iterationConfig.sourceNodeId`를 사용하여 소스 노드의 출력(보통 배열 `itemsToIterate`)을 가져옵니다. 소스가 없거나 유효한 배열이 아니면 오류 처리합니다.
3.  **내부 실행 준비:**
    -   Group 노드 내부에 포함된 노드(`internalNodes`)와 엣지(`internalEdges`)를 식별합니다.
    -   내부 노드들 간의 연결 관계를 분석하여 실행 그래프를 생성하고, 내부 루트 노드 및 리프 노드를 식별합니다.
4.  **반복 실행:** 소스 노드에서 가져온 `itemsToIterate` 배열의 각 `item`에 대해 반복합니다.
    -   각 반복마다 `FlowExecutionContext`에 현재 반복 정보(`iterationIndex`, `currentItemData`, `iterationTotal`)를 설정합니다.
    -   내부 루트 노드 각각에 대해, `currentItemData`를 입력으로 전달하여 내부 플로우 실행을 시작합니다 (예: `executionUtils._startExecutionProcess` 또는 유사 로직 호출).
    -   내부 노드 실행 시 `FlowExecutionContext`를 통해 현재 반복 정보를 참조할 수 있습니다.
5.  **결과 수집:** 각 반복이 완료되면, 해당 반복에서 실행된 내부 리프 노드들의 결과를 `FlowExecutionContext`의 `outputs` 맵이나 유사한 메커니즘을 통해 수집합니다.
6.  **최종 결과 집계:** 모든 반복이 끝나면, `execute` 메서드 또는 실행 유틸리티는 각 내부 리프 노드 ID에 대해 수집된 모든 반복의 결과들을 가져와 하나의 배열로 합칩니다. 이 배열이 Group 노드의 최종 출력이 됩니다.
7.  **출력 전달:** 최종 집계된 결과 배열을 Group 노드의 출력으로 `storeOutput`에 저장하고 다음 노드로 전달합니다.

### 4. 백엔드 상호작용 및 역할

-   Group 노드는 **프론트엔드 기반**이며, 반복 실행 흐름 제어를 담당합니다. 백엔드와 직접 상호작용하지 않습니다.
-   Group 내부에 포함된 노드들(예: `LLM`, `API`, `Web Crawler`)은 각자의 로직에 따라 프론트엔드 또는 백엔드와 상호작용할 수 있습니다.

### 5. 데이터 흐름 및 출력 형식

-   **입력:** (간접적) `iterationConfig.sourceNodeId`로 지정된 노드의 출력 (보통 **배열**).
-   **처리:** 입력 배열의 각 항목에 대해 Group 내부 워크플로우 반복 실행.
-   **출력:** 각 반복 실행 시 Group 내부 리프 노드들이 생성한 결과들을 모두 모은 **배열 (Array)**.

**예시:**

-   `Input` 노드에 `iterateEachRow: false` (Batch 모드)로 설정되어 있고, `items`가 `["apple", "banana"]`이며, 이 `Input` 노드가 Group 노드의 소스로 지정됩니다.
-   Group 내부에는 "Translate to Korean" LLM 노드가 유일한 리프 노드로 있습니다.
-   Group 노드가 실행되면:
    1.  "apple" 입력으로 LLM 노드가 실행되어 "사과"를 반환합니다.
    2.  "banana" 입력으로 LLM 노드가 실행되어 "바나나"를 반환합니다.
-   Group 노드의 최종 출력은 `["사과", "바나나"]` 배열이 됩니다. 