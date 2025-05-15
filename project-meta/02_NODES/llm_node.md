# LLM 노드

### 1. 개요

`LLM` 노드는 설정된 LLM(Large Language Model) 제공자(Ollama 또는 OpenAI)를 사용하여 텍스트를 생성하거나, 비전 모델의 경우 이미지 입력을 처리하는 **프론트엔드 기반 노드**입니다.

-   **입력:** 이전 노드로부터 텍스트, 객체, 이미지 파일(`File` 객체) 또는 이들을 포함한 배열을 받을 수 있습니다.
-   **처리 (`core/LlmNode.ts`):**
    -   **텍스트 모드 (`mode: 'text'`):**
        -   설정된 프롬프트(`prompt`) 템플릿 내의 `{{input}}` 플레이스홀더를 입력 데이터로 치환합니다. (객체나 배열은 문자열로 변환되어 주입됨)
        -   선택된 제공자(`provider`), 모델(`model`), 치환된 프롬프트, 온도(`temperature`) 등의 파라미터를 구성합니다.
    -   **비전 모드 (`mode: 'vision'`):**
        -   입력 데이터에서 이미지 파일(`File` 객체)들을 필터링합니다.
        -   프롬프트는 템플릿 치환 없이 그대로 사용됩니다.
        -   필터링된 이미지 파일들과 함께 필요한 파라미터를 구성합니다.
    -   구성된 파라미터를 사용하여 `llmService.ts`의 `runLLM` 함수를 호출합니다.
    -   `runLLM` 함수는 `provider` 값에 따라 `ollamaService.ts` 또는 `openaiService.ts`의 `generate` 함수를 호출하여 실제 LLM API와 통신합니다.
        -   Ollama: 설정된 `ollamaUrl` (기본값: `http://localhost:11434`)로 직접 API 요청을 보냅니다.
        -   OpenAI: 설정된 `openaiApiKey`를 사용하여 OpenAI API 엔드포인트로 요청을 보냅니다.
        -   비전 모드의 경우, 서비스(`ollamaService`, `openaiService`) 내에서 이미지 파일(`File` 객체)을 Base64로 인코딩하는 등 각 API 요구사항에 맞게 처리합니다.
-   **출력:** LLM으로부터 받은 **텍스트 응답 (String)** 을 다음 노드로 전달합니다.

### 2. 프론트엔드 UI (노드 설정 패널 - `LLMConfig.tsx`)

-   **Provider:** 사용할 LLM 제공자를 선택합니다 (현재 Ollama, OpenAI 지원). 향후 Claude(Anthropic), Gemini(Google) 등 다른 서비스가 추가될 수 있습니다.
-   **Model:** 선택한 제공자에서 사용할 모델 이름을 입력합니다. (예: `llama3`, `gpt-4o`)
-   **Mode:** 노드의 작동 모드를 선택합니다.
    -   `Text`: 텍스트 입력 및 출력을 위한 기본 모드입니다. 프롬프트 내 `{{input}}`이 입력값으로 치환됩니다.
    -   `Vision`: 이미지 입력을 처리할 수 있는 모드입니다. 이 모드를 선택하려면 선택된 모델이 비전 기능을 지원해야 합니다 (UI 상에서 모델 지원 여부는 현재 명시적으로 표시되지 않을 수 있음). 프롬프트는 그대로 사용되며, 입력으로 이미지 파일(`File` 객체)이 필요합니다.
-   **Prompt:** LLM에 전달할 프롬프트 템플릿입니다. 텍스트 모드에서는 `{{input}}` 플레이스홀더를 사용하여 이전 노드의 출력을 주입할 수 있습니다.
-   **Temperature:** 생성될 텍스트의 무작위성(창의성)을 조절하는 값입니다 (보통 0 ~ 1 사이, 높을수록 다양하고 낮을수록 결정론적임).
-   **Ollama URL (Provider가 Ollama일 때):** 로컬에서 실행 중인 Ollama 서버의 주소입니다.
-   **OpenAI API Key (Provider가 OpenAI일 때):** OpenAI API 사용을 위한 키입니다.

### 3. 실행 로직 (`core/LlmNode.ts`, `services/llmService.ts`, `services/ollamaService.ts`, `services/openaiService.ts`)

1.  `execute` 메서드가 호출되고, 설정된 `provider`, `model`, `mode` 등을 가져옵니다.
2.  `mode`에 따라 프롬프트를 처리하고 입력 데이터를 분석합니다.
    -   **Text Mode:** `resolvePrompt` 함수를 호출하여 `prompt` 내 `{{input}}`을 입력값으로 치환합니다.
    -   **Vision Mode:** 입력에서 이미지 `File` 객체를 `filterImageFiles` 유틸리티를 사용해 추출합니다. 유효한 이미지 파일이 없으면 오류 처리합니다.
3.  LLM 요청 파라미터(`LLMRequestParams`) 객체를 생성합니다 (모델, 프롬프트, 온도, 이미지 파일 목록 등).
4.  `llmService.runLLM(params)`를 호출하여 LLM 서비스 실행을 요청합니다.
5.  `runLLM`은 `provider`에 따라 `ollamaService.generate(params)` 또는 `openaiService.generate(params)`를 호출합니다.
6.  각 서비스는 파라미터를 API 요구사항에 맞게 변환하고 (특히 이미지는 Base64 인코딩 등), 해당 API 엔드포인트(Ollama 로컬 서버 또는 OpenAI API)로 요청을 보냅니다.
7.  API 응답을 받아 표준화된 `LLMServiceResponse` 형태로 반환합니다.
8.  `execute` 메서드는 응답에서 텍스트 결과(`response`)를 추출합니다.
9.  추출된 텍스트 결과를 `storeOutput`으로 저장하고 다음 노드로 반환합니다.

### 4. 백엔드 상호작용 및 역할

-   LLM 노드는 일반적으로 **백엔드 API 서버(`/api/...`)와 직접 상호작용하지 않습니다.**
-   LLM 호출은 프론트엔드 내 서비스 레이어(`services/llmService.ts`, `services/ollamaService.ts`, `services/openaiService.ts`)를 통해 이루어집니다.
-   Ollama의 경우 프론트엔드에서 직접 로컬 네트워크의 Ollama 서버(`ollamaUrl`)로 요청합니다.
-   OpenAI의 경우 프론트엔드에서 직접 OpenAI API 엔드포인트로 요청합니다. (API 키는 프론트엔드 상태에 저장되므로 보안상 주의가 필요할 수 있습니다. 이상적으로는 백엔드를 통해 프록시하는 것이 더 안전합니다.)

### 5. 데이터 흐름 및 출력 형식

-   **입력:** 텍스트(String), 객체(Object), 이미지 파일(`File` 객체), 또는 이들의 배열(Array).
-   **처리:** 프론트엔드 서비스 레이어를 통한 LLM API 호출 (Ollama 또는 OpenAI).
-   **출력:** LLM이 생성한 **텍스트 응답 (String)**. 