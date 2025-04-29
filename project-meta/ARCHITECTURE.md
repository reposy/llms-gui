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
*   **`useExecutionController` / `useExecutionState`:** 플로우 전체의 실행 제어 및 상태(현재 실행 중인 노드, 그룹 반복 상태 등)를 관리합니다. 사용자가 실행 버튼을 눌렀을 때 트리거됩니다.
*   **`useDirtyTracker`:** 플로우 구조나 노드 콘텐츠가 마지막 저장 이후 변경되었는지 여부를 추적합니다.
*   **`useViewModeStore`:** 각 노드의 표시 모드(Compact/Expanded/Auto) 및 전역 뷰 모드를 관리합니다.

이러한 분리된 스토어들은 관심사를 분리하고 상태 관리 로직을 명확하게 유지하는 데 도움을 줍니다.

## 4. 데이터 흐름 및 노드 실행 (Data Flow & Node Execution)

### 4.1. 일반적인 실행 흐름

1.  **사용자 상호작용:** 사용자가 UI에서 플로우 실행 버튼을 클릭합니다.
2.  **실행 트리거:** `useExecutionController`의 `executeFlow` 함수가 호출됩니다.
3.  **실행 그래프 생성:** `useFlowStructureStore`의 노드와 엣지 정보를 바탕으로 실행 순서를 결정하는 실행 그래프(Directed Acyclic Graph, DAG)를 생성합니다.
4.  **Flow Runner 실행:** `FlowRunner` (또는 유사한 실행 제어 로직)가 실행 그래프를 순회하며 각 노드를 순서대로 실행합니다.
5.  **개별 노드 실행 (`Node.execute`):**
    *   실행할 노드의 `execute` 메서드가 호출됩니다. 입력값은 이전 노드의 결과(`nodeState.result`)입니다.
    *   `useNodeStateStore`를 통해 해당 노드의 상태를 'running'으로 업데이트합니다.
    *   노드 타입에 따라 필요한 작업을 수행합니다.
        *   **Frontend 처리:** `HTML Parser` 등은 브라우저에서 직접 로직을 수행합니다.
        *   **Backend 처리:** `Web Crawler`, `LLM`, `API` 등은 필요한 정보를 구성하여 백엔드 API를 호출하고 응답을 기다립니다.
    *   실행이 완료되면 결과를 처리합니다.
    *   `useNodeStateStore`를 통해 노드 상태를 'success' 또는 'error'로 업데이트하고, 결과 또는 오류 메시지를 저장합니다.
6.  **결과 전달 (체이닝):** 성공적으로 실행된 노드의 결과(`nodeState.result`)는 다음 노드의 `execute` 메서드 호출 시 `input` 인자로 전달됩니다.
7.  **UI 업데이트:** `useNodeStateStore`의 상태 변경은 해당 상태를 구독하는 UI 컴포넌트(노드 자체, 사이드바 등)에 자동으로 반영되어 실행 상태(색상 변경 등)와 결과가 사용자에게 표시됩니다.

### 4.2. 그룹 노드 실행

그룹 노드는 연결된 입력 소스(주로 `Input` 노드)의 데이터를 반복 처리하는 특수한 실행 로직을 가집니다.

1.  **그룹 실행 트리거:** 그룹 노드 자체를 실행하거나, 그룹 노드가 포함된 플로우가 실행될 때 그룹 실행 로직이 시작됩니다.
2.  **입력 소스 확인:** 그룹 노드 설정(`iterationConfig.sourceNodeId`)에 지정된 입력 소스 노드의 결과(`nodeState.result`)를 가져옵니다. 이 결과는 보통 배열 형태입니다.
3.  **반복 실행:** 입력 배열의 각 항목에 대해 그룹 **내부의 서브 플로우**를 **독립적으로** 실행합니다.
    *   `useExecutionController`는 현재 반복 인덱스와 총 항목 수를 `useExecutionState`에 업데이트합니다.
    *   각 반복마다 입력 항목이 그룹 내부 플로우의 **시작 노드**로 전달됩니다.
    *   그룹 내부 노드들은 일반적인 실행 흐름(4.1)에 따라 체이닝되어 실행됩니다.
    *   각 반복의 최종 결과는 수집됩니다.
4.  **결과 집계:** 모든 항목에 대한 반복 실행이 완료되면, 각 반복에서 수집된 결과들을 배열 형태로 묶어 그룹 노드의 최종 결과(`nodeState.result`)로 저장합니다.
5.  **독립성:** 각 반복 실행은 서로 독립적입니다. 한 반복의 오류가 다른 반복의 실행에 직접적인 영향을 주지 않습니다 (오류 처리 방식에 따라 달라질 수 있음).

### 4.3. 데이터 형식

*   노드 간 전달되는 데이터(`nodeState.result`)는 JavaScript의 기본 타입(문자열, 숫자, 불리언) 또는 복합 타입(객체, 배열)이 될 수 있습니다.
*   특정 노드는 특정 형식의 입력을 기대할 수 있습니다 (예: `HTML Parser`는 HTML 문자열 또는 관련 객체, `JSON Extractor`는 객체 또는 JSON 문자열).
*   `Output` 노드는 다양한 타입의 결과를 받아 설정된 포맷(JSON/TEXT)에 따라 문자열로 변환하여 표시합니다.

## Frontend Deep Dive
For implementation details about React component structure and state management:
→ [Frontend Architecture Details](./detailed-architecture/frontend-architecture.md)

## Backend Deep Dive
For API endpoint specifications and service layer architecture:
→ [Backend Architecture Details](./detailed-architecture/backend-architecture.md) 