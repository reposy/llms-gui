# LLMS-GUI 노드(Node) 개요

이 문서는 llms-gui 애플리케이션에서 사용되는 노드의 기본적인 개념, 공통 구조, 그리고 새로운 노드를 추가하는 방법에 대한 개요를 제공합니다.

## 1. 노드란?

llms-gui에서 **노드(Node)**는 워크플로우를 구성하는 가장 기본적인 빌딩 블록입니다. 각 노드는 특정 작업 단위를 나타내며, 데이터를 입력받아 처리하고 그 결과를 다음 노드로 전달하는 역할을 합니다. 사용자는 이러한 노드들을 시각적으로 연결하여 복잡한 데이터 처리 파이프라인 또는 자동화된 워크플로우를 구성할 수 있습니다.

예를 들어, `Web Crawler` 노드는 웹 페이지의 HTML을 가져오고, `HTML Parser` 노드는 그 HTML에서 특정 정보를 추출하며, `LLM` 노드는 추출된 정보를 바탕으로 새로운 텍스트를 생성할 수 있습니다.

## 2. 모든 노드의 공통 구조 및 속성

애플리케이션 내의 모든 노드는 `frontend-react-ts/src/core/Node.ts` 파일에 정의된 추상 클래스 `Node`를 상속받아 구현됩니다. 이 기본 `Node` 클래스는 다음과 같은 공통 속성과 메소드를 제공합니다:

### 2.1. 주요 속성

*   **`id: string`**: 각 노드 인스턴스를 식별하는 고유 ID입니다. (읽기 전용)
*   **`type: string`**: 노드의 종류를 나타내는 문자열입니다 (예: 'input', 'llm', 'web-crawler'). (읽기 전용)
*   **`property: Record<string, any>`**: 노드의 설정을 담는 객체입니다. 사용자가 UI의 설정 패널에서 입력하는 값들 (예: LLM 노드의 프롬프트, API 노드의 URL 등)이 여기에 저장됩니다. 하위 클래스에서 이 객체의 구체적인 형태를 정의할 수 있습니다.
*   **`context?: FlowExecutionContext`**: 노드 실행 시점에 주입되는 실행 컨텍스트입니다. 이 컨텍스트는 현재 플로우의 상태, 다른 노드의 정보, 결과 저장소 접근 등의 기능을 제공합니다. (protected 접근)

### 2.2. 주요 메소드

*   **`constructor(id: string, type: string, property: Record<string, any> = {})`**: 노드 인스턴스를 생성합니다.
*   **`async process(input: any, context: FlowExecutionContext): Promise<void>`**: 모든 노드의 실행 생명주기를 관리하는 핵심 메소드입니다. 이 메소드는 다음과 같은 작업을 순차적으로 수행합니다:
    1.  현재 노드에 실행 컨텍스트(`context`)를 설정합니다.
    2.  컨텍스트를 통해 현재 노드의 상태를 'running'으로 표시합니다.
    3.  하위 클래스에서 반드시 구현해야 하는 `execute(input: any)` 추상 메소드를 호출하여 실제 노드 로직을 실행합니다.
    4.  `execute` 메소드로부터 반환된 결과(`output`)를 처리합니다.
        *   결과가 `null` 또는 `undefined`가 아니면, 컨텍스트의 `storeOutput()`을 통해 결과를 저장하고, 노드 상태를 'success'로 표시합니다.
        *   결과가 배열인 경우, 각 항목을 개별적으로 저장할 수 있습니다.
    5.  `getChildNodes()`를 호출하여 현재 노드에 연결된 자식 노드들의 인스턴스를 가져옵니다.
    6.  가져온 각 자식 노드의 `process(output, currentContext)`를 호출하여 현재 노드의 출력을 다음 노드의 입력으로 전달하고 실행을 이어갑니다. (병렬 또는 순차 실행은 컨텍스트 및 플로우 실행 로직에 따라 달라질 수 있음)
    7.  오류 발생 시, 컨텍스트를 통해 노드 상태를 'error'로 표시하고 오류 메시지를 기록합니다.
