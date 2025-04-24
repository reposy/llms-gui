🗂️ 코드 아키텍처 개요 (code-architecture-overview.md)

이 문서는 프로젝트의 전반적인 코드 구조, 주요 상태 관리, 저장소 관리 방법 및 핵심 개발 원칙을 설명합니다. 프로젝트의 일관성, 단순성, 확장성, 유지보수성을 유지하는 것을 목표로 합니다.

**핵심 개발 원칙:**
*   **단순성 및 명확성:** 각 컴포넌트, 모듈, 함수는 명확한 단일 책임을 가집니다. 불필요한 복잡성을 지양합니다.
*   **일관성:** 코드 스타일, 네이밍 컨벤션, 아키텍처 패턴 전반에 걸쳐 일관성을 유지합니다.
*   **확장성:** 새로운 기능 추가나 변경이 용이하도록 유연한 구조를 설계합니다.
*   **유지보수성:** 가독성 높고 잘 문서화된 코드를 작성하여 장기적인 유지보수를 용이하게 합니다.
*   **본질적 문제 해결:** 임시방편적인 해결책(방어 로직 등)보다는 문제의 근본 원인을 파악하고 구조적으로 개선하는 해결책을 지향합니다.

⸻

📦 디렉터리 및 파일 구조 (2024-07 기준 업데이트)
frontend-react-ts/
├── src/
│   ├── components/           # React UI 컴포넌트
│   │   ├── nodes/            # 각 노드 타입별 UI 컴포넌트 (InputNode.tsx, LLMNode.tsx 등)
│   │   ├── config/           # 노드 설정 패널 UI 컴포넌트
│   │   ├── sidebars/         # 사이드바 UI 컴포넌트
│   │   ├── shared/           # 여러 컴포넌트에서 재사용되는 UI 요소
│   │   ├── FlowEditor.tsx    # 메인 플로우 편집기 UI
│   │   └── FlowCanvas.tsx      # 노드 및 엣지 렌더링 캔버스
│   │
│   ├── core/                 # 핵심 플로우 실행 로직 및 노드 클래스 정의
│   │   ├── Node.ts           # 모든 노드의 추상 기반 클래스
│   │   ├── ExecutableNode.ts # 실행 가능한 노드 관련 (추후 구체화 필요)
│   │   ├── InputNode.ts      # Input 노드 핵심 로직
│   │   ├── LlmNode.ts        # LLM 노드 핵심 로직
│   │   ├── ... (다른 노드 타입별 클래스)
│   │   ├── NodeFactory.ts    # 노드 인스턴스 생성 관리
│   │   ├── NodeRegistry.ts   # 등록된 노드 타입 관리
│   │   ├── FlowRunner.ts     # 플로우 실행 오케스트레이션
│   │   └── FlowExecutionContext.ts # 플로우 실행 컨텍스트 관리
│   │
│   ├── hooks/                # React 커스텀 훅
│   │   ├── useNodeHandlers.ts # 노드 UI 인터랙션 관리
│   │   ├── useFlowSync.ts    # 플로우 상태 동기화 관리
│   │   ├── ... (각 노드 데이터 관리 훅: useLlmNodeData, useInputNodeData, useOutputNodeData, useMergerNodeData 등)
│   │   │     # 👉 이 훅들은 주로 useNodeContentStore와 상호작용하여 특정 노드 타입의 상태 접근 및 업데이트 로직을 캡슐화합니다.
│   │   │     # 👉 불필요하게 상태를 파생하거나 중복 관리하지 않도록 주의합니다.
│   │   └── synced/           # 상태 동기화 유틸리티 훅
│   │
│   ├── services/             # 외부 서비스 연동 로직 (LLM API, 기타 백엔드 API 등)
│   │   ├── llmService.ts     # LLM 서비스 추상화/통합 레이어 (Facade)
│   │   ├── openaiService.ts  # OpenAI API 연동. File 객체를 받아 Base64 데이터 URL로 변환 및 API 호출.
│   │   ├── ollamaService.ts  # Ollama API 연동. File 객체를 받아 순수 Base64 문자열로 변환 및 API 호출.
│   │   └── apiService.ts     # 일반 백엔드 API 연동 (필요시)
│   │
│   ├── store/                # Zustand 상태 관리 스토어
│   │   ├── useFlowStructureStore.ts # 노드/엣지 구조 및 선택 상태
│   │   ├── useNodeContentStore.ts # 노드별 콘텐츠/데이터 (핵심 데이터 상태)
│   │   ├── useNodeStateStore.ts   # 노드 실행 상태 (idle, running, success, error)
│   │   ├── useExecutionGraphStore.ts # 노드 실행 의존성 그래프
│   │   ├── useHistoryStore.ts      # Undo/Redo 히스토리
│   │   └── nodeContents/       # 노드 타입별 기본 콘텐츠 구조 정의 (useNodeContentStore 내부에서 사용)
│   │
│   ├── types/                # TypeScript 타입 정의
│   │   ├── nodes.ts          # 노드 관련 핵심 타입
│   │   └── execution.ts      # 실행 관련 타입
│   │   └── llm/types.ts      # LLM 서비스 관련 타입 (LLMRequestParams 등)
│   │
│   ├── utils/                # 범용 유틸리티 함수 (기능별 하위 디렉토리 구조)
│   │   ├── flow/             # Flow 실행, 구조, 노드 관련
│   │   ├── ui/               # UI 인터랙션 (클립보드, 선택, 히스토리)
│   │   ├── data/             # 데이터 처리, 파일, 가져오기/내보내기
│   │   ├── storage/          # 저장소 (IndexedDB 등)
│   │   ├── web/              # 웹, 크롤링, URL
│   │   ├── llm/              # LLM 관련 유틸리티 (현재 비어있음)
│   │   └── misc/             # 기타 유틸리티 (현재 비어있음)
│   │
│   ├── App.tsx               # 메인 애플리케이션 컴포넌트
│   └── main.tsx              # 애플리케이션 진입점
│
├── public/
│   └── uploads/              # 업로드된 파일 저장 폴더 (개발/로컬 환경)
└── package.json

