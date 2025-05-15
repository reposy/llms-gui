# JSON Extractor 노드

### 1. 개요

`JSON Extractor` 노드는 입력으로 받은 JSON 데이터(객체 또는 문자열)에서 특정 값을 추출하는 **프론트엔드 기반 노드**입니다. 점(.)이나 대괄호([])를 사용한 경로 표기법(예: `data.results[0].name`)을 사용하여 중첩된 값에 접근할 수 있습니다.

-   **입력:** JSON 객체 또는 JSON 형식의 문자열.
-   **처리 (`core/JsonExtractorNode.ts` 또는 유사 파일):**
    -   설정된 JSON 경로(`path`)를 사용하여 입력 데이터에서 값을 추출합니다 (`extractValue` 유틸리티 또는 유사 함수 사용).
    -   입력이 문자열이면 먼저 JSON 객체로 파싱을 시도합니다. 파싱에 실패해도 기본적인 경로 추출은 시도될 수 있습니다 (구현에 따라 다름).
    -   경로가 유효하지 않거나 값을 찾지 못하면 설정된 기본값(`defaultValue`, 기본값: `null`)을 반환합니다.
-   **출력:** 추출된 값 (타입은 원본 데이터에 따라 다름: String, Number, Boolean, Object, Array) 또는 기본값.

### 2. 프론트엔드 UI (노드 설정 패널 - `JsonExtractorConfig.tsx` 또는 유사 파일)

-   **JSON Path:** 추출할 값의 경로를 입력합니다. (예: `user.name`, `items[0].price`, `details.metadata['@id']`)
-   **Default Value (Optional):** 경로를 찾지 못하거나 추출 중 오류 발생 시 반환할 기본값을 지정합니다. 비워두면 `null`이 사용됩니다.

### 3. 실행 로직 (`core/JsonExtractorNode.ts`, `utils/flow/executionUtils.ts` 또는 관련 유틸리티)

1.  `execute` 메서드가 호출됩니다.
2.  설정된 `path`와 `defaultValue`를 가져옵니다. `path`가 없으면 오류 처리하고 `defaultValue`를 반환할 수 있습니다.
3.  입력(`input`)이 문자열이고 JSON 형태일 것으로 예상되면 `JSON.parse()`를 시도하여 객체로 변환합니다. (오류 처리 포함)
4.  변환된 객체(또는 원본 객체)와 `path`를 사용하여 `extractValue(data, path)` 함수 (예: lodash의 `_.get` 또는 커스텀 유틸리티)를 호출하여 값 추출을 시도합니다.
    -   `extractValue`는 경로 문자열을 파싱하여 단계별로 객체 속성이나 배열 인덱스에 접근합니다.
5.  추출된 값(`result`)이 `undefined`이거나 추출에 실패한 경우 (경로 없음 등) `defaultValue`를 반환하고, 그렇지 않으면 `result`를 반환합니다.
6.  추출 과정에서 예외 발생 시 오류를 기록하고 `defaultValue`를 반환합니다.
7.  최종 반환값을 `storeOutput`으로 저장하고 다음 노드로 전달합니다.

### 4. 백엔드 상호작용 및 역할

-   JSON Extractor 노드는 **프론트엔드 기반 노드**이며, 백엔드와 직접 상호작용하지 않습니다.

### 5. 데이터 흐름 및 출력 형식

-   **입력:** JSON 객체 (Object) 또는 JSON 형식 문자열 (String).
-   **처리:** 프론트엔드에서 경로 기반 값 추출.
-   **출력:** 추출된 값 (Any 타입) 또는 기본값. 