# 가이드: 새 노드 타입 추가하기

이 가이드는 애플리케이션에 새로운 사용자 정의 노드 타입을 추가하는 방법에 대한 단계별 지침을 개발자에게 제공합니다. 노드는 워크플로우의 기본 구성 요소이며, 새로운 노드 타입으로 시스템을 확장하면 유연성과 기능성을 크게 향상시킬 수 있습니다.

노드에 대한 일반적인 개념적 개요는 `02_NODES/overview.md`를, 기본 클래스 구현은 `frontend-react-ts/src/core/Node.ts`를 참조하십시오.

## 1. 사전 준비 사항

시작하기 전에 다음에 대한 충분한 이해가 있는지 확인하십시오:

*   기존 노드 아키텍처 및 프론트엔드/백엔드 구성 요소의 역할.
*   TypeScript (프론트엔드 노드용) 및 Python/FastAPI (노드에 백엔드 로직이 필요한 경우).
*   `03_CONCEPTS/data_flow_and_execution.md`에 설명된 프로젝트의 데이터 흐름 및 실행 모델.
*   `frontend-react-ts/src/core/Node.ts`의 기본 `Node` 클래스 구조. 속성, 입력, 출력 및 처리 로직이 정의되는 방식과 같은 핵심 사항을 포함합니다.

## 2. 노드 설계

새 노드의 목적과 기능을 명확하게 정의하십시오:

*   **어떤 문제를 해결할 것인가?**
*   **어떤 데이터를 소비(입력)할 것인가?** 각 입력 소켓에 대한 데이터 타입과 목적을 명시하십시오.
*   **어떤 데이터를 생산(출력)할 것인가?** 각 출력 소켓에 대한 데이터 타입과 목적을 명시하십시오.
*   **순수 프론트엔드 기반으로 할 것인가, 아니면 백엔드 상호작용이 필요한가?**
    *   **프론트엔드 기반:** 모든 로직이 사용자 브라우저에서 상주하고 실행됩니다 (예: `HTML 파서 노드`, `JSON 추출기 노드`).
    *   **백엔드 상호작용:** 노드가 처리를 위해 백엔드에 API 호출을 합니다 (예: `웹 크롤러 노드`).
*   **어떤 설정 가능한 세팅이 필요한가?** (예: `API 노드`의 API URL, `JSON 추출기 노드`의 경로).

## 3. 노드 구현 (프론트엔드)

대부분의 노드는 백엔드 API를 호출하더라도 상당한 프론트엔드 구성 요소를 갖습니다.

### 3.1. 노드 클래스 생성

