프로젝트 개요 및 목적 (project-overview.md)

이 문서는 프로젝트의 목적과 구조, 주요 기능을 명확히 정의하여 일관된 개발 방향과 명확한 목표 설정을 돕습니다.

📌 프로젝트 목적

본 프로젝트는 다음의 두 가지 주요 목표를 가지고 있습니다.
	•	블로그 체험단 포스팅 자동화
	•	동적 HTML 크롤링을 통한 부가가치 창출

이 두 가지 기능은 독립적이지만, 추후 상호 연결될 수 있습니다.

⸻

🔑 핵심 기능 및 구조

본 프로젝트는 객체 지향적이고, 각 노드가 독립적인 역할을 수행하는 Flow 기반의 실행 구조로 이루어져 있습니다.

각 노드는 자체적으로 execute() 메서드를 가지고 있으며, 이를 통해 명확하고 단순한 실행 구조를 유지합니다.

1. 노드(Node)의 구조

모든 노드는 다음 구조를 따릅니다:
abstract class Node {
  id: string;
  type: string;
  property: Record<string, any>;

  constructor(id: string, type: string, property: Record<string, any>);

  async execute(input: any): Promise<any>;
}
	•	모든 노드는 execute() 메서드를 통해 독립적으로 동작합니다.
	•	노드 간 데이터 전파는 부모 노드의 execute() 결과가 자식 노드의 입력으로 전달됩니다.
    🚀 주요 노드 타입 정의
## 🚀 주요 노드 타입 정의