*참고:* 위 구조는 현재(2024-07) 분석 기반이며, 리팩토링 과정에서 변경될 수 있습니다.

⸻

📐 주요 클래스 및 컴포넌트 정의

🔸 Node (`src/core/Node.ts`)

모든 노드의 부모가 되는 추상 클래스입니다. 노드의 기본 속성(id, type, property)과 실행 흐름 제어 메서드(`process`) 및 자식 노드 탐색(`getChildNodes`) 기능을 제공합니다.
abstract class Node {
  id: string;
  type: string;
  property: Record<string, any>;

  constructor(id: string, type: string, property: Record<string, any>);

  abstract async execute(input: any): Promise<any>;

  async process(input: any) {
    const result = await this.execute(input);
    if (result === null) return;
    for (const child of this.getChildNodes()) {
      await child.process(result);
    }
  }

  getChildNodes(): Node[]; // 자식 노드 조회
}

`execute` 메서드는 Vision 모드일 경우, 입력에서 이미지 타입(`image/*`)의 `File` 객체를 식별하여 `LLMRequestParams.images` 필드에 `File[]` 형태로 담아 하위 LLM 서비스(`llmService`)로 전달합니다. Base64 인코딩 및 API 포맷팅은 각 서비스(`ollamaService`, `openaiService`)에서 수행됩니다.

📊 노드 실행 프로세스 상세 (`src/core/FlowRunner.ts`, `src/core/FlowExecutionContext.ts`)

1.  **`process(input)`** (`Node.ts`): 노드 공통 실행 흐름 관리
    *   `execute()` 호출 → 노드별 로직 실행
    *   결과가 `null` 아니면 `getChildNodes()` 통해 얻은 자식 노드들에 `process(result)` 재귀 호출