1.  `frontend-react-ts/src/nodes/` 내의 적절한 디렉토리로 이동합니다 (또는 노드 타입에 논리적으로 맞는 경우 새 하위 디렉토리 생성).
2.  새로운 TypeScript 파일을 만듭니다 (예: `my_new_node.ts`).
3.  `../../core/Node`에서 가져온 기본 `Node` 클래스를 확장하는 클래스를 정의합니다.

    ```typescript
    import {{ Node, NodeProps, /* core의 다른 관련 타입들 */ }} from '../../core/Node';
    import {{ /* 다른 필요한 타입들 */ }} from '../../core/Socket';

    export interface MyNewNodeProps extends NodeProps {
      // 노드 설정을 위한 특정 속성 정의
      setting1?: string;
      setting2?: number;
    }

    export class MyNewNode extends Node<MyNewNodeProps> {
      static nodeType = 'MyNewNode'; // 고유 식별자
      static nodeName = '새 노드';
      static nodeIcon = 'path/to/your/icon.svg'; // 또는 Material UI 아이콘 이름
      static nodeDescription = '이 노드가 수행하는 작업에 대한 간략한 설명입니다.';

      constructor(props: MyNewNodeProps) {
        super(props);
        // 필요한 경우 설정의 기본값 초기화
        this.settings.setting1 = props.settings.setting1 || 'default_value';
        this.settings.setting2 = props.settings.setting2 || 42;

        // 입력 소켓 정의
        this.addInputSocket({{ name: 'input1', type: 'string', label: '입력 데이터' }});
        // 출력 소켓 정의
        this.addOutputSocket({{ name: 'output1', type: 'object', label: '처리된 데이터' }});
      }

      // 선택 사항: 사용자 정의 설정 유효성 검사 또는 업데이트가 필요한 경우 재정의
      // updateSettings(newSettings: Partial<MyNewNodeProps['settings']>) {
      //   super.updateSettings(newSettings);
      //   // 설정이 업데이트된 후 사용자 정의 로직 수행
      // }

      async process(): Promise<Record<string, any>> {
        const inputData = await this.getInputData('input1');

        if (!inputData) {
          // 누락된 입력 데이터 처리: 오류 발생, 기본값 반환 등
          console.warn('MyNewNode: 입력 데이터가 없습니다.');
          return {{}};
        }

        // --- 노드의 핵심 로직 ---
        let result = {{}};
        try {
          // 예: this.settings.setting1 및 this.settings.setting2를 기반으로 inputData 처리
          // 백엔드 노드인 경우 여기서 API 호출을 수행합니다.
          console.log('MyNewNode에서 설정으로 처리 중:', this.settings);
          console.log('입력 데이터:', inputData);

          // 실제 처리를 위한 플레이스홀더
          result = {{ processedValue: `처리됨: ${{inputData}} (설정: ${{this.settings.setting1}})` }};

        } catch (error) {
          console.error('MyNewNode 처리 중 오류:', error);
          // 선택적으로 노드에 오류 상태를 설정하거나 다시 throw
          throw error;
        }
        // --- 핵심 로직 종료 ---

        return {{ output1: result }};
      }
    }
    ```

### 3.2. 노드 UI 컴포넌트 생성 (React)

1.  동일한 디렉토리 또는 `components` 하위 디렉토리에 해당하는 React 컴포넌트(예: `MyNewNodeComponent.tsx`)를 만듭니다.
2.  이 컴포넌트는 워크플로우 편집기에서 노드와 해당 설정 패널을 렌더링합니다.
    *   **노드 표현:** 캔버스에 노드가 표시되는 방식 (종종 이름, 아이콘, 소켓을 표시하는 일반 노드 래퍼에 의해 처리됨).
    *   **설정 패널:** 노드 클래스에 정의한 설정 가능한 `settings`에 대한 UI 요소(입력 필드, 드롭다운 등)를 만듭니다. 이 패널은 일반적으로 노드가 선택될 때 표시됩니다.

    ```tsx
    // 예시: MyNewNodeSettings.tsx (간단화된 설정 패널 컴포넌트)
    import React from 'react';
    // import {{ TextField, /* 다른 MUI 컴포넌트 */ }} from '@mui/material';
    // 종종 컨텍스트나 props를 통해 노드 설정을 가져오고 설정하는 방법이 있다고 가정

    interface MyNewNodeSettingsProps {
      nodeId: string;
      settings: {{ setting1?: string; setting2?: number }};
      onSettingsChange: (newSettings: {{ setting1?: string; setting2?: number }}) => void;
    }

    export const MyNewNodeSettings: React.FC<MyNewNodeSettingsProps> = ({{ nodeId, settings, onSettingsChange }}) => {
      const handleSetting1Change = (event: React.ChangeEvent<HTMLInputElement>) => {
        onSettingsChange({{ ...settings, setting1: event.target.value }});
      };

      const handleSetting2Change = (event: React.ChangeEvent<HTMLInputElement>) => {
        onSettingsChange({{ ...settings, setting2: Number(event.target.value) }});
      };

      return (
        <div>
          {/* <TextField
            label="설정 1"
            value={{settings.setting1 || ''}}
            onChange={{handleSetting1Change}}
            fullWidth
            margin="normal"
          />
          <TextField
            label="설정 2"
            type="number"
            value={{settings.setting2 || ''}}
            onChange={{handleSetting2Change}}
            fullWidth
            margin="normal"
          /> */}
          <p>새 노드 설정 UI (ID: {{nodeId}})</p>
          <p>설정 1: <input type="text" value={{settings.setting1 || ''}} onChange={{handleSetting1Change}} /></p>
          <p>설정 2: <input type="number" value={{settings.setting2 || ''}} onChange={{handleSetting2Change}} /></p>
        </div>
      );
    };
    ```