| 노드 타입      | 목적 및 책임                                                                 | 입력 예시                             | 출력 예시                             |
|----------------|------------------------------------------------------------------------------|----------------------------------------|----------------------------------------|
| **Input**      | 텍스트 또는 파일 목록(이미지 포함)을 입력받아, 이를 자식 노드로 전달합니다.      | `["image1.jpg", "image2.png"]`         | 동일 배열을 그대로 전달                |
| **LLM**        | 프롬프트 기반으로 LLM(OpenAI, Ollama 등)을 호출하여 텍스트를 생성합니다.          | 프롬프트(`{{input}}` 삽입 가능)         | 생성된 텍스트                          |
| **Output**     | 최종 결과물을 포맷(JSON/Text)에 따라 표시하거나 저장합니다.                       | 텍스트 또는 JSON 데이터                 | UI 출력 및 파일 다운로드               |
| **Merger**     | 여러 입력을 배열 형태로 합쳐서 자식 노드로 전달합니다.                           | `["요약1", "요약2"]`                    | `[ "요약1", "요약2" ] 그대로 전달       |
| **WebCrawler** | 동적 HTML 콘텐츠를 가져와서 처리합니다.                                         | URL 또는 설정                          | 크롤링한 HTML 또는 텍스트 추출         |


🔄 Input 노드의 실행 로직 명확화

Input 노드는 다음의 두 가지 모드로 동작합니다.
	•	Batch Mode
	•	입력받은 배열(items)을 한번에 자식 노드에 전달합니다.
	•	사용 예: 여러 이미지의 URL을 한번에 전달
	•	Foreach Mode
	•	배열의 각 항목을 개별적으로 자식 노드에 전달합니다.
	•	사용 예: 각 이미지별로 독립적인 요약 실행


구현 예시 코드 (execute() 내부)
async execute(input: any): Promise<any> {
  if (this.property.iterateEachRow) {
    for (const item of this.property.items) {
      for (const child of this.getChildNodes()) {
        await child.process(item);
      }
    }
    return null;  // chaining 중단
  } else {
    for (const child of this.getChildNodes()) {
      await child.process(this.property.items);
    }
    return this.property.items;  // chaining 계속됨
  }
}

🖥️ LLM 노드 (Text & Vision)

LLM 노드는 프롬프트 텍스트와 이미지를 모두 처리할 수 있으며, 이를 통해 다음과 같은 작업을 수행합니다:
	•	이미지 요약 생성
	•	블로그 포스트 콘텐츠 생성
	•	체험단 리뷰 문장 생성 등

프롬프트 처리 예시
	•	일반 텍스트 모드:
이미지에 대한 상세한 리뷰를 작성하세요:
{{input}}
	•	비전 모드 (이미지 포함):
LlmNode는 Vision 모드에서 입력받은 이미지 File 객체를 하위 서비스(Ollama, OpenAI 등)로 전달합니다. 각 서비스는 전달받은 File 객체를 해당 API 요구사항에 맞게 Base64 인코딩 및 포맷팅하여 처리합니다.
// ollama.chat({
//   model: 'llama3.2-vision',
//   messages: [{
//     role: 'user',
//     content: '이 이미지를 묘사하고 리뷰 문장을 작성하세요.',
//     images: ['uploads/image1.jpg'] // <-- 이 방식은 더 이상 LlmNode에서 직접 사용하지 않음
//   }]
// });

🌐 WebCrawler 노드 (동적 HTML 지원)
	•	Puppeteer 등과 연동하여 동적 컨텐츠를 가져옵니다.
	•	HTML 컨텐츠를 텍스트 또는 JSON 형태로 추출하여 후속 노드에 전달합니다.
📦 블로그 체험단 포스트 생성 Flow 예시

체험단 포스트 자동화를 위한 노드 체인의 이상적인 구조입니다.
Input (foreach 모드: 이미지 목록)
    └─ LLM (비전 모드로 이미지 요약 생성)
        └─ Merger (이미지 별 요약을 한데 모음)
            └─ LLM (모아진 요약을 기반으로 전체 포스팅 생성)
                └─ Output (최종 포스팅 결과를 확인 및 다운로드)
이 구조를 통해 이미지로부터 최종 포스팅까지 자동화가 가능합니다.

⸻

## 🔄 노드 실행 흐름 및 라이프사이클

### 실행 흐름 (Flow Execution)

이 프로젝트의 노드 실행 흐름은 다음과 같은 원칙을 따릅니다:

1. **플로우 시작과 초기화**
   - 실행은 항상 루트 노드(들)에서 시작합니다.
   - 각 실행은 고유한 `executionId`를 가진 `FlowExecutionContext`에서 관리됩니다.
   - 실행 그래프는 노드와 엣지를 기반으로 구성됩니다.

2. **노드 실행 프로세스**
   - `Node.process(input)`: 전체 실행 흐름 관리 (부모 → 자식 전파)
   - `Node.execute(input)`: 각 노드 타입의 고유 로직 실행 
   - 노드 실행 중 상태는 `markNodeRunning`, `markNodeSuccess`, `markNodeError`를 통해 관리

3. **자식 노드 결정 방식**
   - 동적 방식: 현재 엣지 구조에 따라 `source → target` 관계로 자식 찾기
   - 정적 방식: 미리 저장된 `childIds`를 통해 자식 참조
   - 결과값이 `null`이면 더 이상 자식 노드로 전파되지 않음

4. **결과 저장 및 관리**
   - `storeOutput(nodeId, output)`: 실행 컨텍스트에 결과 저장
   - 결과는 UI에 표시하기 위해 `NodeContentStore`에도 저장
   - 노드 상태는 중앙 저장소에서 관리되어 UI와 동기화

### 노드 실행 상태 관리

각 노드는 다음 상태 중 하나를 가집니다:
- **idle**: 아직 실행되지 않음
- **running**: 실행 중
- **success**: 성공적으로 실행 완료
- **error**: 오류 발생

상태 관리는 `FlowExecutionContext`를 통해 다음 메서드로 이루어집니다:
```typescript
context.markNodeRunning(nodeId);
context.markNodeSuccess(nodeId, result);
context.markNodeError(nodeId, errorMessage);
```

### 노드 구현 시 고려사항

새 노드 타입을 구현할 때는 다음 사항을 고려해야 합니다:

1. **execute() 메서드 구현**
   - 입력을 받아 처리하고 결과 반환
   - null 반환 시 자식 노드 실행 중단됨

2. **상태 저장**
   - 결과는 `context.storeOutput(this.id, result)` 호출로 저장
   - 디버깅 정보는 `context.storeNodeData(this.id, data)` 활용

3. **자식 노드 처리**
   - `getChildNodes()`의 결과에 따라 실행 흐름 결정
   - 특수 노드(Conditional, Group 등)는 필요에 따라 이 메서드 재정의

4. **오류 처리**
   - 실행 중 발생한 오류는 적절히 캡처하여 `markNodeError` 사용
   - 노드 UI는 `NodeErrorBoundary`로 감싸 오류 표시

⸻

📌 프로젝트 구조 최적화 방침
	•	불필요한 Context나 복잡한 상태 관리를 제거하고 각 노드는 가능한 Stateless하게 유지됩니다.
	•	Zustand 스토어 사용 시 useNodeContentStore.ts를 잘 정리하여 개별 노드 상태 관리 로직을 분리하는 것을 권장합니다.

⸻

🚩 프로젝트 개발 시 유의사항
	•	모든 노드는 최대한 단순하게 유지되어야 합니다.
	•	각 노드의 책임을 명확히 분리하여, 유지보수가 쉽고 확장 가능성을 유지합니다.
	•	실행 오류 및 예외 처리는 NodeErrorBoundary를 통해 관리하여 전체 흐름에 영향 없도록 유지합니다.
	•	console.log 등으로 명확한 로깅을 통해 각 노드의 상태를 모니터링할 수 있도록 합니다.

## 🔧 신규 노드 개발 가이드

새로운 노드를 개발할 때는 다음 템플릿을 참고하세요:

```typescript
import { Node } from '../core/Node';
import { FlowExecutionContext } from '../core/FlowExecutionContext';

interface MyNodeProperty {
  // 노드 속성 정의
  label: string;
  // 필요한 기타 속성들
}

export class MyNode extends Node {
  // 타입 명시로 TypeScript 지원 강화
  declare property: MyNodeProperty;

  constructor(id: string, property: Record<string, any>, context?: FlowExecutionContext) {
    super(id, 'my-node-type', property, context);
  }

