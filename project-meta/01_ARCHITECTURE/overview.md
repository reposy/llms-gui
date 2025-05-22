# LLMS-GUI 프로젝트 아키텍처 개요

> **2024.06 리팩토링 반영: 전체 구조/상태관리/네이밍/컴포넌트/실행/결과/가이드 최신화**

이 문서는 llms-gui 애플리케이션의 최신 기술적 아키텍처, 데이터 흐름, 주요 구성 요소에 대한 개요를 제공합니다. 모든 설명/예시는 실제 코드와 100% 일치합니다.

## 1. 설계 원칙 (Design Principles)

llms-gui 프로젝트는 다음과 같은 핵심 원칙을 기반으로 설계 및 개발됩니다. (상세: `../03_CONCEPTS/project_principles.md`)

*   **일관성 (Consistency)**
*   **단순성 (Simplicity)**
*   **단일 진입점/단일 책임 (Single Entry Point/Single Responsibility)**
*   **유지보수성 (Maintainability)**

## 2. 고수준 아키텍처 (High-Level Architecture)

llms-gui는 **React+TypeScript 기반 프론트엔드**와 **FastAPI 기반 백엔드**로 구성된 클라이언트-서버 구조입니다.

*   **Frontend:**
    - React+TypeScript, zustand 기반 상태관리
    - 각 페이지(FlowEditorPage, FlowExecutorPage)는 **자신만의 store/utils**만 사용 (cross-usage 금지)
    - 모든 상태변경은 zustand의 set/action 메서드만 사용 (직접 변경 금지)
    - 네이밍 통일(flowChainId 등), deprecated/legacy store/컴포넌트/필드/명칭 제거
    - import/export, 실행/결과, UI/UX, ResultDisplay 등 최신 구조/패턴 반영
    - 상세: [프론트엔드 아키텍처](./frontend_architecture.md)

*   **Backend:**
    - FastAPI, Python 기반 API 서버
    - 프론트엔드에서 직접 처리하기 어려운 작업(웹 크롤링, 파일, 외부 API 등) 담당
    - 상세: [백엔드 아키텍처](./backend_architecture.md)

## 3. 주요 상호작용 흐름

### 3.1. Flow Editor (플로우 편집)
1. 사용자는 **FlowEditorPage**에서 노드 기반 워크플로우를 시각적으로 설계/편집
2. 노드/엣지/설정/상태 등은 **useFlowEditorStore** 등 각자 store에 저장
3. 실행 시, **utils/flow/flowEditorUtils.ts** 등에서 실행 순서/컨텍스트 결정
4. 각 노드는 순서대로 실행, 결과/상태는 store에 저장, UI에 실시간 반영

### 3.2. Flow Executor (플로우 실행)
1. 사용자는 **FlowExecutorPage**에서 플로우 JSON import, 입력 데이터 제공, 실행 결과 확인
2. 모든 상태/입력/결과는 **useFlowExecutorStore**에서 관리
3. 실행/결과/상태/lastResults 등은 selector로 구독, UI에 실시간 반영
4. import/export, 전체 초기화, 결과 표시 등은 store action 및 utils로 일관 처리

## 4. 주요 기술 스택 (Key Technology Stack)

### 4.1. Frontend
- React (v18+), TypeScript, Zustand
- React Flow, shadcn/ui, Heroicons
- Vite, npm

### 4.2. Backend
- FastAPI, Python, asyncio, Pydantic
- httpx, Uvicorn, pip

## 5. 문서 최신화 안내
- 본 문서는 2024.06 리팩토링 이후 실제 코드/구조/네이밍/상태관리/컴포넌트/가이드와 100% 일치하도록 유지됩니다.
- legacy/과거 방식/혼동되는 설명은 모두 제거되었습니다.
- 예시/구조/가이드가 실제 코드와 다를 경우 반드시 문서를 최신 코드에 맞게 직접 업데이트해 주세요. 