### 3.3. 노드 등록

새 노드 타입은 애플리케이션에 등록되어야 노드 팔레트에 나타나고 워크플로우에 추가될 수 있습니다.

*   중앙 노드 등록 파일/모듈을 찾습니다 (예: 종종 `frontend-react-ts/src/nodes/index.ts` 또는 유사한 위치).
*   새 노드 클래스와 해당 설정 컴포넌트를 가져옵니다.
*   사용 가능한 노드 목록에 추가하여 `nodeType`을 해당 클래스 및 설정 UI 컴포넌트에 매핑합니다.

    ```typescript
    // 예시: frontend-react-ts/src/nodes/index.ts
    // ... 다른 import 문들
    import {{ MyNewNode }} from './MyNewNodeSubdirectory/my_new_node';
    import {{ MyNewNodeSettings }} from './MyNewNodeSubdirectory/components/MyNewNodeSettings'; // 또는 해당 파일 위치

    export const availableNodes = [
      // ... 다른 등록된 노드들
      {{
        type: MyNewNode.nodeType,
        name: MyNewNode.nodeName,
        icon: MyNewNode.nodeIcon,
        description: MyNewNode.nodeDescription,
        nodeClass: MyNewNode,
        settingsComponent: MyNewNodeSettings, // 또는 설정을 렌더링하는 더 일반적인 방법
      }},
    ];
    ```

## 4. 백엔드 로직 구현 (해당되는 경우)

노드가 서버 측에서 작업을 수행해야 하는 경우 (예: 로컬 파일 액세스, 집약적인 계산 실행, 보호된 API와 상호 작용):

### 4.1. API 엔드포인트 정의

1.  `backend-fastapi-py/main.py` (또는 관련 라우터 파일)에 새 FastAPI 엔드포인트를 정의합니다.
2.  타입 안전성과 명확한 API 계약을 위해 요청 및 응답 본문에 Pydantic 모델을 사용합니다.

    ```python
    # 예시: backend-fastapi-py/main.py 또는 라우터 파일
    from fastapi import APIRouter, HTTPException
    from pydantic import BaseModel

    # api_router와 같은 라우터 인스턴스가 있다고 가정
    # 그렇지 않은 경우 app.include_router(...)에 추가
    your_node_router = APIRouter()

    class MyNodeRequest(BaseModel):
        data: str
        param1: str

    class MyNodeResponse(BaseModel):
        processed_data: str
        detail: str

    @your_node_router.post("/api/my-new-node/process", response_model=MyNodeResponse)
    async def process_my_new_node_data(request: MyNodeRequest):
        try:
            # 여기서 서비스 로직 호출
            # result = some_service.process_data(request.data, request.param1)
            result = f"처리됨: '{{request.data}}' (파라미터: '{{request.param1}}')"
            return MyNodeResponse(processed_data=result, detail="성공적으로 처리되었습니다")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    # 메인 앱에 이 라우터를 포함하는 것을 잊지 마십시오:
    # app.include_router(your_node_router, tags=["My New Node"])
    ```

### 4.2. 서비스 로직 구현

1.  `backend-fastapi-py/services/` 디렉토리에 새 Python 파일을 만듭니다 (예: `my_new_node_service.py`).
2.  이 서비스 파일에서 노드의 백엔드 작업을 위한 핵심 로직을 구현합니다.

    ```python
    # 예시: backend-fastapi-py/services/my_new_node_service.py

    def process_data_for_my_node(data: str, param1: str) -> str:
        # 실제 처리 로직
        # 데이터베이스 조회, 계산, 외부 API 호출 등이 포함될 수 있습니다.
        processed_result = f"서비스 처리됨: {{data}} (파라미터: {{param1}})"
        return processed_result
    ```

