# 프로젝트 아키텍처

이 문서는 llms-gui 애플리케이션의 기술적인 아키텍처, 데이터 흐름, 주요 구성 요소에 대해 설명합니다.

## 설계 원칙 (Design Principles)

llms-gui 프로젝트는 다음과 같은 핵심 원칙을 기반으로 설계 및 개발되었습니다.

*   **일관성 (Consistency):** 코드 구조, UI/UX, 컴포넌트 사용 방식 등 프로젝트 전반에 걸쳐 일관성을 유지하여 예측 가능하고 이해하기 쉬운 코드를 지향합니다.
*   **단순성 (Simplicity):** 가능한 가장 간단하고 명확한 해결책을 추구하여 복잡성을 줄이고, 새로운 기능을 추가하거나 기존 기능을 수정하기 쉽게 만듭니다. 불필요한 추상화나 과도한 엔지니어링을 지양합니다.
*   **단일 진입점 (Single Entry Point):** 특정 기능이나 로직은 명확하게 정의된 단일 지점을 통해 접근하고 실행되도록 설계합니다. 이는 코드 추적과 디버깅을 용이하게 합니다. (예: 상태 변경은 정해진 스토어 액션을 통해서만 수행)
*   **유지보수성 (Maintainability):** 코드를 읽기 쉽고, 테스트하기 용이하며, 재사용 가능하도록 작성하여 장기적인 유지보수 비용을 최소화합니다. 모듈화, 명확한 네이밍 컨벤션, 적절한 주석 및 문서화를 통해 이를 달성합니다.

## 1. 고수준 아키텍처 (High-Level Architecture)

llms-gui는 다음과 같은 두 가지 주요 부분으로 구성된 클라이언트-서버 아키텍처를 따릅니다.

*   **Frontend (Client-Side):** React와 TypeScript로 구축된 웹 기반 사용자 인터페이스입니다. 사용자는 이 인터페이스를 통해 워크플로우를 시각적으로 설계하고, 노드를 설정하며, 실행 상태와 결과를 확인합니다. 주요 책임은 다음과 같습니다: ([상세 아키텍처](./detailed-architecture/frontend-architecture.md))
    *   **UI/UX 제공:** React Flow 라이브러리를 사용하여 노드 기반의 워크플로우 편집 환경을 제공합니다.
    *   **노드 설정 관리:** 각 노드 타입에 맞는 설정 패널을 렌더링하고 사용자 입력을 처리합니다.
    *   **상태 관리 (Zustand):** 플로우 구조, 노드 설정 내용, 노드 실행 상태 등 애플리케이션의 전반적인 상태를 관리합니다.
    *   **프론트엔드 기반 노드 실행:** 특정 노드(예: `HTML Parser`)의 실행 로직은 브라우저 환경에서 직접 수행됩니다.
    *   **백엔드 통신:** 필요한 경우(예: LLM 호출, 웹 크롤링, API 노드 실행) 백엔드 API와 상호작용합니다.

*   **Backend (Server-Side):** Python FastAPI 프레임워크를 사용하여 구축된 API 서버입니다. 주로 프론트엔드에서 직접 처리하기 어렵거나 보안/자원 접근이 필요한 작업을 담당합니다. 주요 책임은 다음과 같습니다: ([상세 아키텍처](./detailed-architecture/backend-architecture.md))
    *   **외부 서비스 연동:** LLM(Ollama, OpenAI API 등), 외부 API 호출, 웹 페이지 크롤링 등 프론트엔드에서 직접 수행하기 어려운 작업을 위한 API 엔드포인트를 제공합니다.
    *   **보안 및 인증 (필요시):** API 키 관리 등 보안 관련 로직을 처리합니다.
    *   **무거운 계산 처리 (필요시):** 대규모 데이터 처리나 복잡한 계산이 필요한 노드 로직을 실행합니다. (현재 대부분의 노드 로직은 프론트엔드 또는 외부 서비스에서 처리됨)

**상호작용:**