2.  **`execute(input)`** (각 노드 타입 클래스): 노드 타입별 실제 작업 수행
    *   추상 메서드, 모든 하위 노드에서 구현 필요
    *   입력 처리 후 결과 반환 (or `null` 반환으로 흐름 중단)
    *   `FlowExecutionContext`를 사용하여 상태 업데이트 및 로깅 수행
3.  **`getChildNodes()`** (`Node.ts`, `useExecutionGraphStore.ts` 등): 자식 노드 검색
    *   현재는 `useExecutionGraphStore`를 통해 엣지 기반으로 동적으로 찾아 인스턴스화하는 방식이 주로 사용될 것으로 예상됩니다. (구현 확인 필요)
4.  **`FlowRunner.executeFlow()`**: 플로우 실행 시작점
    *   `FlowExecutionContext` 생성
    *   실행 그래프 기반으로 루트 노드 식별 및 `process({})` 호출
5.  **`FlowExecutionContext`**: 실행 컨텍스트 관리
    *   실행 상태 관리 (`markNodeRunning`, `markNodeSuccess`, `markNodeError`)
    *   결과 저장 (`storeOutput`) 및 조회 (`getOutput`)
    *   로그 기록 (`log`), 디버깅 데이터 저장 (`storeNodeData`)
    *   중복 실행 방지 (`hasExecutedNode`, `markNodeExecuted`)

🔸 NodeFactory (`src/core/NodeFactory.ts`)

노드 타입 문자열과 속성 정보를 받아 실제 노드 클래스 인스턴스를 생성하고 반환합니다. 노드 타입 추가 시 이 Factory 수정이 필요합니다. `FlowRunner` 등에서 노드 인스턴스 생성 시, 현재 플로우의 전체 `nodes`, `edges` 및 `nodeFactory` 자신을 `property`에 주입하여 노드가 실행 중 자신의 관계(부모/자식)를 파악할 수 있도록 지원합니다.

🔹 FlowExecutionContext (`src/core/FlowExecutionContext.ts`)

개별 플로우 실행의 상태와 맥락을 관리하는 핵심 클래스입니다. 실행 ID, 노드별 상태, 입출력 데이터, 로그 등을 포함합니다.
```typescript
class FlowExecutionContext implements ExecutionContext {
  executionId: string;          // 실행 고유 ID
  triggerNodeId: string;        // 실행 시작 노드 ID
  executionMode: 'single' | 'foreach' | 'batch'; // 실행 모드
  
  // 상태 관리 메서드
  markNodeRunning(nodeId: string): void;
  markNodeSuccess(nodeId: string, result: any): void;
  markNodeError(nodeId: string, error: string): void;
  
  // 출력 관리
  storeOutput(nodeId: string, output: any): void;
  getOutput(nodeId: string): any;
  
  // 디버깅 및 모니터링
  log(message: string): void;
  storeNodeData(nodeId: string, data: Record<string, any>): void;

  // 중복 실행 관리
  hasExecutedNode(nodeId: string): boolean;
  markNodeExecuted(nodeId: string): void;
}
```

🗃️ Zustand 스토어 (상태 관리 - `src/store/`)

Zustand를 사용하여 애플리케이션의 주요 상태를 관리합니다. 각 스토어는 명확한 책임을 가집니다.