3.  `main.py`의 API 엔드포인트 핸들러에서 이 서비스를 호출합니다.

### 4.3. 프론트엔드 노드에서 API 호출

프론트엔드 노드의 `process()` 메소드를 수정하여 새 백엔드 엔드포인트로 HTTP 요청 (`fetch` 또는 사전 구성된 API 클라이언트 사용 등)을 보냅니다.

```typescript
// MyNewNode 클래스 내 process() 메소드
// ... (입력 데이터 가져오기)

if (this.settings.requiresBackend) { // 예시 조건
  try {
    const response = await fetch('/api/my-new-node/process', {
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify({{ data: inputData, param1: this.settings.setting1 }}),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '백엔드 API 오류');
    }
    const backendResult = await response.json();
    return {{ output1: backendResult.processed_data }};
  } catch (error) {
    console.error('MyNewNode 백엔드 API 호출 오류:', error);
    throw error;
  }
} else {
  // 순수 프론트엔드 로직
  // ...
}
```

## 5. 데이터 처리 및 `process()` 메소드

이것이 노드 기능의 핵심입니다.

*   **입력 검색:** 연결된 입력 소켓에서 데이터를 가져오려면 `this.getInputData('socket_name')`을 사용합니다.
*   **설정 액세스:** 노드에 구성된 값에 액세스하려면 `this.settings`를 사용합니다.
*   **로직 수행:** 노드의 핵심 데이터 변환 또는 작업을 구현합니다.
*   **출력 생성:** 키가 출력 소켓 이름이고 값이 해당 소켓으로 전송될 데이터인 객체를 반환합니다 (예: `return {{ outputSocketName: resultData }};`).
*   **오류 처리:** 강력한 오류 처리를 구현합니다. 오류가 발생하면 로그를 기록하거나, 노드에 오류 상태를 설정하거나, 플로우 실행 관리자가 포착할 수 있는 예외를 발생시킬 수 있습니다.

## 6. 노드 테스트

새 노드를 철저히 테스트하십시오:

*   **단위 테스트:** 가능하다면 노드 클래스(특히 `process` 메소드) 또는 백엔드 서비스 내의 복잡한 로직에 대한 단위 테스트를 작성합니다.
*   **개별 노드 테스트:**
    *   UI의 새롭고 빈 워크플로우에 노드를 추가합니다.
    *   설정을 구성합니다.
    *   테스트 데이터를 제공하기 위해 모의 `Input Node`를 연결합니다.
    *   결과를 관찰하기 위해 `Output Node`를 연결합니다.
    *   플로우를 실행하고 다양한 조건(유효한 데이터, 유효하지 않은 데이터, 누락된 데이터, 에지 케이스)에서 동작과 출력을 확인합니다.
*   **플로우 통합 테스트:**
    *   새 노드를 더 복잡한 기존 또는 새 워크플로우에 통합합니다.
    *   다른 노드와 상호 작용하는 방식을 테스트합니다.
    *   전체 체인을 통해 데이터가 올바르게 흐르는지 확인합니다.
*   **백엔드 테스트 (해당되는 경우):**
    *   Postman 또는 `curl`과 같은 도구를 사용하여 API 엔드포인트를 직접 테스트합니다.
    *   백엔드 서비스가 요청을 올바르게 처리하고 적절한 응답/오류를 반환하는지 확인합니다.

## 7. 문서화 (선택 사항이지만 권장)

*   기존 노드가 문서화된 방식과 유사하게 새 노드를 설명하기 위해 `project-meta/02_NODES/`에 새 마크다운 파일을 추가하는 것을 고려하십시오. 이는 다른 개발자(그리고 미래의 당신)가 목적, 입력, 출력 및 설정을 이해하는 데 도움이 됩니다.

이러한 단계를 따르면 새로운 사용자 정의 노드 기능으로 애플리케이션을 효과적으로 확장할 수 있습니다. 