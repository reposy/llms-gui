# 스토어 및 타입 시스템 가이드

프로젝트의 상태 관리와 타입 시스템에 대한 가이드입니다.

## 타입 시스템

모든 노드 관련 타입은 `types/nodes.ts` 파일에 중앙 집중화되어 있습니다.

### 주요 타입 구조

1. **기본 타입**
   - `BaseNodeData`: 모든 노드 데이터의 기본 인터페이스 (React Flow 노드 데이터용)
   - `BaseNodeContent`: 모든 노드 컨텐츠의 기본 인터페이스 (상태 관리용)

2. **노드 데이터 타입** (`NodeData`)
   - React Flow 노드에 직접 전달되는 데이터 구조
   - 각 노드 타입별로 별도의 인터페이스가 정의됨 (예: `LLMNodeData`, `APINodeData` 등)
   - 항상 `type` 속성을 포함하여 노드 유형을 명시

3. **노드 컨텐츠 타입** (`NodeContent`)
   - 스토어에 저장되는 노드의 상태 정보
   - 각 노드 타입별로 별도의 인터페이스가 정의됨 (예: `LLMNodeContent`, `APINodeContent` 등)
   - `isDirty` 같은 UI 상태 정보 포함

4. **타입 매핑**
   - `NodeTypeMap`: 노드 타입 문자열과 노드 컨텐츠 타입 간의 매핑 제공

## 스토어 패턴

모든 스토어는 일관된 패턴을 따릅니다:

### 1. 스토어 정의

```typescript
export const useXXXStore = createWithEqualityFn<XXXState>()(
  (set, get) => ({
    // 상태 및 액션 정의
    data: initialData,
    
    setData: (newData) => set({ data: newData }),
    
    getData: () => get().data
  }),
  shallow
);
```

### 2. 직접 접근 함수

컴포넌트 외부에서 사용할 수 있는 함수:

```typescript
export const getData = () => useXXXStore.getState().getData();
export const setData = (data) => useXXXStore.getState().setData(data);
```

### 3. 컴포넌트용 커스텀 훅

컴포넌트에서 사용할 수 있는 메모이제이션된 셀렉터:

```typescript
export const useData = (id) => {
  return useXXXStore(
    useCallback(
      (state) => state.getData(id),
      [id]
    )
  );
};
```

## 주요 스토어

1. **useNodeContentStore**
   - 노드 컨텐츠(상태) 관리
   - `NodeContent` 타입 사용

2. **useFlowStructureStore**
   - 노드와 엣지의 구조 관리
   - `NodeData` 타입 사용

3. **useNodeStateStore**
   - 노드의 실행 상태 관리 (idle, running, success, error)
   - `NodeState` 타입 사용

4. **useExecutionGraphStore**
   - 노드 간의 관계와 실행 흐름 그래프 관리
   - `GraphNode` 타입 사용

## 모범 사례

1. **타입 정의**
   - 새로운 노드 타입을 추가할 때 `types/nodes.ts`에 `XxxNodeData`와 `XxxNodeContent` 인터페이스를 모두 정의
   - `NodeData`와 `NodeContent` 유니온 타입에 추가
   - `NodeTypeMap`에 새 매핑 추가

2. **스토어 접근**
   - 컴포넌트 내부: 항상 커스텀 훅 사용 (`useNodeState`, `useNodeContent` 등)
   - 컴포넌트 외부: 직접 접근 함수 사용 (`getNodeState`, `setNodeContent` 등)

3. **타입 안전성**
   - 스토어 함수 사용 시 정확한 타입 지정
   - 제네릭 타입을 활용하여 타입 안전성 확보 