*   **`useFlowStructureStore`**: 노드와 엣지의 구조 정보 (위치, 연결 관계), 현재 선택된 노드/엣지 ID 등을 관리합니다. UI 렌더링 및 구조 변경에 사용됩니다.
*   **`useNodeContentStore`**: **가장 핵심적인 데이터 스토어**입니다. 각 노드의 `property` (설정값, 예: LLM의 프롬프트, API 노드의 URL, Input 노드의 아이템 목록 등)와 노드 실행 결과(`outputData`), 그리고 노드 UI에 필요한 상태(예: Output 노드의 표시 형식, 편집 모드 등)를 포함하는 `NodeContent` 객체를 노드 ID별로 관리합니다. **모든 노드별 데이터와 설정은 이 스토어를 통해 중앙에서 관리하는 것을 원칙으로 합니다.** (`src/store/nodeContents/`는 이 스토어에서 사용할 타입별 기본 구조 정의는 현재 `useNodeContentStore.ts` 파일 내부에 `createDefaultNodeContent` 함수로 구현되어 있습니다.)
*   **`useNodeStateStore`**: 노드의 **실행 시점 상태**(idle, running, success, error)를 관리합니다. `FlowExecutionContext`에 의해 업데이트되며, UI에 노드 실행 상태를 시각적으로 표시하는 데 사용됩니다.
*   **`useExecutionGraphStore`**: 노드와 엣지 정보를 바탕으로 실제 실행 순서를 결정하는 의존성 그래프를 관리합니다. `getChildNodes()` 등의 로직에서 사용될 수 있습니다.
*   **`useHistoryStore`**: 사용자의 액션(노드 추가/삭제/이동, 설정 변경 등)에 대한 Undo/Redo 기능을 제공하기 위해 상태 스냅샷을 관리합니다.

📌 프로젝트 진행 및 관리 시 유의사항
*   **상태 관리 단순화:** **`useNodeContentStore`를 노드 데이터/설정의 단일 진실 공급원(Single Source of Truth)으로 활용합니다.** 파생 상태나 중복 상태 관리를 최소화하고, 커스텀 훅은 상태 로직보다는 UI 인터랙션이나 비동기 작업 처리, `useNodeContentStore` 업데이트 로직 캡슐화에 집중하도록 합니다. (예: `src/store/useInputNodeContentStore.ts` 참고)
*   **IndexedDB 관리:** 저장/로드 시 키 구조의 일관성을 유지하고, 데이터 마이그레이션 방안을 고려합니다. (버전 관리 등)
*   **핵심 가치 준수:** 모든 코드 변경 시 단순성, 일관성, 확장성, 유지보수성 원칙을 염두에 둡니다. 특히 문제 발생 시 근본적인 해결책을 고민하고 적용합니다.
*   **문서 최신화:** 코드 변경 시 관련 문서를 함께 업데이트하는 것을 습관화합니다.

---
(이 문서는 프로젝트 진행 상황에 따라 지속적으로 업데이트됩니다.)

// --- 서비스 레이어 설명 보강 --- 
*   **`src/services/openaiService.ts` / `src/services/ollamaService.ts`**: 각 LLM Provider별 API 연동 로직을 캡슐화합니다. 특히, 이 서비스들은 `LlmNode` 등으로부터 `File` 객체를 직접 전달받아, 각 API의 Vision 요구사항에 맞게 비동기적으로 Base64 인코딩 및 데이터 포맷팅(예: 데이터 URL 또는 순수 Base64 문자열 배열)을 수행하는 책임을 가집니다.

## 노드 타입 구조

### 1. 노드 타입

- **LLM Node**: Large Language Model 기반 처리 노드
  - 다양한 LLM 공급자 지원 (OpenAI, Anthropic 등)
  - 프롬프트, 모델 선택, 파라미터 설정 등 구성 가능
- **Input Node**: 사용자 입력 또는 파일 제공 노드
  - 텍스트 입력, 파일 업로드, CSV 처리 등
  - ForEach 모드와 Batch 모드 지원