1.  사용자는 **Frontend UI**를 통해 플로우를 생성하고 편집합니다.
2.  노드 설정 및 플로우 구조는 **Frontend 상태 저장소 (Zustand)**에 저장됩니다.
3.  사용자가 플로우 실행을 트리거하면, **Frontend의 Flow Runner**가 실행 순서를 결정합니다.
4.  각 노드는 순서대로 실행됩니다.
    *   **Frontend 기반 노드** (`HTML Parser` 등): 관련 로직이 브라우저에서 직접 실행됩니다.
    *   **Backend 기반 노드** (`Web Crawler`, `LLM`, `API` 등): Frontend는 필요한 데이터를 **Backend API**로 전송하고, Backend는 해당 작업을 수행한 후 결과를 다시 Frontend로 반환합니다.
5.  각 노드의 실행 상태와 결과는 **Frontend 상태 저장소 (Zustand)**에 업데이트됩니다.
6.  상태 변경은 **Frontend UI**에 반영되어 사용자에게 실시간으로 표시됩니다.

## 2. 주요 기술 스택 (Key Technology Stack)

### Frontend ([상세 보기](./detailed-architecture/frontend-architecture.md))

*   **UI 라이브러리:** React (v18+)
*   **언어:** TypeScript
*   **플로우 시각화 및 편집:** React Flow (@xyflow/react)
*   **상태 관리:** Zustand
*   **UI 컴포넌트:** shadcn/ui (Radix UI + Tailwind CSS 기반)
*   **아이콘:** Heroicons 또는 유사 라이브러리
*   **데이터 파싱/처리:** DOMParser (내장), Lodash (유틸리티)
*   **빌드 도구:** Vite
*   **패키지 매니저:** npm 또는 yarn

### Backend ([상세 보기](./detailed-architecture/backend-architecture.md))

*   **웹 프레임워크:** FastAPI
*   **언어:** Python (v3.9+)
*   **비동기 처리:** asyncio
*   **데이터 유효성 검사:** Pydantic
*   **HTML 파싱 (현재 제거됨):** BeautifulSoup4 (현재 HTML 파싱은 프론트엔드에서 처리)
*   **HTTP 클라이언트:** httpx (외부 API 호출용)
*   **패키지 매니저:** Poetry 또는 pip
*   **서버 실행:** Uvicorn

## 3. 프론트엔드 상태 관리 (Frontend State Management)

Zustand를 사용하여 모듈화된 여러 스토어(Store)를 통해 애플리케이션 상태를 관리합니다.

*   **`useFlowStructureStore`:** 플로우의 구조적인 정보 (노드 목록, 엣지 목록, 선택된 노드 ID 등)를 관리합니다. React Flow 컴포넌트와 직접적으로 상호작용합니다.
*   **`useNodeContentStore`:** 각 노드의 **설정 내용(콘텐츠)**을 관리합니다. 노드 ID를 키로 사용하여 각 노드의 `label`, `extractionRules`, `prompt`, `url` 등 설정 패널에서 사용자가 입력하는 데이터를 저장하고 업데이트합니다. `NodeConfigSidebar` 및 각 노드의 설정 UI 컴포넌트(`ConfigFactory` 통해 로드됨)에서 주로 사용됩니다.
*   **`useNodeStateStore`:** 각 노드의 **실행 상태**를 관리합니다. 노드 ID를 키로 사용하여 각 노드의 실행 상태(`status`: 'idle', 'running', 'success', 'error'), 마지막 실행 결과(`result`), 오류 메시지(`error`) 등을 저장합니다. `Flow Runner` 및 각 노드의 `execute` 메서드에서 상태를 업데이트하며, 노드 UI 컴포넌트와 `NodeConfigSidebar`의 결과 표시 영역에서 이 상태를 구독하여 표시합니다.
*   **`useGroupExecutionController` / `useGroupExecutionState`:** 그룹 노드의 실행 제어 및 관련 UI 상태(현재 실행 중인 그룹, 그룹 반복 상태 등)를 관리합니다. 사용자가 그룹 노드의 실행 버튼을 눌렀을 때 트리거됩니다.
*   **`useExecutionGraphStore`:** 노드와 엣지 정보를 기반으로 생성된 실행 순서 그래프를 저장합니다. 실제 플로우 실행 시 이 그래프를 참조하여 노드 실행 순서를 결정합니다.
*   **`useDirtyTracker`:** 플로우 구조나 노드 콘텐츠가 마지막 저장 이후 변경되었는지 여부를 추적합니다.
*   **`useViewModeStore`:** 각 노드의 표시 모드(Compact/Expanded/Auto) 및 전역 뷰 모드를 관리합니다.

