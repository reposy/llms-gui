# LLMS-GUI 노드(Node) 개요 (2024.06 리팩토링 반영)

> **2024.06 기준 최신화: 노드 구조/타입/실행/스토어/네이밍/컴포넌트/가이드 등 최신 구조/패턴 반영**

이 문서는 llms-gui 애플리케이션에서 사용되는 노드의 기본 개념, 공통 구조, 그리고 새로운 노드를 추가하는 방법에 대한 최신 개요를 제공합니다. 모든 설명/예시는 실제 코드와 100% 일치합니다.

## 1. 노드란?

llms-gui에서 **노드(Node)**는 워크플로우의 기본 빌딩 블록입니다. 각 노드는 특정 작업 단위를 나타내며, 데이터를 입력받아 처리하고 그 결과를 다음 노드로 전달합니다. 사용자는 노드들을 시각적으로 연결하여 복잡한 데이터 처리 파이프라인을 구성할 수 있습니다.

예를 들어, `Web Crawler` 노드는 웹 페이지의 HTML을 가져오고, `HTML Parser` 노드는 그 HTML에서 특정 정보를 추출하며, `LLM` 노드는 추출된 정보를 바탕으로 새로운 텍스트를 생성할 수 있습니다.

## 2. 모든 노드의 공통 구조 및 속성

- 모든 노드는 `src/core/Node.ts`의 추상 클래스 `Node`를 상속
- 주요 속성: `id`, `type`, `property`, `context` (실행 컨텍스트)
- 주요 메소드: `process`, `execute`, `getChildNodes`, `_log` 등
- **roots/leafs → rootIds/leafIds** 등 네이밍 통일
- 노드/엣지/설정/상태 등은 각자 zustand store에 저장, 직접 변경 금지 (set/action만 사용)

## 3. 노드 실행 컨텍스트 (`FlowExecutionContext`)

- 단일 플로우 실행의 전체 상태/맥락 관리
- 실행 상태/결과 저장, 노드 인스턴스 생성, 로깅 등 담당

## 4. 새로운 노드 추가하기 (개요)

- 핵심 로직 클래스: `src/core/` 내 Node/ExecutableNode 상속, execute 구현
- UI 컴포넌트: `src/components/nodes/` (캔버스 표시), `src/components/config/` (설정 패널)
- 노드 등록: `src/core/NodeRegistry.ts` 등에서 타입/클래스/컴포넌트 등록
- 타입 정의: 필요시 `src/types/nodes.ts` 등
- (선택) 백엔드 연동: 필요시 서비스/엔드포인트 구현
- 상세: [새 노드 추가 가이드](../04_GUIDES/adding_new_node.md)

## 5. 개별 노드 상세 가이드

- [HTML Parser 노드](./html_parser_node.md)
- [Web Crawler 노드](./web_crawler_node.md)
- [LLM 노드](./llm_node.md)
- [API 노드](./api_node.md)
- [Input 노드](./input_node.md)
- [Output 노드](./output_node.md)
- [Group 노드](./group_node.md)
- [JSON Extractor 노드](./json_extractor_node.md)
- [Conditional 노드](./conditional_node.md)
- [Merger 노드](./merger_node.md)

## 6. 문서 최신화 안내
- 본 문서는 2024.06 리팩토링 이후 실제 코드/구조/네이밍/상태관리/컴포넌트/가이드와 100% 일치하도록 유지됩니다.
- 예시/구조/가이드가 실제 코드와 다를 경우 반드시 문서를 최신 코드에 맞게 직접 업데이트해 주세요. 