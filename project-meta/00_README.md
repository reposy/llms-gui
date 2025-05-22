# Project Documentation (`project-meta`)

> **2024.06 대규모 리팩토링 반영**
> 
> - 모든 상태관리는 각 페이지별 zustand store로 분리, 네이밍 통일(flowChainId 등)
> - 비즈니스 로직은 store에서 분리되어 utils/로 이동
> - import/export, 실행/결과, UI/UX, 네이밍 등 최신 구조/패턴 반영
> - deprecated store/컴포넌트/필드/명칭/legacy 용어 완전 제거
> - 각 문서(아키텍처/개념/노드/가이드)도 최신 코드/구조/원칙에 맞게 업데이트됨

Welcome to the `project-meta` directory. This space contains essential documentation for developers, architects, and anyone looking to understand the design, components, and guiding principles of this application.

## Purpose

The documents herein aim to provide a clear, accurate, and maintainable source of truth regarding the project's architecture, core concepts, available node types, and development guides. This documentation is intended to evolve alongside the codebase.

## Navigating the Documentation

To help you find the information you need, the documentation is organized into the following main sections:

### 1. Architecture (`01_ARCHITECTURE/`)

Understand the high-level structure of the application, including its frontend and backend components, and the latest state management/store separation principles.

*   **[Architectural Overview](./01_ARCHITECTURE/overview.md)**: Start here for a general understanding of the project's architecture and design philosophy.
*   **[Frontend Architecture](./01_ARCHITECTURE/frontend_architecture.md)**: Details about the React-based frontend, zustand store 구조, 페이지별 분리, 네이밍 통일 등 최신 구조 반영.
*   **[Backend Architecture](./01_ARCHITECTURE/backend_architecture.md)**: Details about the FastAPI-based backend, including API design.

### 2. Nodes (`02_NODES/`)

Explore the various node types available in the application, which form the building blocks of workflows. All node docs are updated to reflect the latest execution/data flow, store 구조, naming, and UI/UX.

*   **[Nodes Overview](./02_NODES/overview.md)**: Learn about the general concept of nodes, their common structure, and how to add new ones. This overview also links to detailed documentation for each specific node type available.
    *   *(Individual node files like `html_parser_node.md`, `web_crawler_node.md`, etc., are linked from the overview.)*

### 3. Core Concepts (`03_CONCEPTS/`)

Dive deeper into the fundamental ideas and mechanisms that underpin the project. All concepts reflect the latest principles: 단일 진입점, store/utils 분리, 네이밍 통일, 상태관리 일관성 등.

*   **[Project Principles](./03_CONCEPTS/project_principles.md)**: The core philosophies (Consistency, Simplicity, Single Entry Point, Maintainability) that guide development, with 2024.06 리팩토링 기준 실천 방안 보강.
*   **[Data Flow and Execution](./03_CONCEPTS/data_flow_and_execution.md)**: How data is passed between nodes and how workflows are executed, with 최신 실행/반복/결과/상태관리 구조 반영.

### 4. Developer Guides (`04_GUIDES/`)

Practical, step-by-step instructions for common development tasks. All guides are updated for the latest store/utils 구조, import/export, 실행/결과, UI/UX, naming, and error handling.

*   **[Adding a New Node Type](./04_GUIDES/adding_new_node.md)**: A comprehensive guide for extending the system with new node functionalities, reflecting 최신 구조/패턴/네이밍/등록 방식.
*   **[Debugging Node Flows](./04_GUIDES/debugging_flows.md)**: Tips and techniques for troubleshooting workflows, with 최신 실행/상태관리/결과 표시/에러 핸들링 반영.

### 5. Deprecated Documents (`DEPRECATED/`)

This directory contains older versions of documentation that have been superseded by the refactored content in the directories above. They are kept for historical reference if needed but should not be considered current.

---

**문서 최신화 안내:**
- 2024.06 리팩토링 이후, 모든 문서는 실제 코드/구조/네이밍/상태관리/컴포넌트/가이드와 100% 일치하도록 유지됩니다.
- 문서와 코드가 불일치할 경우, 반드시 문서를 최신 코드에 맞게 직접 업데이트해 주세요.
- store/컴포넌트/유틸/네이밍/실행/결과/가이드 등 모든 예시와 설명은 실제 코드와 완전히 일치해야 합니다.

We encourage contributions to keep this documentation accurate and up-to-date. If you notice any discrepancies or areas for improvement, please feel free to update the relevant files. 