이러한 분리된 스토어들은 관심사를 분리하고 상태 관리 로직을 명확하게 유지하는 데 도움을 줍니다.

## 4. 데이터 흐름 및 노드 실행 (Data Flow & Node Execution)

### 4.1. 일반적인 실행 흐름 (Refactored)

1.  **사용자 상호작용:** 사용자가 UI에서 특정 노드의 'Run' 버튼, 그룹 실행 버튼 또는 전체 플로우 실행 버튼을 클릭합니다.
2.  **실행 트리거:** UI 이벤트 핸들러는 `src/core/executionUtils.ts`에 정의된 해당 실행 유틸리티 함수를 호출합니다:
    *   개별 노드 실행: `runSingleNodeExecution(nodeId)`
    *   그룹 노드 실행: `runGroupNodeExecution(groupNodeId)` (주로 `useGroupExecutionController`를 통해 간접 호출됨)
    *   전체 플로우 실행: `runFullFlowExecution(startNodeId?)` (주로 `runFlow` 헬퍼 함수를 통해 호출됨)
3.  **실행 컨텍스트 준비 (`prepareExecutionContext`):** 호출된 유틸리티 함수는 먼저 `prepareExecutionContext` 함수를 사용하여 실행에 필요한 환경을 준비합니다. 이 함수는 다음을 수행합니다:
    *   고유 실행 ID 생성
    *   실행 시점의 `nodes`, `edges` 정보 가져오기 (`useFlowStructureStore`)
    *   `NodeFactory` 인스턴스 생성 및 모든 노드 타입 등록
    *   위 정보들을 포함하는 `FlowExecutionContext` 인스턴스 생성
4.  **실행 시작 (`_startExecutionProcess`):** 유틸리티 함수는 준비된 컨텍스트와 실행할 노드 ID(들)를 `_startExecutionProcess` 내부 함수에 전달하여 실제 실행을 시작합니다. 이 함수는 다음을 수행합니다:
    *   실행할 각 시작 노드에 대해:
        *   필요한 경우 노드 데이터 준비 (예: LLM 노드)
        *   `nodeFactory.create(...)`를 사용하여 노드 인스턴스 생성 (이때 컨텍스트 전달)
        *   `nodeInstance.process({})` 호출
5.  **개별 노드 실행 (`Node.process` 및 `execute`):** (기존 로직과 유사)
    *   모든 노드는 `Node` 기본 클래스의 `process` 메소드로 실행됩니다.
    *   `process`는 노드 상태를 'running'으로 변경하고, 해당 노드별로 구현된 `execute` 메소드를 호출합니다.
    *   `execute` 메소드는 노드 타입에 따른 로직을 수행하고 결과를 반환합니다.
        *   **Input 노드의 Foreach 모드:** 특별한 `{ mode: 'foreach', items: [...] }` 객체를 반환합니다.
        *   **기타 노드:** 처리 결과를 반환합니다 (배열 또는 단일 값).
    *   `process`는 `execute`의 반환값을 분석합니다:
        *   **ForEach 객체:** 반환된 `items` 배열을 순회하며 각 `item`에 대해 모든 자식 노드의 `process(item)`을 호출합니다.
        *   **배열/단일 값:** 해당 값을 `FlowExecutionContext.storeOutput`으로 저장하고, **모든** 자식 노드의 `process(value)`를 호출합니다.
        *   **null:** 실행을 중단합니다.
