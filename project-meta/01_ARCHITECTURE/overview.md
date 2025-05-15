# LLMS-GUI 프로젝트 아키텍처 개요

이 문서는 llms-gui 애플리케이션의 기술적인 아키텍처, 데이터 흐름, 주요 구성 요소에 대한 개요를 제공합니다.

## 1. 설계 원칙 (Design Principles)

llms-gui 프로젝트는 다음과 같은 핵심 원칙을 기반으로 설계 및 개발되었습니다. 상세 내용은 `../03_CONCEPTS/project_principles.md` 문서를 참고하십시오.

*   **일관성 (Consistency)**
*   **단순성 (Simplicity)**
*   **단일 진입점 (Single Entry Point)**
*   **유지보수성 (Maintainability)**

## 2. 고수준 아키텍처 (High-Level Architecture)

llms-gui는 다음과 같은 두 가지 주요 부분으로 구성된 클라이언트-서버 아키텍처를 따릅니다.

*   **Frontend (Client-Side):** React와 TypeScript로 구축된 웹 기반 사용자 인터페이스입니다. 사용자는 이 인터페이스를 통해 워크플로우를 시각적으로 설계하고, 노드를 설정하며, 실행 상태와 결과를 확인합니다. ([상세 프론트엔드 아키텍처](./frontend_architecture.md))
    *   **UI/UX 제공:**
        *   **Flow Editor (`/` 경로):** React Flow 라이브러리를 사용하여 노드 기반의 워크플로우 편집 환경을 제공합니다.
        *   **Flow Executor (`/executor` 경로):** 사용자가 JSON으로 export된 플로우를 업로드하고, 입력 데이터를 제공하여 실행 결과를 확인할 수 있는 간소화된 UI를 제공합니다.
    *   **노드 설정 관리**
    *   **상태 관리 (Zustand)**
    *   **프론트엔드 기반 노드 실행** (예: `HTML Parser` - 백엔드 코드 분석 후 최종 확정)
    *   **백엔드 통신**

*   **Backend (Server-Side):** Python FastAPI 프레임워크를 사용하여 구축된 API 서버입니다. 주로 프론트엔드에서 직접 처리하기 어렵거나 보안/자원 접근이 필요한 작업을 담당합니다. ([상세 백엔드 아키텍처](./backend_architecture.md))
    *   **외부 서비스 연동** (LLM, 외부 API, 웹 크롤링 등)
    *   **Flow Executor 지원** (백엔드 `main.py` 분석 후 `/api/execute-flow` 와 같은 실제 엔드포인트 명시)
    *   **보안 및 인증 (필요시)**
    *   **무거운 계산 처리 (필요시)**

### 2.1. 상호작용 (Flow Editor)

1.  사용자는 **Frontend UI (`/` 경로)**를 통해 플로우를 생성하고 편집합니다.
2.  노드 설정 및 플로우 구조는 **Frontend 상태 저장소 (Zustand)**에 저장됩니다.
3.  사용자가 플로우 실행을 트리거하면, **Frontend의 실행 로직** (`src/core/executionUtils.ts` 등)이 실행 순서를 결정합니다.
4.  각 노드는 순서대로 실행됩니다.
    *   **Frontend 기반 노드**: 관련 로직이 브라우저에서 직접 실행됩니다.
    *   **Backend 기반 노드**: Frontend는 필요한 데이터를 **Backend API**로 전송하고, Backend는 해당 작업을 수행한 후 결과를 다시 Frontend로 반환합니다.
5.  각 노드의 실행 상태와 결과는 **Frontend 상태 저장소 (Zustand)**에 업데이트됩니다.
6.  상태 변경은 **Frontend UI**에 반영되어 사용자에게 실시간으로 표시됩니다.

### 2.2. 상호작용 (Flow Executor)

1.  사용자는 **Frontend UI (`/executor` 경로)**를 통해 저장된 플로우 JSON 파일을 업로드합니다.
2.  사용자는 필요한 입력 데이터를 텍스트 또는 파일 형태로 제공합니다.
3.  실행 버튼을 클릭하면, Frontend는 플로우 JSON과 입력 데이터를 **Backend API**로 전송합니다.
4.  **Backend 서버**는 수신된 플로우 JSON을 해석하고, 제공된 입력 데이터를 사용하여 전체 워크플로우를 실행합니다.
    *   이 과정에서 백엔드는 필요에 따라 외부 서비스(LLM, 기타 API 등)와 연동합니다.
5.  모든 노드 실행이 완료되면, Backend는 최종 결과 또는 각 노드의 결과 모음을 Frontend로 반환합니다.
6.  Frontend는 수신된 결과를 **Flow Executor UI**에 표시합니다.

## 3. 주요 기술 스택 (Key Technology Stack)

### 3.1. Frontend

*   **UI 라이브러리:** React (v18+)
*   **언어:** TypeScript
*   **플로우 시각화 및 편집:** React Flow (@xyflow/react)
*   **상태 관리:** Zustand
*   **UI 컴포넌트:** shadcn/ui (Radix UI + Tailwind CSS 기반)
*   **아이콘:** Heroicons 또는 유사 라이브러리
*   **데이터 파싱/처리:** DOMParser (내장), Lodash (유틸리티)
*   **빌드 도구:** Vite
*   **패키지 매니저:** npm (또는 yarn - 프로젝트 확인 필요)

### 3.2. Backend

*   **웹 프레임워크:** FastAPI
*   **언어:** Python (v3.9+ - `requirements.txt` 또는 `Dockerfile`에서 버전 확인 필요)
*   **비동기 처리:** asyncio
*   **데이터 유효성 검사:** Pydantic
*   **HTML 파싱:** (`backend-fastapi-py/services/html_parser.py` 존재 확인. 만약 프론트엔드에서만 처리된다면 해당 내용 명시)
*   **HTTP 클라이언트:** httpx (외부 API 호출용 - 백엔드 코드에서 확인 필요)
*   **패키지 매니저:** pip ( (`requirements.txt` 사용 확인)
*   **서버 실행:** Uvicorn (일반적, `Dockerfile` 또는 실행 스크립트에서 확인) 