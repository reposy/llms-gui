📘 커서(CURSOR)를 위한 작업 가이드라인 (cursor-guidelines.md)

이 문서는 CURSOR가 프로젝트의 목적과 작업 방향을 명확히 이해하고 효율적으로 코드를 수정 및 관리할 수 있도록 돕기 위해 작성되었습니다.
당신은, CURSOR의 소스코드 파일을 조회할 수 있고, 수정할 수 있습니다. 파일을 요청하지 않고, 직접 진행하면 됩니다.
⸻

🧭 프로젝트 목표 및 방향성

이 프로젝트의 최종 목표는 블로그 체험단 포스팅과 같은 콘텐츠를 효율적으로 생성할 수 있는 시스템을 구축하는 것입니다. 이를 위해 다음과 같은 기능을 명확하게 구현해야 합니다.
	•	사용자가 제공한 여러 장의 이미지 파일을 Input Node로 업로드하면, 각각의 이미지가 개별적으로 처리되는 foreach 모드를 지원합니다.
	•	이미지 파일과 텍스트 데이터는 노드 간 연결을 통해 다른 노드(LLM Node, Output Node, Merger Node)로 자연스럽게 전달되어 처리됩니다.
	•	LLM Node는 이미지를 분석하고 요약을 생성하며, 이 과정에서 Ollama API 또는 OpenAI API와 같은 LLM을 활용합니다.
	•	Merger Node는 LLM에서 나온 결과물(요약, 텍스트 등)을 합쳐 최종 포스팅 내용을 생성합니다.
	•	동적 HTML 수집을 위한 WebCrawler Node를 개발하여 외부 콘텐츠 수집 및 활용 가능성을 확장합니다.

⸻

📌 핵심 기술 스택 및 관리 포인트
	•	상태 관리: Zustand를 사용하며, 노드 데이터(useNodeContentStore), 구조 및 선택 상태(useFlowStructureStore), 실행 그래프(useExecutionGraphStore)는 각각의 명확한 역할을 유지해야 합니다. **특히, 각 노드의 데이터, 설정 및 UI 상태는 `useNodeContentStore`를 통해 중앙 집중식으로 관리하는 것을 원칙으로 합니다.**
	•	IndexedDB: 사용자 파일과 노드 상태는 IndexedDB를 통해 관리됩니다. 저장되는 데이터의 키 구조는 명확하고 일관적이어야 합니다.
	•	파일 처리: 이미지 및 텍스트 파일 처리 시 반드시 경로 형태로 관리하며, 파일은 public/uploads 디렉토리에 저장됩니다.
	•	API 활용: LLM 호출 시 공식 문서를 정확히 참조하여 올바른 API 요청 형태를 유지합니다. (관련 로직: `src/services/`)

⚠️ 코드 수정 시 주의사항
	•	`Node.ts`의 `process(input)` 메서드는 반드시 다음 구조를 유지해야 합니다. (`src/core/Node.ts` 참조)
async process(input: any) {
  const result = await this.execute(input);
  if (result === null) return; // null일 경우, 자식 노드 실행 중단
  for (const child of this.getChildNodes()) {
    await child.process(result);
  }
}

	•	`InputNode.ts`의 실행 로직: (`src/core/InputNode.ts` 참조)
	•	foreach일 경우 개별 item을 자식 노드로 넘겨 처리합니다.
(items.forEach(item => child.process(item)))
	•	batch일 경우 전체 items 배열을 자식 노드에 한번에 넘깁니다.
(child.process(items))
	•	`LlmNode.ts`의 동작: (`src/core/LlmNode.ts` 참조)
	•	텍스트는 프롬프트에 {{input}} 형태로 주입합니다.
	•	비전 모드에서 입력이 파일 배열 또는 단일 파일일 경우, MIME 타입이 `image/*`인 `File` 객체만 식별하여 하위 서비스로 전달합니다. 실제 Base64 변환 및 API 호출 형식 구성은 서비스(`ollamaService`, `openaiService`)에서 담당합니다.
	•	비전 모드에서 입력이 이미지 파일(들)일 경우, 최종 결과 텍스트 앞에 해당 파일명(들)이 `[파일명.ext] ` 또는 `[파일1.jpg, 파일2.png] ` 형식으로 추가됩니다.

## 🔄 노드 실행 흐름과 상태 관리

노드 실행 및 상태 관리를 올바르게 구현하려면 다음 패턴을 따르세요 (`src/core/Node.ts`, `src/core/FlowExecutionContext.ts` 참조):

