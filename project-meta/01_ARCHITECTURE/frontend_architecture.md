# 프론트엔드 아키텍처 상세 (2024.06 리팩토링 반영)

> **2024.06 리팩토링 기준 최신화: store 분리, 네이밍 통일, 컴포넌트 구조, 실행/결과/가이드 등 최신 구조/패턴 반영**

## 1. 디렉토리 및 파일 구조 (`frontend-react-ts/src/`)

- **App.tsx**: 메인 라우팅/엔트리
- **pages/**: FlowEditorPage, FlowExecutorPage 등 각 페이지별 컴포넌트 (각자 store/utils만 사용, cross-usage 금지)
- **components/**: 재사용 UI, 노드, executor/editor 등 세부 컴포넌트
- **store/**: zustand 기반 store (FlowEditorPage, FlowExecutorPage 등 각자 store만 사용)
- **utils/**: 비즈니스 로직/유틸리티 (store에서 분리)
- **core/**: 노드/플로우 실행/컨텍스트/노드팩토리 등 핵심 로직
- **services/**: 외부 API/LLM 등 서비스 연동
- **types/**: 타입 정의

## 2. 상태관리 및 원칙

- **각 페이지별 store/utils만 사용** (예: useFlowEditorStore, useFlowExecutorStore)
- **store 내 직접 상태변경 금지** (반드시 set/action 메서드만 사용)
- **비즈니스 로직은 utils/로 분리**
- **네이밍 통일** (flowChainId, flowChainMap 등)
- **deprecated/legacy store/컴포넌트/필드/명칭 완전 제거**

## 3. 주요 컴포넌트 구조

- **FlowEditorPage**: 플로우 편집/설계, 노드/엣지/설정/상태 관리
- **FlowExecutorPage**: 플로우 실행/입력/결과, import/export, ResultDisplay 등
- **FlowChainListView/FlowChainDetailsView/FlowDetailModal**: 플로우 목록/상세/입력/결과/삭제 등 UI
- **ResultDisplay**: lastResults, status 등 selector로 구독, 결과/마크다운/JSON/파일 등 다양한 출력 지원
- **Import/Export**: FlowChainListView에서 일관된 버튼/동작, 유효성 검증, 상태 초기화 등

## 4. 실행/결과/상태관리

- **실행/결과/상태/lastResults 등은 selector로 구독** (불필요한 리렌더 방지)
- **ResultDisplay**: outputs only/full JSON/markdown 등 토글, 파일 출력 지원
- **import/export/reset 등은 store action 및 utils로 일관 처리**

## 5. 기타 최신화 사항

- 모든 예시/구조/가이드/네이밍은 실제 코드와 100% 일치
- 과거 방식/legacy 용어/컴포넌트/필드/스토어 완전 제거
- UI/UX, 상태관리, 실행/결과, import/export 등 최신 패턴 반영

## 6. 문서 최신화 안내
- 본 문서는 2024.06 리팩토링 이후 실제 코드/구조/네이밍/상태관리/컴포넌트/가이드와 100% 일치하도록 유지됩니다.
- 예시/구조/가이드가 실제 코드와 다를 경우 반드시 문서를 최신 코드에 맞게 직접 업데이트해 주세요.

# 프론트엔드 아키텍처 상세

이 문서는 llms-gui 프론트엔드 애플리케이션의 상세 구조, 주요 디렉토리 및 컴포넌트, 상태 관리 전략, 실행 흐름에 대해 설명합니다.

## 1. 디렉토리 및 파일 구조 (`frontend-react-ts/src/`)

```
frontend-react-ts/src/
├── App.tsx                 # 메인 애플리케이션 컴포넌트, 라우팅 설정
├── main.tsx                # 애플리케이션 진입점 (React DOM 렌더링)
├── index.css               # 전역 CSS 스타일
├── env.d.ts                # TypeScript 환경 변수 타입 정의
│
├── components/             # 재사용 가능한 UI 컴포넌트
│   ├── config/             # 노드 설정 패널 관련 컴포넌트 (예: APIProxyNodeConfig.tsx)
│   ├── executor/           # Flow Executor 페이지 관련 컴포넌트
│   │   ├── ExportModal.tsx
│   │   ├── ExecutorPanel.tsx
│   │   ├── FileUploader.tsx
│   │   ├── FlowChainManager.tsx
│   │   ├── FlowInputForm.tsx
│   │   ├── ResultDisplay.tsx
│   │   └── stages/         # (주의: 이 디렉토리의 StageView 컴포넌트들은 최근 제거됨)
│   │       └── StageNavigationBar.tsx # 현재 유일하게 남은 Stage 관련 컴포넌트
│   ├── nodes/              # 각 노드 타입별 UI 렌더링 컴포넌트 (예: LLMNode.tsx)
│   ├── shared/             # 여러 곳에서 사용되는 공통 UI 컴포넌트 (예: Button, Input, Modal 등)
│   └── sidebars/           # 사이드바 컴포넌트 (예: NodeConfigSidebar.tsx)
│
├── core/                   # 핵심 로직 (플로우 실행, 노드 정의 등)
│   ├── AiService.ts        # AI 서비스 관련 로직 (LLM 호출 등)
│   ├── ApiService.ts       # 백엔드 API 통신 서비스
│   ├── ConfigFactory.tsx   # 노드 설정 UI를 동적으로 로드하는 팩토리
│   ├── ExecutableNode.ts   # 실행 가능한 노드의 기반 클래스 (Node 확장)
│   ├── FlowExecutionContext.ts # 플로우 실행 컨텍스트 관리
│   ├── FlowExporter.ts     # 플로우 내보내기/가져오기 로직
│   ├── FlowImporter.ts     # (FlowExporter와 유사하거나 통합 가능성 있음)
│   ├── FlowRunner.ts       # (주의: deprecated, executionUtils.ts로 대체됨)
│   ├── HtmlParser.ts       # HTML 파싱 로직 (백엔드 서비스와 역할 분담 확인 필요)
│   ├── LlmService.ts       # LLM 서비스 연동 로직
│   ├── Node.ts             # 모든 노드의 추상 기반 클래스
│   ├── NodeFactory.ts      # 노드 인스턴스 생성 셔틀 패턴
│   ├── NodeRegistry.ts     # 등록된 노드 타입 관리 (메타데이터, 설정 UI 등)
│   ├── OutputCollector.ts  # 실행 결과 수집 및 관리
│   ├── TemplateEngine.ts   # 텍스트 템플리팅 로직
│   ├── WebCrawler.ts       # 웹 크롤링 로직 (백엔드 서비스와 역할 분담 확인 필요)
│   ├── executionManager.ts # 실행 관리 로직 (FlowChainManager와 연관 가능성)
│   └── executionUtils.ts   # 플로우 실행 관련 핵심 유틸리티 함수 (runSingleNodeExecution 등)
│
├── flowExecutor/           # Flow Executor 페이지를 위한 특화된 로직 또는 타입 (상세 분석 필요)
│   └──types.ts            # Flow Executor 관련 타입 정의
│
├── hooks/                  # React 커스텀 훅
│   ├── useAutoSave.ts
│   ├── useFlowEditor.ts
│   ├── useFlowLoader.ts
│   ├── useGlobalKeyShortcuts.ts
│   ├── useNodeManagement.ts
│   └── ... (기타 상태 관리 또는 UI 로직 관련 훅)
│
├── pages/                  # 애플리케이션 페이지 컴포넌트
│   ├── EditorPage.tsx      # 플로우 편집기 페이지
│   └── ExecutorPage.tsx    # 플로우 실행기 페이지
│
├── services/               # 외부 서비스 연동 로직 (core/ApiService, core/LlmService 등과 중복/분리 검토 필요)
│   ├── flowExecutionService.ts # 플로우 실행 관련 서비스 (FlowChainManager에서 사용)
│   └── ollamaService.ts    # Ollama API 직접 호출 서비스 (core/LlmService와 통합 가능성)
│
├── store/                  # Zustand 상태 관리 스토어
│   ├── useFlowStructureStore.ts # 노드/엣지 구조, 선택, 캔버스 상태
│   ├── useNodeContentStore.ts   # 노드별 설정 내용 (단일 진실 공급원)
│   ├── useNodeStateStore.ts     # 노드 실행 상태 (idle, running, success, error), 결과
│   ├── useExecutionGraphStore.ts # 실행 의존성 그래프 (현재 사용 빈도 확인 필요)
│   ├── useExecutorStateStore.ts # Flow Executor 페이지 상태 관리
│   ├── useExecutorGraphStore.ts # Flow Executor의 그래프 관련 상태
│   ├── useHistoryStore.ts       # Undo/Redo 히스토리
│   └── useViewModeStore.ts      # 노드 표시 모드 관리
│
├── types/                  # TypeScript 타입 정의
│   ├── execution.ts
│   ├── flow.ts
│   ├── index.ts
│   ├── llm.ts
│   └── nodes.ts
│
└── utils/                  # 범용 유틸리티 함수
    ├── execution.ts
    ├── file.ts
    ├── flow.ts
    ├── index.ts
    ├── localStorage.ts
    └── string.ts
```

## 2. 주요 디렉토리 설명

*   **`components/`**: 재사용 가능한 모든 React 컴포넌트가 위치합니다.
    *   `config/`: 각 노드의 설정을 담당하는 UI 컴포넌트들입니다. `ConfigFactory.tsx`에 의해 동적으로 렌더링될 수 있습니다.
    *   `executor/`: `/executor` 경로의 Flow Executor 페이지에서 사용되는 컴포넌트들입니다. 최근 `InputStageView`, `ExecutingStageView`, `ResultStageView` 등은 `ExecutorPage.tsx` 내에 직접 UI 로직으로 통합되었습니다.
    *   `nodes/`: React Flow 캔버스에 렌더링될 각 노드의 시각적 표현을 담당합니다.
    *   `shared/`: 버튼, 모달, 입력 필드 등 애플리케이션 전반에서 사용되는 공통 UI 요소들입니다.
    *   `sidebars/`: 플로우 편집기의 사이드바 (예: 노드 설정 패널) 컴포넌트입니다.
*   **`core/`**: 애플리케이션의 핵심 로직을 포함합니다. 노드 클래스 정의 (`Node.ts`, `ExecutableNode.ts`), 노드 생성 (`NodeFactory.ts`, `NodeRegistry.ts`), 플로우 실행 (`executionUtils.ts`, `FlowExecutionContext.ts`), 외부 서비스 연동 (`ApiService.ts`, `LlmService.ts`) 등이 여기에 해당합니다.
*   **`flowExecutor/`**: `ExecutorPage.tsx`와 관련된 타입 정의(`types.ts`) 등이 위치할 수 있으나, 현재는 주로 타입 정의만 있는 것으로 보입니다. 관련 로직은 `pages/ExecutorPage.tsx`, `components/executor/`, `services/flowExecutionService.ts` 등에 분산되어 있을 수 있습니다.
*   **`hooks/`**: 상태 로직, UI 인터랙션, 사이드 이펙트 등을 캡슐화한 React 커스텀 훅들입니다.
*   **`pages/`**: 애플리케이션의 최상위 페이지 컴포넌트 (`EditorPage.tsx`, `ExecutorPage.tsx`)입니다.
*   **`services/`**: 외부 API 또는 서비스와의 통신을 담당하는 모듈입니다. `core/` 디렉토리의 서비스 관련 클래스들과 역할 분담 및 통합 가능성을 검토할 필요가 있습니다. 예를 들어, `ollamaService.ts`는 `core/LlmService.ts`와 기능적으로 유사하거나 통합될 수 있습니다. `flowExecutionService.ts`는 주로 `FlowChainManager`와 함께 Flow Executor의 실행 흐름을 관리합니다.
*   **`store/`**: Zustand를 사용한 상태 관리 스토어들이 위치합니다. 각 스토어는 특정 상태 조각을 담당합니다 (아래 '3. 상태 관리' 참조).
*   **`types/`**: 애플리케이션 전반에서 사용되는 TypeScript 타입 정의입니다.
*   **`utils/`**: 특정 도메인에 종속되지 않는 순수 함수 또는 범용 유틸리티 함수들입니다.

## 3. 상태 관리 (Zustand)

애플리케이션의 상태는 Zustand를 사용하여 여러 스토어로 분리되어 관리됩니다. 각 스토어는 명확한 책임을 가집니다.

*   **`useFlowStructureStore`**: 플로우의 노드, 엣지, 선택된 요소, 캔버스 뷰포트 등 시각적 구조 정보를 관리합니다.
*   **`useNodeContentStore`**: **노드 데이터의 단일 진실 공급원(Single Source of Truth)**. 각 노드의 설정 패널에서 사용자가 입력하는 모든 데이터 (예: LLM 프롬프트, API URL, HTML 추출 규칙 등)를 노드 ID를 키로 하여 저장하고 관리합니다.
*   **`useNodeStateStore`**: 각 노드의 실행 상태 (`idle`, `running`, `success`, `error`), 마지막 실행 결과, 발생한 오류 메시지를 관리합니다. `FlowExecutionContext`에 의해 주로 업데이트됩니다.
*   **`useExecutionGraphStore`**: 노드와 엣지 정보를 바탕으로 실행 의존성 그래프를 생성하고 관리합니다. (현재 코드베이스에서의 실제 사용 빈도 및 필요성 검토 필요)
*   **`useExecutorStateStore`**: Flow Executor 페이지(`ExecutorPage.tsx`)의 상태 (예: 현재 스테이지, 업로드된 파일, 입력 데이터, 실행 결과)를 관리합니다.
*   **`useExecutorGraphStore`**: Flow Executor에서 사용될 수 있는 그래프 관련 상태를 관리합니다. (`useExecutionGraphStore`와의 관계 또는 Flow Executor 특화 로직인지 확인 필요)
*   **`useHistoryStore`**: 플로우 편집기의 Undo/Redo 기능을 위한 상태 스냅샷을 관리합니다.
*   **`useViewModeStore`**: 각 노드의 표시 모드 (Compact, Expanded, Auto) 및 전역 뷰 모드를 관리합니다.

## 4. 프론트엔드 실행 흐름

플로우 실행은 주로 `src/core/executionUtils.ts`의 유틸리티 함수들을 통해 시작되고 관리됩니다. (`FlowRunner.ts`는 deprecated 되었습니다.)

1.  **실행 요청**: 사용자가 UI (노드, 툴바, Executor 페이지 등)에서 실행 버튼을 클릭합니다.
2.  **실행 유틸리티 호출**: 해당 UI 이벤트에 연결된 핸들러는 `executionUtils.ts`의 적절한 함수 (`runSingleNodeExecution`, `runGroupNodeExecution`, `runFullFlowExecution`)를 호출합니다.
3.  **실행 컨텍스트 생성 (`prepareExecutionContext`)**: 실행에 필요한 모든 정보 (실행 ID, 현재 노드/엣지 구조, `NodeFactory` 인스턴스 등)를 포함하는 `FlowExecutionContext` 객체를 생성합니다.
4.  **노드 인스턴스화 및 실행 (`_startExecutionProcess`)**: 실행 대상 노드 ID들을 기반으로 `NodeFactory`를 통해 각 노드의 인스턴스를 생성하고, 각 인스턴스의 `process({})` 메소드를 호출하여 실행을 시작합니다.
5.  **개별 노드 로직 (`Node.process` 및 `Node.execute`)**:
    *   `Node.process()`: 노드 상태를 'running'으로 설정하고, 하위 클래스에서 구현된 `execute()` 메소드를 호출합니다.
    *   `Node.execute()`: 각 노드 타입에 특화된 실제 로직을 수행하고 결과를 반환합니다.
    *   `process()`는 `execute()`의 결과를 받아 `FlowExecutionContext`에 저장하고, 자식 노드들의 `process()`를 재귀적으로 호출하여 데이터 흐름을 이어갑니다.
6.  **결과 및 상태 업데이트**: 실행 중 또는 완료 후, 노드의 상태와 결과는 `useNodeStateStore`에 업데이트되고, 이는 UI에 반영됩니다.

### 4.1. `ExecutorPage.tsx` UI 렌더링

`ExecutorPage.tsx`는 과거 `InputStageView`, `ExecutingStageView`, `ResultStageView`와 같은 별도의 스테이지 컴포넌트를 사용했지만, 최근 리팩토링을 통해 이러한 스테이지별 UI 로직이 `ExecutorPage.tsx` 내의 조건부 렌더링으로 통합되었습니다. 현재 `stage` 상태 (`useExecutorStateStore`에서 관리)에 따라 다른 UI 섹션 (파일 업로드, 입력 폼, 실행 중 표시, 결과 표시)을 직접 렌더링합니다. `StageNavigationBar.tsx`는 스테이지 간 이동을 위한 네비게이션 UI를 제공할 수 있습니다.

## 5. 주요 컴포넌트 전략

*   **재사용성**: `components/shared/` 디렉토리를 통해 애플리케이션 전반에서 사용될 수 있는 공통 UI 컴포넌트(버튼, 입력 필드, 모달 등)를 개발하여 일관성을 유지하고 코드 중복을 줄입니다.
*   **관심사 분리**: 컨테이너 컴포넌트(데이터 로딩 및 상태 관리)와 프리젠테이셔널 컴포넌트(데이터 표시)를 분리하려는 노력이 보입니다. (예: `pages/`의 컴포넌트가 데이터 로직을 많이 다루고, `components/`의 하위 컴포넌트들은 props를 받아 렌더링에 집중)
*   **노드별 컴포넌트**: 각 노드 타입은 `components/nodes/`에 자체 UI 렌더링 컴포넌트를, `components/config/`에 자체 설정 패널 컴포넌트를 가질 수 있습니다. `ConfigFactory.tsx`는 노드 타입에 따라 적절한 설정 UI를 동적으로 로드하는 역할을 할 수 있습니다.

## 6. 코드 개발 원칙 (문서화 관점)

*   **상태 관리 단순화**: `useNodeContentStore`가 노드 설정 데이터의 단일 진실 공급원 역할을 합니다.
*   **명확한 책임 분리**: 각 컴포넌트, 훅, 스토어, 서비스는 가능한 단일 책임을 가지도록 설계합니다.
*   **타입 안전성**: TypeScript를 적극적으로 활용하여 타입 정의를 명확히 하고, 개발 시점의 오류를 줄입니다.

이 문서는 프론트엔드 아키텍처의 주요 측면을 다루며, 코드베이스가 발전함에 따라 지속적으로 업데이트되어야 합니다. 