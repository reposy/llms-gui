# Conditional 노드

### 1. 개요

`Conditional` 노드는 입력 데이터를 기반으로 설정된 조건을 평가하고, 그 결과(참/거짓)에 따라 워크플로우 실행 경로를 분기시키는 **프론트엔드 기반 노드**입니다. 참(True) 경로와 거짓(False) 경로 각각에 다른 후속 노드를 연결할 수 있습니다.

-   **입력:** 조건을 평가하는 데 사용될 데이터 (Any 타입).
-   **처리 (`core/ConditionalNode.ts` 또는 유사 파일):**
    -   설정된 조건 유형(`conditionType`)과 조건 값(`conditionValue`)을 사용하여 입력 데이터(`input`)를 평가합니다 (`evaluateCondition` 유틸리티 또는 유사 함수 사용).
    -   지원하는 조건 유형 (예시):
        -   `numberGreaterThan`: 입력값이 숫자이고 조건 값보다 큰지 비교.
        -   `numberLessThan`: 입력값이 숫자이고 조건 값보다 작은지 비교.
        -   `equalTo`: 입력값이 조건 값과 같은지 비교 (형 변환 후 비교 가능성 있음).
        -   `containsSubstring`: 입력값(문자열로 변환)이 조건 값(문자열)을 포함하는지 확인.
        -   `jsonPathExistsTruthy`: 입력값(객체/배열)에서 조건 값(JSON 경로)에 해당하는 값이 존재하고 Truthy한지 확인.
        -   (기타 다양한 조건 유형이 추가될 수 있음)
    -   조건 평가 결과(`true` 또는 `false`)를 내부적으로 저장하거나 컨텍스트에 기록합니다.
-   **출력:** Conditional 노드 자체는 다음 노드로 입력 데이터를 그대로 전달할 수도 있고, 아무것도 전달하지 않을 수도 있습니다 (구현에 따라 다름). 핵심은 실제 실행되는 다음 노드가 조건 평가 결과(참/거짓)에 따라 연결된 경로(True 또는 False 핸들에서 나가는 엣지)를 따라 결정된다는 점입니다.

### 2. 프론트엔드 UI (노드 설정 패널 - `ConditionalNodeConfig.tsx` 또는 유사 파일)

-   **Condition Type:** 드롭다운 목록에서 평가할 조건의 종류를 선택합니다.
-   **Value:** 조건과 비교할 값을 입력합니다. (조건 유형에 따라 숫자, 문자열, JSON 경로 등을 입력).

**(노드 본체 UI)**

-   노드에는 일반적으로 두 개의 출력 핸들(Source)이 시각적으로 표시됩니다:
    -   `True` (또는 `참`, `✔` 등): 조건 평가 결과가 참일 때 연결된 노드가 실행됩니다.
    -   `False` (또는 `거짓`, `✕` 등): 조건 평가 결과가 거짓일 때 연결된 노드가 실행됩니다.

### 3. 실행 로직 (`core/ConditionalNode.ts`, `utils/flow/executionUtils.ts` 또는 관련 유틸리티)

1.  `execute` 메서드가 호출되고, 설정된 `conditionType`과 `conditionValue`를 가져옵니다.
2.  `evaluateCondition(input, conditionType, conditionValue)` 함수를 호출하여 조건을 평가하고 결과(`conditionResult: true/false`)를 얻습니다.
3.  평가 결과(`conditionResult`)를 `this.context.storeOutput()` 등을 통해 저장하거나, 노드 내부 상태로 보관합니다. 이 결과는 후속 실행 경로 결정에 사용됩니다.
4.  `execute` 메서드는 원래의 `input`을 반환하거나, `conditionResult` 자체를 반환하거나, 아무것도 반환하지 않을 수 있습니다 (중요한 것은 조건 결과가 기록된다는 점).
5.  (FlowRunner 또는 `executionUtils` 로직) `ConditionalNode`의 실행이 끝나면, 이 노드의 `getChildNodes()` (또는 유사한 다음 노드 결정 로직)가 호출됩니다.
6.  `getChildNodes()` 메서드:
    -   저장된 조건 평가 결과(`conditionResult`)를 가져옵니다.
    -   결과에 따라 사용할 소스 핸들 이름(예: `source-true` 또는 `source-false`)을 결정합니다.
    -   해당 소스 핸들에서 나가는 엣지(`edges`)를 플로우 구조에서 찾아 연결된 타겟 노드 ID 목록을 얻습니다.
    -   타겟 노드 ID에 해당하는 노드 인스턴스를 생성하여 반환합니다. 이 노드들이 다음으로 실행될 노드들입니다. 조건에 맞지 않는 경로의 노드들은 실행되지 않습니다.

### 4. 백엔드 상호작용 및 역할

-   Conditional 노드는 **프론트엔드 기반 노드**이며, 백엔드와 직접 상호작용하지 않습니다.

### 5. 데이터 흐름 및 출력 형식

-   **입력:** Any 타입.
-   **처리:** 프론트엔드에서 조건 평가 및 실행 경로 결정.
-   **출력:** (직접적인 데이터 출력은 부차적일 수 있음) 실행 흐름이 조건 결과에 따라 True 또는 False 경로로 분기됨. 