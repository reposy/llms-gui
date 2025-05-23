# 데이터 흐름 및 실행 (2024.06 리팩토링 반영)

> **2024.06 기준 최신화: 데이터 흐름/실행/상태관리/스토어/네이밍/실행/결과/가이드 등 최신 구조/패턴 반영**

이 문서는 애플리케이션 내에서 노드 간 데이터 전달, 플로우/체인 실행, 상태관리, 결과 표시 등 전체 실행 메커니즘을 실제 코드와 100% 일치하게 설명합니다.

## 1. 데이터 흐름

- 모든 노드/엣지/설정/상태 등은 각자 zustand store에 저장, 직접 변경 금지 (set/action만 사용)
- roots/leafs → rootIds/leafIds 등 네이밍 통일
- 입력/출력/실행/결과 등은 store action 및 utils로만 처리
- import/export, 실행/결과, UI/UX 등도 store/utils/action으로 일관 처리

## 2. 실행 모델

- 각 페이지(FlowEditorPage, FlowExecutorPage)는 자신만의 store/utils만 사용 (cross-usage 금지)
- 실행/결과/상태/lastResults 등은 selector로 구독, 불필요한 리렌더 방지
- 실행 컨텍스트(FlowExecutionContext)에서 실행 순서/상태/결과 관리
- 실행 결과는 ResultDisplay 등에서 outputs only/full JSON/markdown 등 다양한 방식으로 표시

## 3. import/export 및 상태 일관성

- FlowChainListView 등에서 import/export, 전체 초기화, 유효성 검증 등은 store action 및 utils로만 처리
- 상태 초기화/불변성 보장, deprecated/legacy 용어/구조/필드/컴포넌트 완전 제거

## 4. 문서 최신화 안내
- 본 문서는 2024.06 리팩토링 이후 실제 코드/구조/네이밍/상태관리/컴포넌트/가이드와 100% 일치하도록 유지됩니다.
- 예시/구조/가이드가 실제 코드와 다를 경우 반드시 문서를 최신 코드에 맞게 직접 업데이트해 주세요.

## 데이터 흐름

애플리케이션의 핵심은 노드가 데이터를 처리하고 후속 노드로 전달하는 과정을 중심으로 이루어집니다. 이 흐름을 이해하는 것은 워크플로우를 구축하고 디버깅하는 데 매우 중요합니다.

### 데이터 패킷

데이터는 일반적으로 노드 간에 구조화된 형식, 주로 JSON 객체로 흐릅니다. 한 노드의 출력은 체인에서 다음 연결된 노드의 입력으로 사용됩니다.

*   **노드 출력:** 각 노드는 실행 시 출력을 생성합니다. 이 출력은 단일 데이터 조각, 항목 모음 또는 흐름을 제어하는 신호일 수 있습니다.
*   **노드 입력:** 노드는 특정 입력 유형을 허용하도록 설계되었습니다. 한 노드의 출력을 다른 노드의 입력에 연결하면 데이터 경로가 설정됩니다.

### 공유 아이템 vs. 개별 아이템

`Input Node`(입력 노드)는 데이터 컬렉션을 처리하는 두 가지 주요 방법을 제공합니다:

*   **공유 아이템 (Shared Items):** "공유 아이템"으로 구성된 데이터는 다운스트림 노드에서 집합적인 데이터셋으로 사용할 수 있게 됩니다. 이는 일반적으로 여러 노드 또는 `Group Node`(그룹 노드) 내의 여러 반복에서 참조될 수 있는 정적 데이터 컬렉션입니다.
*   **개별 아이템 (Individual Items):** `Input Node`가 "개별 아이템" 목록에 대해 작동할 때, 특히 "ForEach" 모드에서는 각 아이템이 개별적으로 처리되어 체인을 따라 하나씩 전달됩니다.

### 데이터 병합

`Merger Node`(병합 노드)는 여러 업스트림 분기에서 데이터를 통합하는 데 핵심적인 역할을 합니다:

*   여러 노드로부터 입력을 받습니다.
*   연결된 업스트림 노드 중 하나가 출력을 생성할 때마다 `Merger Node`는 모든 소스에서 현재 사용 가능한 모든 입력을 가져와 컬렉션을 출력합니다. 이를 통해 데이터가 사용 가능해짐에 따라 동적으로 데이터를 집계할 수 있습니다.

## 실행 모델

노드 플로우의 실행은 프론트엔드에서 관리되며, 특정 작업은 API 호출을 통해 백엔드로 오프로드될 수 있습니다 (예: `Web Crawler Node`).

### 순차 실행

기본적으로 플로우의 노드는 순차적으로 실행됩니다. 애플리케이션은 하나의 노드를 처리한 다음 해당 출력을 가져와 다음 연결된 노드로 전달하는 방식으로 진행됩니다.

### 실행 모드 (Input Node)

`Input Node`는 실행 패턴에 큰 영향을 미칩니다:

*   **배치 모드 (Batch Mode):** ("개별 아이템"에서 가져온 것과 같은) 모든 데이터 아이템이 단일 배치로 처리됩니다. 전체 컬렉션이 다음 노드로 전달됩니다.
*   **ForEach 모드:** `Input Node`는 "개별 아이템"을 반복합니다. 각 아이템에 대해 다운스트림 노드 체인의 실행을 트리거합니다. 이를 통해 각 아이템을 독립적으로 처리할 수 있습니다.

### 그룹 실행 (Group Node)

`Group Node`를 사용하면 하위 플로우를 만들고 해당 실행을 반복할 수 있습니다:

*   내부 노드 집합을 캡슐화합니다.
*   일반적으로 데이터셋을 입력으로 받습니다 (예: `Input Node` 또는 다른 업스트림 노드에서).
*   이 데이터셋을 반복하고 데이터셋의 각 아이템에 대해 그룹 내에 포함된 내부 노드 시퀀스를 실행합니다. 이는 컬렉션의 각 요소에 일련의 작업을 적용하는 데 강력합니다.

### 조건부 실행 (Conditional Node)

`Conditional Node`(조건부 노드)는 워크플로우에서 분기를 활성화합니다:

*   입력 데이터를 기반으로 조건을 평가합니다.
*   조건의 결과(참 또는 거짓)에 따라 실행 흐름을 두 개의 가능한 다운스트림 분기 중 하나로 보냅니다. 이를 통해 데이터를 기반으로 동적 경로를 설정할 수 있습니다.

### 프론트엔드 오케스트레이션

노드 실행 파이프라인의 기본 오케스트레이션은 프론트엔드에서 발생합니다. 프론트엔드 UI를 통해 사용자는 노드 그래프를 구성할 수 있으며 프론트엔드 로직은 다음을 담당합니다:

*   노드 연결을 기반으로 실행 순서 결정.
*   클라이언트 측 노드 간에 데이터가 전달될 때 데이터 관리.
*   백엔드 기반 노드(예: `Web Crawler Node`)에 대한 API 호출 시작 및 해당 응답 처리.
*   노드 실행 상태 및 결과를 반영하도록 UI 업데이트.

### 새 노드 추가

`02_NODES/overview.md` 및 `04_GUIDES/adding_new_node.md`에 자세히 설명된 대로 새 노드를 추가할 때는 이 데이터 흐름 및 실행 패러다임에 맞게 설계하는 것이 중요합니다. 여기에는 명확한 입력/출력 데이터 구조를 정의하고 프론트엔드의 오케스트레이션 로직 내에서 예측 가능하게 작동하는지 확인하는 것이 포함됩니다. 