- **Group Node**: 여러 노드를 그룹화하여 관리하는 컨테이너 노드
  - 내부에 다른 노드들을 포함 가능
  - 그룹 단위 실행 기능 제공
  - 자식 노드의 절대 위치를 유지하면서 부모-자식 관계 설정
  - 그룹 이동 시 내부 모든 노드가 함께 이동
  - **참고:** 기술적으로 그룹 노드 내부에 다른 그룹 노드를 포함시키는 중첩(nesting)이 가능할 수 있으나, 이는 현재 공식적으로 지원되거나 충분히 테스트된 시나리오는 아닙니다. 중첩 사용 시 예상치 못한 동작이 발생할 수 있습니다.
- **Code Node**: JavaScript/Python 코드 실행 노드
  - 동적 코드 실행 및 데이터 처리
  - 입력 데이터 조작 및 변환

## 핵심 컴포넌트 및 기능

### 6. 노드 드래그 & 드롭 처리

- **useNodeHandlers** hook: 노드 상호작용 관련 이벤트 핸들러 제공
  - `handleNodeDragStop`: 노드 드래그 종료 시 그룹 관계 처리
    - 노드가 그룹 위에 드래그되면 해당 그룹의 자식 노드로 설정
    - 부모-자식 관계 설정 시 **절대 좌표 유지**하도록 처리 (`extent: 'parent'` 속성 사용하지 않음)
    - 그룹 바깥으로 드래그 시 부모-자식 관계 해제
  - `handleNodeDrag`: 노드 드래그 중 처리
  - `handleNodeSelect`: 노드 선택 처리
  - `handleNodeClick`: 노드 클릭 이벤트 처리

- **FlowCanvas 컴포넌트의 onDrop 함수**:
  - 새 노드 생성 및 캔버스에 배치
  - 그룹 노드 위에 드롭 시 부모-자식 관계 설정 (상대 좌표 변환 없이 **절대 좌표 유지**)
  - 드래그 앤 드롭으로 노드 추가 지원

## React Flow Integration

React Flow provides the core canvas functionality for our node-based editor. We've extended it with custom node types and functionality.

### Group Node Implementation

Group nodes allow organizing nodes into logical collections. Key implementation details:

1. **Parent-Child Relationship**: 
   - Parent-child relationships are established using the `parentId` property in nodes
   - React Flow internally uses `parentNode` property for the same purpose
   - Both properties must be kept in sync to ensure consistent behavior
   - Group nodes are defined with type `'group'`
   - Child nodes must have relative positions calculated from the parent group
   - **Note:** The mechanism technically allows nesting group nodes (a group inside another group), however, this is not an officially supported or fully tested feature at this time. Unexpected behavior may occur with nested groups.

2. **Position Handling**:
   - When a node is added to a group, its position must be converted from absolute to relative
   - When a node is removed from a group, its position must be converted from relative to absolute
   - Position calculations are handled in `nodeUtils.ts` (`addNodeToGroup`, `removeNodeFromGroup`)

3. **Node Dragging**:
   - `handleNodeDragStop` in `useNodeHandlers.ts` handles parent-child relationships when nodes are dragged
   - `getIntersectingGroupId` detects when a node is dragged over a group
   - When a node is dragged out of a group, both `parentId` and `parentNode` properties must be explicitly cleared

4. **State Synchronization**:
   - Zustand store (via `useFlowStructureStore`) uses `parentId` property
   - React Flow internal state uses `parentNode` property
   - The `prepareNodesForReactFlow` function ensures both properties are correctly set based on `parentId`
   - When a node is removed from a group, both properties must be explicitly set to null/undefined
   - Regular state comparison checks both properties to detect and fix any inconsistencies

### Example Group Node Operations

```typescript
// Adding a node to a group
const updatedNodes = addNodeToGroup(nodeToAdd, groupNode, allNodes);

// Checking if a node is positioned inside a group
const isInside = isNodeInGroup(node, groupNode);

// Finding which group a dragged node intersects with
const intersectingGroupId = getIntersectingGroupId(draggedNode, allNodes);

// Preparing nodes for React Flow with parent-child relationship handling
const nodesForReactFlow = prepareNodesForReactFlow(nodes);
```