  async execute(input: any): Promise<any> {
    try {
      // 1. 노드가 실행 중임을 표시
      this.context?.markNodeRunning(this.id);
      this.context?.log(`${this.type}(${this.id}): Executing with input: ${JSON.stringify(input).substring(0, 100)}`);

      // 2. 노드 고유의 로직 구현
      // ...노드 처리 로직...
      const result = "처리 결과";

      // 3. 결과 저장 및 반환
      if (this.context) {
        this.context.storeOutput(this.id, result);
        // 디버깅 정보도 저장
        this.context.storeNodeData(this.id, {
          inputSummary: typeof input === 'object' ? Object.keys(input).join(', ') : typeof input,
          timestamp: new Date().toISOString()
        });
      }

      return result;
    } catch (error) {
      // 4. 오류 처리
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context?.log(`${this.type}(${this.id}): Error: ${errorMessage}`);
      this.context?.markNodeError(this.id, errorMessage);
      
      // null 반환으로 실행 중단 또는 다른 값 반환으로 계속 진행 선택
      return null;
    }
  }
}
```

### 주요 구현 포인트

1. **속성 타입 정의**: 노드 속성에 TypeScript 인터페이스 정의
2. **로깅**: 실행 단계별로 명확한 로그 메시지 작성
3. **상태 관리**: 실행 중/성공/실패 상태 적절히 관리
4. **결과 저장**: `storeOutput`으로 결과 저장, UI 동기화
5. **오류 처리**: try-catch로 예외 처리, 상태 업데이트

⸻

📝 마무리 및 향후 방향성

본 프로젝트는 위의 명확한 구조와 목적을 바탕으로 블로그 콘텐츠 자동화와 동적 웹 크롤링 기능을 점진적으로 개발해 나갈 것입니다.

각 개발 단계는 커서와 ChatGPT를 활용하여, 빠른 프로토타이핑과 효과적인 디버깅을 병행하며 진행될 예정입니다.

---

## 🛠️ 노드별 실행 및 체이닝 규칙 (실행 로직 가이드)

### LLM 노드
- **Text 모드:**
  - input을 `{{input}}`에 치환하여 프롬프트를 완성, LLM API 호출
- **Vision 모드:**
  - 입력에서 이미지 File 객체를 식별하여 하위 서비스로 전달. 서비스 단에서 Base64 변환 및 API 호출 형식 구성.
  - **출력:** 입력이 단일 이미지 파일이면 응답 앞에 `[파일명.ext] `이, 이미지 파일 배열이면 `[파일1.jpg, 파일2.png] `이 추가됩니다.

### Input 노드
- input이 있다면 process(input)에서 items에 추가
- **Batch 모드:**
  - execute() → return this.items
  - childNodes.forEach(child => await child.process(result))로 체이닝
- **ForEach 모드:**
  - items.forEach(item => childNodes.forEach(child => await child.process(item)))
  - return null (Node.ts의 process에서 추가 체이닝 방지)

### Output 노드
- execute(input) 시 결과물을 표시하고, return input (chaining 유지)

### Merger 노드
- execute(input) 시 this.items에 input 추가, return this.items (누적 배열 전달)

### API, Crawler 노드
- execute(input) 시 API 호출 결과(json)를 그대로 리턴 (input은 현재 무시)

### JSON Extractor 노드
- execute(input) 시 input이 json 문자열이면 지정 속성값 리턴
- 값이 없거나 json이 아니면 null 또는 안내 메시지 리턴

### Conditional 노드
- execute(input) 시 조건이 참이면 오른쪽 child, 거짓이면 아래쪽 child로 체이닝

### Group 노드
- execute(input) 시 자신이 포함한 루트노드들(childNodes) 모두에 process(input) 호출
- Group 노드가 중복 실행되지 않도록 주의

### 전체 플로우 실행
- 화면 우상단 '플로우 실행'은 실행 가능한 모든 루트노드를 실행
- Group 노드는 중복 실행 방지

---

| 노드 타입      | 실행/체이닝 규칙 요약 |
|----------------|----------------------|
| **Input**      | Batch: 전체 items → child, ForEach: 각 item → child, ForEach는 return null로 추가 체이닝 방지 |
| **LLM**        | Text: {{input}} 치환. Vision 모드: 입력에서 이미지 File 객체를 식별하여 하위 서비스로 전달 (서비스에서 Base64 변환). 입력이 이미지 파일(들)일 경우 응답 텍스트 앞에 해당 파일명(들)이 `[...]` 형태로 추가됨. |
| **Output**     | input 표시 후 return input (chaining 유지) |
| **Merger**     | input 누적 후 전체 배열 return |
| **API/Crawler**| input 무시, API 결과 json return |
| **JSON Extractor** | input이 json이면 속성값, 아니면 null/안내 |
| **Conditional**| 조건 참: 오른쪽 child, 거짓: 아래쪽 child |
| **Group**      | 포함 루트노드들에 process(input), 중복 실행 방지 |

---

이 가이드라인은 실제 구현과 논의된 내용을 바탕으로 지속적으로 업데이트됩니다.