6.  **결과 저장 (`storeOutput`):** (기존 로직과 동일)
    *   `FlowExecutionContext`의 `storeOutput` 메소드를 통해 노드 ID별 결과 배열에 결과가 추가됩니다.
7.  **UI 업데이트:** (기존 로직과 동일)
    *   노드 상태와 결과 변경은 Zustand 스토어를 통해 UI에 반영됩니다.

### 4.2. 그룹 노드 실행 (Refactored)

그룹 노드는 내부 서브 플로우를 실행하는 로직을 자체적으로 가지고 있습니다 (`GroupNode.execute` 참고).

1.  **그룹 실행 트리거:** 사용자가 UI에서 그룹 실행 버튼을 클릭하면 `useGroupExecutionController`의 `executeFlowForGroup` 액션이 호출됩니다.
2.  **유틸리티 함수 호출:** 이 액션은 내부적으로 `executionUtils.ts`의 `runGroupNodeExecution(groupNodeId)` 함수를 호출합니다.
3.  **그룹 노드 실행 시작:** `runGroupNodeExecution`은 `prepareExecutionContext`와 `_startExecutionProcess`를 사용하여 해당 `GroupNode` 인스턴스의 `process({})`를 호출합니다.
4.  **내부 플로우 실행:** `GroupNode`의 `execute` 메소드가 실행되어 내부 노드들을 식별하고, 내부 루트 노드부터 시작하여 서브 플로우를 실행합니다 (자세한 내용은 `GroupNode.ts` 참조).
5.  **결과 집계 및 반환:** `GroupNode.execute`는 내부 리프 노드들의 결과를 취합하여 반환하고, 이 결과는 `process` 메소드를 통해 `FlowExecutionContext.storeOutput`에 저장됩니다.

### 4.3. 데이터 형식

*   노드 간 전달되는 데이터(`nodeState.result`)는 JavaScript의 기본 타입(문자열, 숫자, 불리언) 또는 복합 타입(객체, 배열)이 될 수 있습니다.
*   특정 노드는 특정 형식의 입력을 기대할 수 있습니다 (예: `HTML Parser`는 HTML 문자열 또는 관련 객체, `JSON Extractor`는 객체 또는 JSON 문자열).
*   `Output` 노드는 다양한 타입의 결과를 받아 설정된 포맷(JSON/TEXT)에 따라 문자열로 변환하여 표시합니다.

### 4.4. Input 노드의 공통 항목과 개별 항목 처리

Input 노드는 공통 항목(sharedItems)과 개별 항목(items)을 구분하여 관리하는 특별한 데이터 처리 메커니즘을 갖추고 있습니다:

1. **데이터 구조**:
   * **공통 항목(sharedItems)**: ForEach 모드에서 모든 개별 항목과 함께 전달되는 항목들의 배열입니다. 
   * **개별 항목(items)**: ForEach 모드에서 각각 독립적으로 처리되는 항목들의 배열입니다.
   * **업데이트 모드(updateMode)**: 'shared', 'element', 'none' 중 하나로 설정되며, 이전 노드의 출력을 어느 배열에 추가할지 결정합니다.

2. **입력 처리**:
   * `execute` 메소드는 이전 노드로부터 받은 입력을 업데이트 모드에 따라 처리합니다:
     * 'shared': 입력을 sharedItems 배열에 추가
     * 'element': 입력을 items 배열에 추가
     * 'none': 입력을 저장하지 않음

3. **실행 모드별 처리**:
   * **Batch 모드 (`iterateEachRow: false`)**: 
     * 공통 항목과 개별 항목을 하나의 배열(`[...sharedItems, ...items]`)로 결합하여 반환
     * 이 결합된 배열이 다음 노드의 입력이 됨
   * **ForEach 모드 (`iterateEachRow: true`)**:
     * 각 개별 항목마다 공통 항목과 결합한 배열 생성: `[...sharedItems, item]`
     * 이 결합된 배열을 사용하여 자식 노드의 실행을 트리거
     * Input 노드 자체는 결과를 반환하지 않음(`null`)