*   **`abstract async execute(input: any): Promise<any>`**: 각 노드 타입에 특화된 실제 작업 로직을 구현하는 추상 메소드입니다. 하위 클래스(예: `LlmNode`, `WebCrawlerNode` 등)는 이 메소드를 반드시 오버라이드하여 해당 노드의 기능을 정의해야 합니다. 이 메소드는 입력을 받아 처리한 후 결과를 반환해야 합니다.
*   **`getChildNodes(): Node[]`**: 현재 노드에 연결된 직접적인 자식 노드들의 `Node` 인스턴스 배열을 반환합니다. 실행 컨텍스트에 저장된 노드 및 엣지 정보를 참조하고, `NodeFactory`를 통해 자식 노드 인스턴스를 가져오거나 생성합니다.
*   **`_log(message: string): void`**: 개발 모드에서 로깅을 위한 내부 헬퍼 메소드입니다.

## 3. 노드 실행 컨텍스트 (`FlowExecutionContext`)

`FlowExecutionContext`는 단일 플로우 실행의 전체적인 상태와 맥락을 관리하는 중요한 객체입니다. 노드가 `process` 메소드를 통해 실행될 때 주입되며, 노드는 이 컨텍스트를 통해 다음과 같은 작업을 수행할 수 있습니다:

*   노드 실행 상태 변경 (`markNodeRunning`, `markNodeSuccess`, `markNodeError`)
*   노드 실행 결과 저장 및 조회 (`storeOutput`, `getOutput`)
*   현재 플로우의 다른 노드 및 엣지 정보 접근
*   노드 인스턴스 생성을 위한 `NodeFactory` 접근
*   로깅

## 4. 새로운 노드 추가하기 (개요)

새로운 기능을 가진 노드를 llms-gui에 추가하는 과정은 대략 다음과 같습니다. 상세한 단계별 가이드는 `../04_GUIDES/adding_new_node.md` 문서를 참고하십시오.

1.  **핵심 로직 클래스 정의**: `src/core/` 디렉토리 내에 `Node` 또는 `ExecutableNode`를 상속받는 새로운 노드 클래스 파일(.ts)을 생성합니다. `execute` 메소드를 구현하여 노드의 핵심 기능을 작성합니다.
2.  **UI 컴포넌트 생성**: `src/components/nodes/` 디렉토리에 React Flow 캔버스에 표시될 노드의 시각적 UI 컴포넌트(.tsx)를 생성합니다.
3.  **설정 패널 컴포넌트 생성**: `src/components/config/` 디렉토리에 사용자가 노드 속성을 설정할 수 있는 UI 컴포넌트(.tsx)를 생성합니다.
4.  **노드 등록**: `src/core/NodeRegistry.ts` (또는 유사한 관리 파일)에 새로운 노드 타입, 핵심 로직 클래스, UI 컴포넌트, 설정 패널 컴포넌트 등을 등록합니다.
5.  **타입 정의**: 필요한 경우 `src/types/nodes.ts` 등에 새로운 노드 관련 타입을 추가합니다.
6.  **(선택적) 백엔드 API 연동**: 만약 노드가 백엔드 API를 호출해야 한다면, `src/core/ApiService.ts` 또는 별도의 서비스 파일을 통해 API 호출 로직을 구현하고, 백엔드에도 해당 API 엔드포인트를 개발해야 합니다.

이 개요는 llms-gui 노드 시스템의 기본적인 이해를 돕기 위한 것입니다. 각 노드의 구체적인 기능과 설정 옵션은 해당 노드의 개별 상세 문서에서 확인할 수 있습니다.

## 5. 개별 노드 상세 가이드

다음은 llms-gui에서 제공하는 각 노드 타입에 대한 상세 설명입니다.

*   [HTML Parser 노드](./html_parser_node.md)
*   [Web Crawler 노드](./web_crawler_node.md)
*   [LLM 노드](./llm_node.md)
*   [API 노드](./api_node.md)
*   [Input 노드](./input_node.md)
*   [Output 노드](./output_node.md)
*   [Group 노드](./group_node.md)
*   [JSON Extractor 노드](./json_extractor_node.md)
*   [Conditional 노드](./conditional_node.md)
*   [Merger 노드](./merger_node.md) 