1. **실행 컨텍스트 활용**
   ```typescript
   // 노드 실행 시 컨텍스트를 통한 상태 업데이트
   async execute(input: any): Promise<any> {
     try {
       // 실행 중 상태로 표시
       this.context?.markNodeRunning(this.id);
       
       // 결과 처리 및 저장
       const result = await this.processLogic(input);
       this.context?.storeOutput(this.id, result);
       
       return result;
     } catch (error) {
       // 오류 처리
       this.context?.markNodeError(this.id, error.message);
       return null; // 실행 중단
     }
   }
   ```

2. **자식 노드 결정 방식**
   - 루트 노드는 시작점이며, 자식 노드를 통해 실행이 전파됩니다.
   - 자식 노드는 엣지 구조를 통해 결정됩니다: `source → target` (주로 `useExecutionGraphStore` 활용)
   - 각 노드의 결과값은 자식 노드의 입력으로 사용됩니다.

3. **디버깅 및 로깅 표준**
   - 모든 중요 단계는 `context.log()` 메서드를 사용하여 기록
   - 오류 발생 시 명확한 메시지와 함께 `markNodeError` 호출
   - 디버깅 데이터는 `context.storeNodeData()`로 저장

🚫 불필요한 코드 제거

프로젝트가 명확한 목적에 따라 움직이도록 다음 사항을 지속적으로 검토하고 불필요한 코드를 삭제합니다.
	•	컨텍스트(Context) 관리 및 전역 상태 사용 최소화 (단, `FlowExecutionContext`는 필수)
	•	필요 이상의 복잡한 유틸리티 함수 제거
	•	불필요하거나 중복된 Zustand 상태 변수 관리 제거 (특히 파생/중복 상태 정리)
	•	불필요한 추상화나 인터페이스 제거

🔍 디버깅 및 문제 해결 전략
	•	문제 발생 시 다음 항목을 우선적으로 점검합니다.
	•	IndexedDB 저장 및 로드 로직 (`src/utils/idbStorage.ts`)
	•	Zustand 상태 동기화 (`src/store/useFlowStructureStore`, `src/store/useNodeContentStore`, `src/store/useNodeStateStore` 등)
	•	Node 클래스의 프로세싱 흐름 (`src/core/Node.ts`의 `process`, `execute`)
	•	API 호출 형태 및 반환 데이터 처리 로직 (`src/services/*`)
	•	노드가 예상대로 작동하지 않는다면, 콘솔 로그(`context.log()`)를 적극적으로 활용하여 실행 단계별로 상태를 점검합니다.
	•	자주 발생하는 문제는 명확한 예외 처리로 대응하고, 추가적 로깅을 통해 관리합니다.

## 📋 노드 개발 체크리스트

새로운 노드를 개발하거나 기존 노드를 수정할 때 다음 체크리스트를 확인하세요 (`src/core/` 디렉토리 내 노드 클래스 참조):

1. **타입 안전성**
   - [ ] 노드 속성에 TypeScript 인터페이스 정의
   - [ ] property 접근 시 타입 체크/변환 구현
   - [ ] 입출력 형식 명확히 문서화

2. **실행 흐름**
   - [ ] execute() 메서드에서 명확한 오류 처리
   - [ ] 결과가 null일 때와 아닐 때 동작 검증
   - [ ] 상태 변경 메서드 호출 (markNodeRunning, markNodeSuccess, markNodeError)

3. **자식 노드 처리**
   - [ ] getChildNodes() 결과 확인
   - [ ] 자식 노드로의 데이터 전달 검증
   - [ ] 특수 로직(조건부 실행 등)이 있는 경우 테스트

4. **UI 통합**
   - [ ] 노드 실행 상태가 UI에 반영되는지 확인
   - [ ] 결과 표시가 올바른지 검증
   - [ ] NodeErrorBoundary 내에서 오류 발생 시 처리 확인

⸻
✨ 최종 기대 효과 (유스케이스)

이 시스템은 사용자가 간단히 이미지 파일을 제공하는 것만으로 자동화된 콘텐츠 생성 파이프라인을 구축하여, 블로그 포스팅을 매우 빠르고 정확하게 완성할 수 있도록 돕습니다. 또한, WebCrawler를 활용한 외부 콘텐츠 수집까지 가능하여 콘텐츠 생산의 유연성을 높일 것입니다.

⸻

위 가이드를 기반으로 CURSOR는 명확하게 정의된 요구사항과 목표를 참조하여 프로젝트를 진행하고 문제를 해결할 수 있습니다.