4. **사용 예시**:
   * **텍스트와 이미지 처리**: LLM 노드로 생성한 프롬프트를 공통 항목으로, 여러 이미지를 개별 항목으로 설정하여 각 이미지마다 동일한 프롬프트와 함께 처리
   * **다국어 번역**: 번역 지시사항을 공통 항목으로, 번역할 텍스트들을 개별 항목으로 설정하여 반복 처리
   * **일괄 데이터 처리**: 처리 메타데이터를 공통 항목으로, 처리할 데이터를 개별 항목으로 설정

5. **그룹 노드와의 연동**:
   * Input 노드의 ForEach 모드는 주로 Group 노드의 데이터 소스로 사용됨
   * Group 노드는 Input 노드의 결과를 반복 처리하여 일괄 처리 워크플로우를 구성

### 4.5. 실행 결과 저장 모범 사례

노드 개발 시 다음과 같은 모범 사례를 따르는 것이 중요합니다:

1. **단일 진입점 원칙:** 노드 실행 결과는 오직 `execute` 메소드의 반환값으로 전달되어야 합니다. 노드는 `execute` 메소드 내에서 직접 `storeOutput`을 호출하지 않아야 합니다.
2. **명확한 책임 분리:** 노드 로직(`execute`)과 결과 저장(`process`)의 책임을 분리합니다. 이렇게 하면 노드 개발자는 데이터 처리 로직에만 집중할 수 있습니다.
3. **일관된 데이터 흐름:** 모든 노드가 같은 `process` → `execute` → 결과 반환 → `storeOutput` 흐름을 따르면 전체 시스템의 데이터 흐름이 일관되고 예측 가능해집니다.
4. **디버깅 용이성:** 모든 결과가 같은 방식으로 저장되므로 문제 진단과 디버깅이 용이합니다.

### 4.6. 실행 유틸리티 (`executionUtils.ts`)

`src/core/executionUtils.ts` 파일은 다양한 시나리오(단일 노드, 그룹 노드, 전체 플로우)에서 플로우 실행을 시작하는 로직을 중앙 집중화하여 코드 중복을 제거하고 일관성을 높입니다. 주요 함수는 다음과 같습니다:

*   **`prepareExecutionContext(): FlowExecutionContext`**: 새로운 실행을 위한 컨텍스트(실행 ID, 노드/엣지 정보, 노드 팩토리 포함)를 준비하고 반환합니다.
*   **`_startExecutionProcess(startNodeIds, triggerNodeId, context)`**: 내부 헬퍼 함수로, 주어진 컨텍스트 내에서 지정된 시작 노드들의 실행(`process({})` 호출)을 담당합니다.
*   **`runSingleNodeExecution(nodeId: string): Promise<void>`**: 특정 노드 하나만 실행합니다. 노드 UI의 'Run' 버튼에서 사용됩니다.
*   **`runGroupNodeExecution(groupNodeId: string): Promise<void>`**: 특정 그룹 노드의 실행을 시작합니다. `useGroupExecutionController`에서 호출됩니다.
*   **`runFullFlowExecution(startNodeId?: string): Promise<void>`**: 전체 플로우 실행을 시작합니다. `startNodeId`가 없으면 루트 노드부터 시작하며, `runFlow` 헬퍼 함수에서 사용됩니다.

**참고:** `FlowRunner.ts`의 `FlowRunner.executeFlow` 메소드는 이제 deprecated 되었으며, 대신 `runFullFlowExecution` 사용이 권장됩니다.

## Frontend Deep Dive
For implementation details about React component structure and state management:
→ [Frontend Architecture Details](./detailed-architecture/frontend-architecture.md)

## Backend Deep Dive
For API endpoint specifications and service layer architecture:
→ [Backend Architecture Details](./detailed-architecture/backend-architecture.md) 