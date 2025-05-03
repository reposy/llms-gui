# 노드 상세 가이드

이 문서는 llms-gui에서 사용 가능한 각 노드 타입의 상세 설명과 사용법을 제공합니다.

## 기본 노드 실행 메커니즘

모든 노드는 `Node` 클래스를 상속받아 구현됩니다. 노드의 실행은 다음과 같은 공통 메커니즘을 따릅니다.

### 1. 노드 실행 흐름 (`Node.process`)

모든 노드는 공통 실행 흐름을 가지는 `process` 메소드를 통해 실행됩니다:

1. `process` 메소드는 입력 데이터를 받아 노드 상태를 'running'으로 표시합니다.
2. 각 노드 타입별로 구현된 `execute` 추상 메소드를 호출합니다.
3. `execute` 결과를 `FlowExecutionContext.storeOutput`을 통해 저장합니다:
   - 배열 결과의 경우: 각 요소를 개별적으로 `storeOutput`으로 저장
   - 단일 값 결과의 경우: 값을 그대로 `storeOutput`으로 저장
4. 노드 상태를 'success'로 표시하고 결과를 저장합니다.
5. 자식 노드들에게 처리된 결과를 전달하여 병렬로 실행합니다.

### 2. 결과 저장 메커니즘 (`storeOutput`)

`FlowExecutionContext.storeOutput`은 노드 실행 결과를 저장하는 중앙 메소드입니다:

1. 각 노드 ID에 대해 결과 배열이 관리됩니다 (`Map<string, any[]>` 구조).
2. 새 결과가 들어오면 해당 노드의 결과 배열에 **추가**됩니다.
3. 최신 결과는 UI 표시를 위해 노드 상태 저장소에도 업데이트됩니다.
4. 결과 배열은 노드 간 데이터 흐름에 사용됩니다.

### 중요 사항

- 노드 실행 결과는 **반드시** 해당 노드의 `execute` 메소드에서 반환되어야 합니다.
- 노드는 `execute` 내부에서 직접 `this.context?.storeOutput`을 호출하지 않아야 합니다. 모든 출력 저장은 기본 `Node.process` 메소드에서 처리됩니다.
- 이 일관된 접근 방식은 시스템 전체의 데이터 흐름을 예측 가능하게 유지합니다.

---

## HTML Parser 노드

### 1. 개요

`HTML Parser` 노드는 `Web Crawler` 노드 등으로부터 전달받은 HTML 문자열을 입력으로 받아, 사용자가 정의한 규칙에 따라 원하는 데이터를 추출하고 구조화된 형태(JSON 객체)로 출력하는 **프론트엔드 기반 노드**입니다.

-   **입력:** 다른 노드로부터 HTML 문자열 또는 HTML 문자열을 포함하는 객체 (`.html` 또는 `.text` 필드)를 받습니다.
-   **처리:** 사용자가 정의한 추출 규칙(`ExtractionRule[]`)에 따라 **브라우저의 내장 `DOMParser`** 와 DOM API (`querySelectorAll`, `textContent`, `outerHTML`, `getAttribute` 등)를 사용하여 프론트엔드에서 직접 HTML을 파싱하고 데이터를 추출합니다. **백엔드는 이 노드의 파싱 및 추출 과정에 관여하지 않습니다.**
-   **출력:** 추출된 데이터를 포함하는 JavaScript 객체 (`{ "rule_name": "extracted_value", ... }`)를 다음 노드로 전달합니다.

### 2. 프론트엔드 UI (노드 설정 패널)

#### 2.1. 추출 규칙 (Extraction Rules) 탭

이 탭에서는 HTML에서 데이터를 추출하기 위한 규칙을 관리합니다.

-   **규칙 목록:** 정의된 규칙들이 이름, 추출 유형, 선택자 요약과 함께 표시됩니다.
-   **규칙 추가/수정:**
    -   '+ 규칙 추가' 버튼을 누르거나 기존 규칙의 편집(✎) 버튼을 누르면 규칙 편집 폼이 목록 위에 나타납니다. (기존 규칙 목록은 계속 보입니다.)
    -   **규칙 이름:** 추출된 데이터의 키(key)로 사용될 고유한 이름 (필수).
    -   **추출 유형:**
        -   `텍스트`: 선택된 요소와 그 자손 요소들의 텍스트 내용만 추출합니다 (HTML 태그 제외).
        -   `HTML`: 선택된 요소 자체의 HTML 코드 전체(태그 포함)를 추출합니다.
        -   `속성`: 선택된 요소의 특정 HTML 속성 값을 추출합니다.
    -   **CSS 선택자:**
        -   데이터를 추출할 HTML 요소를 지정하는 표준 CSS 선택자 문자열입니다.
        -   **직접 입력:** 필드에 직접 CSS 선택자를 입력할 수 있습니다. (예: `div.content ul li a[target="_blank"]`)
        -   **DOM 선택 활용:** 'HTML 구조 탐색' 탭에서 요소를 선택하고 '이 요소 사용하기' 버튼을 누르면, 해당 요소까지의 경로가 레벨(Lv1, Lv2...) 형식으로 표시되고, 내부적으로 생성된 CSS 선택자 문자열이 사용됩니다. 이 경우 CSS 선택자 필드는 읽기 전용 경로 표시로 대체되며, 그 아래에 실제 사용될 선택자 문자열이 회색으로 표시됩니다.
    -   **속성 (추출 유형이 '속성'일 때):** 추출할 HTML 속성의 이름 (예: `href`, `src`, `data-id`).
    -   **다중 요소 선택:** 체크 시, CSS 선택자와 일치하는 **모든** 요소에서 데이터를 추출하여 **배열**로 반환합니다. 체크 해제 시, 일치하는 **첫 번째** 요소에서만 데이터를 추출하여 **단일 값**(문자열)으로 반환합니다.
    -   저장/취소 버튼으로 편집 내용을 반영하거나 취소합니다.
-   **규칙 삭제:** 규칙 목록에서 삭제(✕) 버튼을 눌러 해당 규칙을 제거합니다.

#### 2.2. HTML 구조 탐색 (HTML Structure) 탭

이 탭에서는 입력받은 HTML의 구조를 시각적으로 탐색하고 요소를 선택하여 추출 규칙 생성을 도울 수 있습니다.

-   **DOM 트리 뷰:** 입력된 HTML을 파싱하여 계층적인 트리 구조로 보여줍니다.
    -   노드를 클릭하여 펼치거나 접을 수 있습니다 (`toggleExpand`).
    -   요소를 클릭하면 해당 요소가 선택됩니다 (`handleElementSelect`).
-   **텍스트 검색:**
    -   입력 필드에 텍스트를 입력하고 검색(돋보기 아이콘) 버튼을 누르면, DOM 내 모든 요소의 `outerHTML`을 검사하여 입력된 텍스트를 포함하는 요소를 찾습니다.
    -   검색 결과가 있으면 개수와 현재 순번이 표시되며, 이전/다음(❮/❯) 버튼으로 일치하는 요소 간 이동이 가능합니다.
    -   검색 결과가 선택되면 해당 요소가 DOM 트리 뷰에서 강조 표시되고, 필요하면 상위 노드들이 자동으로 펼쳐집니다.
-   **선택된 요소:**
    -   DOM 트리 뷰에서 요소를 클릭하면 이 섹션에 정보가 표시됩니다.
    -   **경로:** 루트 요소부터 선택된 요소까지의 경로가 레벨(Lv1: 태그, Lv2: 태그...) 형식으로 표시됩니다.
    -   **CSS 선택자:** 해당 요소를 특정할 수 있도록 자동으로 생성된 CSS 선택자 문자열이 표시됩니다.
    -   **미리보기:** 선택된 요소의 HTML 코드 미리보기가 표시됩니다.
    -   **이 요소 사용하기:** 이 버튼을 클릭하면 현재 선택된 요소의 정보(경로 및 생성된 CSS 선택자)가 '추출 규칙' 탭의 새 규칙 편집 폼으로 전달됩니다.

### 3. 프론트엔드 실행 로직 (`core/HTMLParserNode.ts`)

`HTML Parser` 노드가 실행될 때의 내부 로직은 다음과 같습니다.

1.  **입력 처리:**
    -   이전 노드로부터 전달받은 입력(`input`)을 분석합니다.
    -   `getHtmlContentFromInput` 헬퍼 함수를 사용하여 다양한 입력 형태 (HTML 문자열, `Document` 객체, `.html` 또는 `.text` 필드를 가진 객체)로부터 실제 파싱할 HTML 콘텐츠(`htmlContent`)를 추출합니다.
    -   유효한 HTML 콘텐츠를 찾지 못하면 원본 입력을 그대로 다음 노드로 전달하고 실행을 종료합니다.
2.  **규칙 로딩:**
    -   `useNodeContentStore`를 통해 현재 노드에 설정된 `extractionRules` 배열을 가져옵니다.
    -   규칙이 하나도 정의되지 않은 경우, 추출된 `htmlContent` 문자열 자체를 결과로 반환합니다.
3.  **HTML 파싱 및 데이터 추출:**
    -   `extractFromHTML` 함수 내부에서 `DOMParser().parseFromString(htmlContent, 'text/html')`를 호출하여 브라우저 네이티브 파서로 HTML 문자열을 `Document` 객체로 변환합니다.
    -   각 `extractionRule`에 대해 반복합니다:
        -   `rule.selector`를 사용하여 `document.querySelectorAll()` 또는 `document.querySelector()` (내부적으로 `extractFromHTML`에서 처리)로 해당하는 요소를 찾습니다.
        -   `extractContent` 함수는 찾아진 요소(들)에 대해 `rule.target` (`text`, `html`, `attribute`)과 `rule.attribute_name`을 사용하여 `element.textContent`, `element.outerHTML`, `element.getAttribute()` 등으로 데이터를 추출합니다.
        -   `rule.multiple` 설정에 따라 결과가 단일 값(문자열) 또는 배열(문자열[])로 처리됩니다.
4.  **결과 객체 생성:**
    -   각 규칙의 이름(`rule.name`)을 키로, 추출된 데이터(단일 값 또는 배열)를 값으로 하는 JavaScript 객체(`result`)를 생성합니다.
5.  **출력 전달:**
    -   생성된 `result` 객체를 `this.context.storeOutput`으로 상태 저장소에 저장하고, `this.context.markNodeSuccess`로 성공 상태를 표시한 후, 다음 노드로 전달합니다.

### 4. 백엔드 상호작용 및 역할

-   **HTML Parser 노드:** 위에서 설명한 대로, 이 노드의 **모든 파싱 및 데이터 추출 로직은 프론트엔드(브라우저)**에서 이루어집니다. 백엔드 API를 호출하지 않습니다.
-   **Web Crawler 노드 (예시):** HTML Parser 노드의 일반적인 입력 소스인 Web Crawler 노드는 **백엔드**에서 실행됩니다. 주요 역할은 다음과 같습니다:
    -   주어진 URL의 웹 페이지에 접근합니다.
    -   필요한 경우, 동적 콘텐츠 로딩을 위해 특정 요소가 나타날 때까지 대기하거나 지정된 시간만큼 지연 실행합니다.
    -   최종적으로 **순수한 HTML 문자열**을 가져와 다음 노드(주로 HTML Parser)로 전달하는 것을 목표로 합니다. (백엔드에서 HTML을 파싱하거나 데이터를 추출하지 않습니다.)

### 5. 데이터 흐름 및 출력 형식

-   **입력:** 주로 HTML 문자열.
-   **처리:** 프론트엔드 DOM 파싱 및 규칙 기반 데이터 추출.
-   **출력:** 추출 규칙의 이름들을 키로 가지고, 각 규칙에 해당하는 추출된 데이터(문자열 또는 문자열 배열)를 값으로 가지는 **JavaScript 객체(Object)**.

```json
// 예시 출력 객체
{
  "page_title": "Example Product Page",
  "product_price": "$99.99",
  "image_urls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.png"
  ],
  "description_html": "<p>This is a <b>great</b> product.</p>"
}
```

이 객체는 다음 노드로 전달되어 추가 처리(예: `JSON Extractor` 노드에서 특정 값 추출, `Output` 노드에서 결과 표시 등)에 사용될 수 있습니다.

---

## Web Crawler 노드

### 1. 개요

`Web Crawler` 노드는 지정된 URL의 웹 페이지 콘텐츠를 가져오는 **백엔드 기반 노드**입니다. 동적 웹 페이지의 콘텐츠 로딩을 기다리는 옵션 등을 제공하여 안정적으로 HTML을 가져올 수 있도록 설계되었습니다.

-   **입력:** 이전 노드로부터 URL 문자열을 받거나, 노드 설정에서 직접 URL을 지정할 수 있습니다. 입력값이 URL 문자열이고 노드 설정에 URL이 비어있으면 입력값을 URL로 사용합니다.
-   **처리:** 백엔드 API (`/api/web-crawler/fetch`)를 호출하여 실제 웹 페이지 크롤링을 수행합니다. 백엔드는 주어진 URL에 접속하고, 설정된 경우 특정 CSS 선택자(`waitForSelector`)가 나타날 때까지 대기하거나 지정된 시간(`timeout`)만큼 기다린 후 페이지의 **전체 HTML 소스 코드**를 가져옵니다.
-   **출력:** 가져온 웹 페이지의 **순수한 HTML 문자열**을 다음 노드로 전달합니다.

### 2. 프론트엔드 UI (노드 설정 패널)

-   **URL:** 크롤링할 웹 페이지의 주소입니다.
-   **Wait for Selector (Optional):** 페이지 로딩 시 이 CSS 선택자에 해당하는 요소가 나타날 때까지 기다립니다. 동적 콘텐츠 로딩이 완료된 후 HTML을 가져오고 싶을 때 유용합니다. (예: `.main-content`, `#article-body`)
-   **Timeout (ms):** 페이지 로딩 및 `waitForSelector` 대기를 위한 최대 시간 (밀리초 단위)입니다. 이 시간이 지나면 대기를 중단하고 현재까지 로드된 HTML을 반환하거나 오류를 발생시킬 수 있습니다.
-   **HTTP Headers:** 크롤링 요청 시 포함할 추가적인 HTTP 헤더를 설정합니다. (예: `User-Agent` 변경)
    -   헤더 이름과 값을 입력하고 'Add' 버튼으로 추가합니다.
    -   기존 헤더 옆의 'Remove' 버튼으로 삭제합니다.

### 3. 실행 로직 및 백엔드 상호작용

1.  노드의 `execute` 메서드 (`core/WebCrawlerNode.ts`)가 호출됩니다.
2.  설정된 URL 또는 입력값으로 사용할 최종 `targetUrl`을 결정합니다.
3.  설정된 `waitForSelector`, `timeout`, `headers` 정보를 포함하여 백엔드 API (`/api/web-crawler/fetch`)에 POST 요청을 보냅니다. 요청 본문에는 `include_html: true`가 포함되어 백엔드가 HTML 콘텐츠를 반환하도록 명시합니다.
4.  백엔드 서비스는 해당 URL을 크롤링하고 설정된 대기 조건(selector, timeout)을 적용한 후, 결과 객체(성공 시 `status: 'success'`, `html: '...'`)를 반환합니다.
5.  프론트엔드 `execute` 메서드는 백엔드 응답을 받고, 상태가 'success'이고 `html` 필드가 있는지 확인합니다.
6.  성공적으로 HTML 콘텐츠를 받으면, 이 **HTML 문자열**을 `storeOutput`으로 저장하고 다음 노드로 반환합니다.
7.  백엔드에서 오류가 발생하거나 HTML 콘텐츠가 없으면 노드 상태를 'error'로 표시합니다.

### 4. 데이터 흐름 및 출력 형식

-   **입력:** (선택적) URL 문자열
-   **처리:** 백엔드 웹 크롤링 실행
-   **출력:** 크롤링된 페이지의 **HTML 문자열 (String)**

---

## LLM 노드

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

### 3. 실행 로직 (`core/LlmNode.ts`, `services/*`)

1.  `execute` 메서드가 호출되고, 설정된 `provider`, `model`, `mode` 등을 가져옵니다.
2.  `mode`에 따라 프롬프트를 처리하고 입력 데이터를 분석합니다.
    -   **Text Mode:** `resolvePrompt` 함수를 호출하여 `prompt` 내 `{{input}}`을 입력값으로 치환합니다.
    -   **Vision Mode:** 입력에서 이미지 `File` 객체를 `filterImageFiles` 유틸리티를 사용해 추출합니다. 유효한 이미지 파일이 없으면 오류 처리합니다.
3.  LLM 요청 파라미터(`LLMRequestParams`) 객체를 생성합니다 (모델, 프롬프트, 온도, 이미지 파일 목록 등).
4.  `runLLM(params)`를 호출하여 LLM 서비스 실행을 요청합니다.
5.  `runLLM`은 `provider`에 따라 `ollamaService.generate(params)` 또는 `openaiService.generate(params)`를 호출합니다.
6.  각 서비스는 파라미터를 API 요구사항에 맞게 변환하고 (특히 이미지는 Base64 인코딩 등), 해당 API 엔드포인트(Ollama 로컬 서버 또는 OpenAI API)로 요청을 보냅니다.
7.  API 응답을 받아 표준화된 `LLMServiceResponse` 형태로 반환합니다.
8.  `execute` 메서드는 응답에서 텍스트 결과(`response`)를 추출합니다.
9.  추출된 텍스트 결과를 `storeOutput`으로 저장하고 다음 노드로 반환합니다.

### 4. 백엔드 상호작용 및 역할

-   LLM 노드는 일반적으로 **백엔드 API 서버(`/api/...`)와 직접 상호작용하지 않습니다.**
-   LLM 호출은 프론트엔드 내 서비스 레이어(`llmService`, `ollamaService`, `openaiService`)를 통해 이루어집니다.
-   Ollama의 경우 로컬 네트워크의 Ollama 서버(`ollamaUrl`)로 직접 요청합니다.
-   OpenAI의 경우 프론트엔드에서 직접 OpenAI API 엔드포인트로 요청합니다. (API 키는 프론트엔드 상태에 저장되므로 보안상 주의가 필요할 수 있습니다. 이상적으로는 백엔드를 통해 프록시하는 것이 더 안전합니다.)

### 5. 데이터 흐름 및 출력 형식

-   **입력:** 텍스트(String), 객체(Object), 이미지 파일(`File` 객체), 또는 이들의 배열(Array).
-   **처리:** 프론트엔드 서비스 레이어를 통한 LLM API 호출 (Ollama 또는 OpenAI).
-   **출력:** LLM이 생성한 **텍스트 응답 (String)**.

---

## API 노드

### 1. 개요

`API` 노드는 지정된 URL과 설정(메서드, 헤더, 본문 등)을 사용하여 외부 HTTP API를 호출하고 그 응답을 반환하는 **프론트엔드 기반 노드**입니다. RESTful API 등 다양한 웹 API와 상호작용하는 데 사용됩니다.

-   **입력:** 이전 노드로부터 데이터를 받을 수 있으며, 설정에 따라 URL 또는 요청 본문(Request Body)으로 사용될 수 있습니다.
-   **처리 (`core/ApiNode.ts`):**
    -   설정된 URL 또는 입력값을 최종 요청 URL로 결정합니다.
    -   설정된 HTTP 메서드(`GET`, `POST`, `PUT`, `DELETE`, `PATCH`)를 확인합니다.
    -   설정된 헤더(`headers`), 쿼리 파라미터(`queryParams`)를 준비합니다.
    -   요청 본문(`body`)을 준비합니다:
        -   'Use Input as Body' 옵션이 켜져 있으면 이전 노드의 출력을 본문으로 사용합니다.
        -   꺼져 있고 메서드가 GET/DELETE가 아니면, 설정된 본문 형식(`bodyFormat`: 'raw' 또는 'key-value')에 따라 본문을 구성합니다.
            -   `raw`: 설정된 텍스트(`body`)를 그대로 사용합니다.
            -   `key-value`: 활성화된 키-값 쌍(`bodyParams`)들을 객체로 만들어 사용합니다.
        -   본문이 있는 경우, 설정된 `contentType` (기본값: 'application/json') 헤더가 자동으로 추가될 수 있습니다.
    -   구성된 파라미터(URL, 메서드, 헤더, 본문, 쿼리 파라미터)를 사용하여 `apiService.ts`의 `callApi` 함수를 호출합니다.
    -   `callApi` 함수는 내부적으로 `axios` 라이브러리를 사용하여 실제 HTTP 요청을 대상 API 서버로 보냅니다.
-   **출력:** API 서버로부터 받은 **응답 데이터 (response data)** 를 다음 노드로 전달합니다. 응답 데이터의 형식은 API 서버가 반환하는 내용에 따라 달라집니다 (JSON 객체, 텍스트, XML 등).

### 2. 프론트엔드 UI (노드 설정 패널 - `APIConfig.tsx`)

-   **URL:** 호출할 API 엔드포인트의 주소입니다. (필수)
-   **Method:** 사용할 HTTP 메서드를 선택합니다 (GET, POST, PUT, DELETE, PATCH).
-   **Headers:** 요청에 포함할 HTTP 헤더를 설정합니다. (이름-값 쌍으로 추가/삭제)
-   **Query Params:** URL에 추가될 쿼리 파라미터를 설정합니다. (이름-값 쌍으로 추가/삭제)
-   **Body:** 요청 본문을 설정하는 섹션입니다 (GET, DELETE 메서드에서는 비활성화될 수 있음).
    -   **Use Input as Body:** 체크 시, 이전 노드의 출력을 요청 본문으로 사용합니다. 아래의 본문 설정은 무시됩니다.
    -   **Body Format:** 본문 형식을 선택합니다.
        -   `raw`: 텍스트 영역에 입력된 내용을 그대로 본문으로 사용합니다. (JSON, XML, 일반 텍스트 등)
        -   `key-value`: 키-값 쌍 목록을 정의하여 본문을 구성합니다. (주로 `application/x-www-form-urlencoded` 또는 `multipart/form-data` 형식의 요청을 모방할 때 사용될 수 있으나, 현재 구현은 주로 JSON 객체 생성에 가까울 수 있음 - 확인 필요)
    -   **(Format: raw)** **Content Type:** `raw` 형식일 때 요청 헤더에 포함될 `Content-Type`을 지정합니다. (기본값: `application/json`)
    -   **(Format: raw)** **Body (Textarea):** `raw` 형식일 때 사용할 본문 내용을 직접 입력합니다.
    -   **(Format: key-value)** **Body Params:** 키-값 쌍 목록을 추가/삭제/활성화/비활성화하여 본문을 구성합니다.

### 3. 실행 로직 (`core/ApiNode.ts`, `services/apiService.ts`)

1.  `execute` 메서드가 호출되고, 노드 설정을 가져옵니다.
2.  URL과 요청 본문을 결정합니다. (입력값 사용 여부 확인)
3.  헤더, 쿼리 파라미터 등을 최종적으로 구성합니다.
4.  `callApi(params)` 함수를 호출합니다.
5.  `callApi` 함수는 `axios`를 사용하여 구성된 파라미터로 HTTP 요청을 보냅니다.
6.  API 서버로부터 응답을 받습니다.
7.  응답 데이터를 추출하여 `storeOutput`으로 저장하고 다음 노드로 반환합니다.
8.  오류 발생 시 (네트워크 오류, 4xx/5xx 응답 등) 노드 상태를 'error'로 표시합니다.

### 4. 백엔드 상호작용 및 역할

-   API 노드는 **백엔드 API 서버(`/api/...`)와 직접 상호작용하지 않습니다.**
-   API 호출은 프론트엔드 내 `apiService.ts`를 통해 이루어지며, 이 서비스는 브라우저 환경에서 직접 대상 API 서버로 HTTP 요청을 보냅니다.
-   **주의:** 브라우저에서 직접 외부 API를 호출하므로, 대상 서버에 CORS(Cross-Origin Resource Sharing) 정책이 적절히 설정되어 있지 않으면 요청이 차단될 수 있습니다. CORS 문제가 발생할 경우, 백엔드를 통해 API 호출을 프록시하는 방식의 구현 변경이 필요할 수 있습니다.

### 5. 데이터 흐름 및 출력 형식

-   **입력:** (선택적) URL 문자열 또는 요청 본문으로 사용될 데이터 (Any 타입).
-   **처리:** 프론트엔드 서비스(`axios`)를 통한 외부 API HTTP 호출.
-   **출력:** API 응답 본문 데이터 (타입은 API 서버 응답에 따라 다름: Object, String, Array, etc.).

---

## Input 노드

### 1. 개요

`Input` 노드는 워크플로우의 시작점이 되거나 다른 노드로부터 데이터를 받아 저장하고, 후속 처리를 위한 실행 방식을 제어하는 노드입니다. 사용자가 직접 텍스트나 파일을 입력할 수 있으며, **공통 항목(Shared Items)**과 **개별 항목(Individual Items)**을 구분하여 관리하는 기능을 통해 복잡한 데이터 처리 시나리오를 지원합니다.

### 2. 주요 기능

*   **데이터 입력:**
    *   텍스트나 파일을 **공통 항목** 또는 **개별 항목**으로 직접 추가할 수 있습니다.
    *   이전 노드로부터 받은 출력을 업데이트 모드 설정에 따라 공통 또는 개별 항목으로 자동 추가할 수 있습니다.
*   **항목 유형 관리:**
    *   **공통 항목(Shared Items):** ForEach 모드에서 모든 개별 항목 처리 시 함께 사용될 데이터입니다. (예: 공통 프롬프트, 설정 값, 참조 이미지)
    *   **개별 항목(Individual Items):** ForEach 모드에서 각각 독립적으로 처리될 데이터입니다. (예: 처리할 이미지 목록, 번역할 텍스트 목록)
*   **실행 모드:**
    *   **Batch 모드 (`iterateEachRow: false`):** 모든 공통 항목과 개별 항목을 하나의 배열로 결합하여 다음 노드에 전달합니다.
    *   **ForEach 모드 (`iterateEachRow: true`):** 각 개별 항목마다 모든 공통 항목과 결합하여 다음 노드를 실행합니다. (개별 항목 수만큼 실행)
*   **업데이트 모드 (`updateMode`):**
    *   이전 노드의 출력을 어떻게 처리할지 결정합니다.
    *   `shared`: 출력을 공통 항목에 추가합니다.
    *   `element`: 출력을 개별 항목에 추가합니다.
    *   `none`: 출력을 저장하지 않습니다.
*   **항목 관리 UI:**
    *   공통 항목과 개별 항목 목록을 분리하여 시각적으로 표시합니다.
    *   각 항목 유형별 또는 전체 항목을 삭제하는 기능을 제공합니다.

### 3. 프론트엔드 UI (`components/nodes/InputNode.tsx`)

*   **실행 모드 토글:** Batch 모드와 ForEach 모드를 전환합니다.
*   **입력 업데이트 모드 선택:** 이전 노드 출력을 처리할 방식을 `공통 항목`, `개별 항목`, `미적용` 중에서 선택합니다.
*   **텍스트 추가:** 입력된 텍스트를 공통 또는 개별 항목으로 추가하는 버튼이 분리되어 있습니다.
*   **파일 추가:** 파일 선택 시 공통 또는 개별 항목으로 추가하는 버튼(라벨)이 분리되어 있습니다.
*   **항목 목록:** 공통 항목과 개별 항목 목록이 명확하게 구분되어 표시됩니다.
*   **항목 비우기:** 공통 항목, 개별 항목, 또는 전체 항목을 비우는 버튼을 제공합니다.

### 4. 실행 로직 (`core/InputNode.ts`)

1.  `execute` 메서드가 호출됩니다.
2.  현재 저장된 공통 항목(`sharedItems`), 개별 항목(`items`), 업데이트 모드(`updateMode`), 실행 모드(`iterateEachRow`) 설정을 가져옵니다.
3.  이전 노드로부터 입력(`input`)이 있고 업데이트 모드가 `none`이 아니면:
    *   `updateMode`가 `shared`인 경우: 유효한 입력을 `sharedItems` 배열에 추가합니다.
    *   `updateMode`가 `element`인 경우: 유효한 입력을 `items` 배열에 추가합니다.
    *   상태 저장소(`useNodeContentStore`)에 업데이트된 배열을 저장합니다.
4.  `iterateEachRow` 값에 따라 후속 처리를 결정합니다:
    *   **`false` (Batch 모드):**
        *   공통 항목과 개별 항목을 하나의 배열로 결합합니다: `[...sharedItems, ...items]`.
- **데이터 유형**:
  - **텍스트** - 복사한 텍스트, 명령어, 프롬프트 등
  - **파일** - 문서, 이미지, 미디어 등
- **처리 모드**:
  - **Batch 모드** - 모든 항목을 단일 배열로 함께 처리
  - **ForEach 모드** - 각 항목을 개별적으로 처리
- **항목 유형**:
  - **공통 항목(Shared Items)** - 각 ForEach 실행에 공통적으로 포함되는 항목들
  - **개별 항목(Individual Items)** - ForEach 모드에서 개별적으로 처리되는 항목들
- **업데이트 모드**:
  - **공통(Shared)** - 이전 노드의 출력을 공통 항목으로 저장
  - **개별(Element)** - 이전 노드의 출력을 개별 항목으로 저장
  - **미적용(None)** - 이전 노드의 출력을 저장하지 않음

-   **입력:** 다른 노드로부터 데이터를 받을 수 있습니다. 업데이트 모드 설정에 따라 받은 데이터는 공통 항목(`sharedItems`) 또는 개별 항목(`items`) 배열에 추가됩니다. (빈 객체는 추가되지 않음)
-   **처리 (`core/InputNode.ts`):**
    -   주된 역할은 데이터를 공통/개별 항목으로 저장하고, 설정된 실행 모드(`iterateEachRow` 속성)에 따라 후속 노드로 데이터를 전달하는 것입니다.
    -   실행 시, 이전 노드로부터 입력(`input`)이 있고 업데이트 모드가 'none'이 아니면 설정된 업데이트 모드에 따라 `sharedItems` 또는 `items` 배열에 추가합니다.
    -   `iterateEachRow` 설정값과 `sharedItems` 및 `items` 배열을 확인합니다.

### 2. 프론트엔드 UI (노드 설정 패널 - `InputNodeConfig.tsx`)

-   `iterateEachRow` 설정값과 `sharedItems` 및 `items` 배열을 확인합니다.
-   **출력:** 실행 모드에 따라 달라집니다.
    -   **Batch 모드 (`iterateEachRow: false`):** 공통 항목과 개별 항목을 모두 포함하는 배열(`[...sharedItems, ...items]`)을 다음 노드로 전달합니다.
    -   **ForEach 모드 (`iterateEachRow: true`):** 
        - 각 개별 항목(`item`)에 대해 공통 항목들과 결합한 배열(`[...sharedItems, item]`)을 생성합니다.
        - 이 결합된 배열을 사용하여 개별적으로 후속 노드 실행을 트리거합니다.
        - Input 노드 자체는 체이닝을 위한 직접적인 출력이 없습니다 (`null` 반환).
        - 즉, 체이닝이 Input 노드에서 멈추고 각 개별 항목에 대한 분기 실행이 시작되며, 각 실행에는 모든 공통 항목이 함께 포함됩니다.

### 3. 실행 로직 (`core/InputNode.ts`)

1.  `execute` 메서드가 호출됩니다.
2.  현재 저장된 항목 목록(`items`)과 `iterateEachRow` 설정을 가져옵니다.
3.  이전 노드로부터 입력(`input`)이 있으면, 유효한 경우 `items` 배열에 추가하고 상태 저장소를 업데이트합니다.
4.  `iterateEachRow` 값을 확인합니다:
    *   **`false` (Batch 모드):** 현재 `items` 배열 전체를 반환합니다. 이 배열이 다음 노드의 `input`으로 전달됩니다.
    *   **`true` (For Each 모드):**
        -   `items` 배열의 각 `item`에 대해 반복합니다.
        -   각 반복에서 연결된 모든 자식 노드의 `process(item)` 메서드를 호출합니다. 즉, 각 자식 노드는 개별 `item`을 입력으로 받아 실행됩니다.
        -   모든 항목에 대한 반복이 끝나면 `null`을 반환하여, Input 노드 다음으로의 직접적인 체이닝을 중단시킵니다. (실행 흐름은 각 항목에 대해 분기되어 진행됨)

### 4. 백엔드 상호작용 및 역할

-   Input 노드는 데이터를 저장하고 실행 모드를 제어하는 **프론트엔드 기반 노드**이며, 백엔드와 직접 상호작용하지 않습니다.
-   파일 입력 시 `File` 객체는 브라우저 메모리에 저장됩니다. (대용량 파일 처리에 대한 고려가 필요할 수 있음)

### 5. 데이터 흐름 및 출력 형식

-   **입력:** Any 타입 (이전 노드의 출력).
-   **처리:** 프론트엔드 상태 저장소(`items`)에 데이터 저장 및 실행 모드 결정.
-   **출력:**
    -   **Batch 모드:** 저장된 항목 전체를 담은 **배열 (Array)**.
    -   **For Each 모드:** 다음 노드로 직접 전달되는 출력은 **없음 (`null`)**. 대신 각 항목이 후속 노드들의 입력으로 사용되어 여러 번의 실행을 유발함.

**참고:** `For Each` 모드는 주로 `Group` 노드의 `Iteration Config`에서 데이터 소스로 지정되어, 그룹 내의 워크플로우를 각 항목에 대해 반복 실행하는 데 사용됩니다.

---

## Output 노드

### 1. 개요

`Output` 노드는 워크플로우의 최종 결과를 표시하거나 특정 중간 결과를 확인하는 데 사용되는 **프론트엔드 기반 노드**입니다. 이전 노드로부터 전달받은 데이터를 지정된 형식(JSON 또는 Text)으로 보여주고, 결과를 파일로 다운로드하는 기능을 제공합니다.

-   **입력:** 이전 노드로부터 어떤 타입의 데이터든 받을 수 있습니다 (문자열, 숫자, 객체, 배열 등).
-   **처리 (`components/nodes/OutputNode.tsx`):**
    -   노드 상태 저장소(`useNodeStateStore`)로부터 입력 데이터(`nodeState.result`)와 실행 상태(`nodeState.status`)를 가져옵니다.
    -   노드 콘텐츠 저장소(`useNodeContentStore`)로부터 표시 형식(`content.format`, 기본값: 'text') 설정을 가져옵니다.
    -   `formatResultBasedOnFormat` 함수를 사용하여 `nodeState.result`를 현재 설정된 `format`에 맞춰 문자열로 변환합니다.
        -   `json` 형식: 객체/배열은 들여쓰기 된 JSON 문자열로, 다른 타입은 문자열로 변환됩니다.
        -   `text` 형식: 문자열은 그대로, 객체/배열도 가독성을 위해 JSON 문자열 형태로 변환됩니다.
-   **출력:** Output 노드는 일반적으로 워크플로우의 종단점이므로, 다음 노드로 데이터를 전달하지 않습니다 (출력 핸들이 있지만 연결해도 데이터가 전달되지 않을 수 있음 - 확인 필요).

### 2. 프론트엔드 UI (`OutputNode.tsx`)

-   **노드 헤더:**
    -   **JSON/TEXT 토글 버튼:** 표시 형식을 JSON 또는 TEXT로 전환합니다. 이 설정은 `useNodeContentStore`에 저장됩니다.
    -   **다운로드 버튼:** 현재 표시된 결과를 파일(`.json` 또는 `.txt`)로 다운로드합니다. (실행 상태가 'success'이고 결과가 있을 때 활성화)
-   **콘텐츠 영역 (`<pre>` 태그):**
    -   이전 노드의 실행 상태(`status`)에 따라 다른 내용을 표시합니다:
        -   `success`: `nodeState.result`를 선택된 `format`에 맞춰 포맷팅한 문자열을 표시합니다.
        -   `running`: "처리 중..." 텍스트를 표시합니다.
        -   `error`: `nodeState.error` 메시지를 표시합니다.
        -   `idle` 또는 `undefined`: "실행 대기 중..." 또는 "결과 없음" 텍스트를 표시합니다.

### 3. 실행 로직

-   Output 노드는 자체적인 `execute` 로직을 가지지 않습니다. 단순히 이전 노드로부터 `nodeState.result`를 받아 UI에 표시하는 역할만 합니다.
-   상태 변경 (`nodeState` 또는 `content.format`)이 감지되면 컴포넌트가 리렌더링되고, `renderContentForDisplay` 함수가 호출되어 표시될 내용을 결정합니다.

### 4. 백엔드 상호작용 및 역할

-   Output 노드는 **프론트엔드 기반 노드**이며, 백엔드와 상호작용하지 않습니다.

### 5. 데이터 흐름 및 출력 형식

-   **입력:** Any 타입 (이전 노드의 출력).
-   **처리:** 입력 데이터를 설정된 형식(JSON/TEXT)에 따라 문자열로 포맷팅하여 UI에 표시.
-   **출력:** 없음 (워크플로우 종단점 역할).

---

## Group 노드

### 1. 개요

`Group` 노드는 내부에 포함된 다른 노드들을 하나의 단위로 묶어 관리하고, 특정 입력 소스(주로 `Input` 노드)로부터 받은 데이터 항목 각각에 대해 내부 워크플로우를 반복 실행하는 **프론트엔드 기반 노드**입니다.

-   **입력:** Group 노드 자체는 이전 노드로부터 직접적인 데이터를 받아 처리하지는 않습니다. 대신, `Iteration Config` 설정에서 지정된 입력 소스 노드(`sourceNodeId`)의 출력을 반복 실행의 대상으로 사용합니다.
-   **처리 (`core/GroupNode.ts`, `core/FlowRunner.ts`, `store/useExecutionController.ts`):**
    -   Group 노드가 실행되면, 설정된 입력 소스 노드(`sourceNodeId`)로부터 데이터 배열(`items`)을 가져옵니다. (예: `Input` 노드의 `items`)
    -   가져온 배열의 각 항목(`item`)에 대해 다음을 반복합니다:
        -   Group 내부에 정의된 워크플로우(노드 및 연결)를 실행합니다.
        -   Group 내부의 루트 노드(Group 내에서 들어오는 연결이 없는 노드)부터 실행이 시작됩니다.
        -   각 `item`은 Group 내부 워크플로우의 시작 노드(루트 노드)의 입력으로 전달됩니다.
        -   `FlowExecutionContext`는 각 반복(`iterationIndex`, `iterationTotal`, `iterationItem`)에 대한 정보를 추적합니다.
        -   Group 내부의 워크플로우가 실행되면, 그 안의 각 노드는 개별 항목(`item`)을 기반으로 로직을 수행합니다.
    -   모든 항목에 대한 반복 실행이 완료되면, 각 반복에서 Group 내부의 **리프 노드**(Group 내에서 나가는 연결이 없는 노드)가 생성한 결과들을 모아 Group 노드 자체의 최종 결과로 저장합니다.
-   **출력:** 각 반복 실행에서 Group 내부 리프 노드들이 반환한 결과들을 모은 **배열 (Array)**. 이 배열은 Group 노드 다음으로 연결된 노드로 전달됩니다.

### 2. 프론트엔드 UI (노드 설정 패널 - `GroupConfig.tsx`, 상세 사이드바 - `GroupDetailSidebar.tsx`)

-   **(노드 자체)**
    -   **크기 조절:** Group 노드의 경계를 드래그하여 크기를 조절할 수 있습니다 (`NodeResizer`).
    -   **라벨:** Group 노드의 이름을 편집할 수 있습니다 (`EditableNodeLabel`).
    -   **내부 노드:** 다른 노드들을 Group 노드 안으로 드래그하여 포함시킬 수 있습니다. 내부 노드는 Group의 `parentNode` 속성을 갖게 됩니다.
-   **(설정 패널 - `GroupConfig.tsx`)**
    -   **Label:** Group 노드의 이름을 설정합니다.
    -   **Iteration Config:** 반복 실행을 위한 설정을 합니다.
        -   **Source Node:** 드롭다운 목록에서 반복 데이터의 소스가 될 노드(주로 `Input` 노드)를 선택합니다. 선택된 노드의 ID가 `iterationConfig.sourceNodeId`로 저장됩니다. 이 필드가 설정되어야 반복 실행 기능이 활성화됩니다.
-   **(상세 사이드바 - `GroupDetailSidebar.tsx`)**
    -   그룹 노드를 선택하면 나타나는 사이드바입니다.
    -   **Group Label:** 그룹의 이름 표시 및 편집.
    -   **Source Node:** 설정된 반복 입력 소스 노드의 이름(또는 ID) 표시.
    -   **Run Group:** 이 그룹 노드를 시작점으로 하여 내부 워크플로우의 반복 실행을 수동으로 트리거합니다.
    -   **Results:** 그룹 실행이 완료된 후, 각 반복의 리프 노드 결과들이 여기에 표시됩니다. 반복 횟수, 각 반복의 인덱스 및 결과 미리보기가 나타날 수 있습니다. (현재 UI 구현 상태에 따라 다를 수 있음)
    -   **Export JSON:** 그룹 실행 결과를 JSON 파일로 내보냅니다.

### 3. 실행 로직 (`core/GroupNode.ts`, `core/FlowRunner.ts`, `store/useExecutionController.ts`)

1.  **실행 트리거:** `FlowRunner.executeFlow` 또는 `useExecutionController.executeFlowForGroup` 함수를 통해 Group 노드의 실행이 시작됩니다.
2.  **입력 소스 가져오기:** Group 노드의 `execute` 메서드 또는 관련 컨트롤러 로직에서 `iterationConfig.sourceNodeId`를 사용하여 소스 노드의 출력(보통 배열 `items`)을 가져옵니다. 소스가 없거나 배열이 아니면 오류 처리합니다.
3.  **내부 실행 준비 (`_prepareInternalExecution`):**
    -   Group 노드 내부에 포함된 노드(`internalNodes`)와 엣지(`internalEdges`)를 식별합니다.
    -   내부 노드들 간의 연결 관계를 분석하여 실행 그래프(`executionGraph`)를 생성합니다.
    -   Group 내부의 루트 노드(`rootNodeIds`)와 리프 노드(`internalLeafNodeIds`)를 식별합니다.
4.  **반복 실행:** 소스 노드에서 가져온 `items` 배열의 각 `item`에 대해 반복합니다.
    -   각 반복마다 `FlowExecutionContext`에 현재 반복 정보(`iterationIndex`, `iterationItem`, `iterationTotal`)를 설정합니다.
    -   내부 루트 노드(`rootNodeIds`) 각각에 대해 `_processInternalNodeAndCollectLeafResult` (또는 유사한) 함수를 호출하여 내부 플로우 실행을 시작합니다. `item` 데이터가 첫 입력으로 전달됩니다.
    -   `_processInternalNodeAndCollectLeafResult`는 내부 노드 인스턴스를 생성하고 `process` 메서드를 호출하여 해당 노드 및 하위 노드들의 실행을 연쇄적으로 트리거합니다.
    -   내부 노드 실행 시 `FlowExecutionContext`를 통해 현재 반복 정보를 참조할 수 있습니다.
    -   실행 중 `executedNodes` Set을 사용하여 동일한 그룹 실행 내에서 노드가 중복 실행되는 것을 방지합니다 (예: 내부 다이아몬드 구조).
5.  **결과 수집:** 각 반복이 완료되면, 해당 반복에서 실행된 내부 리프 노드들의 결과를 `FlowExecutionContext`의 `outputs` 맵이나 유사한 메커니즘에 저장합니다. (주의: 현재 `_processInternalNodeAndCollectLeafResult` 코드는 직접 `this.items`에 추가하지 않고, `execute` 말미에서 `context.getOutput`으로 가져오는 것으로 보입니다. `this.items`는 최종 결과를 담는 용도로 사용됩니다.)
6.  **최종 결과 집계:** 모든 `items`에 대한 반복이 끝나면, `execute` 메서드 끝부분에서 각 내부 리프 노드 ID에 대해 `context.getOutput(leafNodeId)`를 호출하여 저장된 모든 반복의 결과들을 가져옵니다. 이 결과들을 하나의 배열(`this.items`)로 합칩니다.
7.  **출력 전달:** 최종 집계된 결과 배열(`this.items`)을 Group 노드의 출력으로 반환하고, `storeOutput`으로 저장하여 다음 노드로 전달합니다.

### 4. 백엔드 상호작용 및 역할

-   Group 노드는 **프론트엔드 기반**이며, 반복 실행 흐름 제어를 담당합니다. 백엔드와 직접 상호작용하지 않습니다.
-   Group 내부에 포함된 노드들(예: `LLM`, `API`, `Web Crawler`)은 각자의 로직에 따라 프론트엔드 또는 백엔드와 상호작용할 수 있습니다.

### 5. 데이터 흐름 및 출력 형식

-   **입력:** (간접적) `iterationConfig.sourceNodeId`로 지정된 노드의 출력 (보통 **배열**).
-   **처리:** 입력 배열의 각 항목에 대해 Group 내부 워크플로우 반복 실행.
-   **출력:** 각 반복 실행 시 Group 내부 리프 노드들이 생성한 결과들을 모두 모은 **배열 (Array)**.

**예시:**

-   Input 노드에 `["apple", "banana"]` 항목이 있고, 이를 Group 노드의 소스로 지정합니다.
-   Group 내부에는 "Translate to Korean" LLM 노드가 리프 노드로 있습니다.
-   Group 노드가 실행되면:
    1.  "apple" 입력으로 LLM 노드가 실행되어 "사과"를 반환합니다.
    2.  "banana" 입력으로 LLM 노드가 실행되어 "바나나"를 반환합니다.
-   Group 노드의 최종 출력은 `["사과", "바나나"]` 배열이 됩니다.

---

## JSON Extractor 노드

### 1. 개요

`JSON Extractor` 노드는 입력으로 받은 JSON 데이터(객체 또는 문자열)에서 특정 값을 추출하는 **프론트엔드 기반 노드**입니다. 점(.)이나 대괄호([])를 사용한 경로 표기법(예: `data.results[0].name`)을 사용하여 중첩된 값에 접근할 수 있습니다.

-   **입력:** JSON 객체 또는 JSON 형식의 문자열.
-   **처리 (`core/JsonExtractorNode.ts`):**
    -   설정된 JSON 경로(`path`)를 사용하여 입력 데이터에서 값을 추출합니다 (`extractValue` 유틸리티 사용).
    -   입력이 문자열이면 먼저 JSON 객체로 파싱을 시도합니다. 파싱에 실패해도 기본적인 경로 추출은 시도될 수 있습니다.
    -   경로가 유효하지 않거나 값을 찾지 못하면 설정된 기본값(`defaultValue`, 기본값: `null`)을 반환합니다.
-   **출력:** 추출된 값 (타입은 원본 데이터에 따라 다름: String, Number, Boolean, Object, Array) 또는 기본값.

### 2. 프론트엔드 UI (노드 설정 패널 - `JsonExtractorConfig.tsx`)

-   **JSON Path:** 추출할 값의 경로를 입력합니다. (예: `user.name`, `items[0].price`, `details.metadata['@id']`)
-   **Default Value (Optional):** 경로를 찾지 못하거나 추출 중 오류 발생 시 반환할 기본값을 지정합니다. 비워두면 `null`이 사용됩니다.

### 3. 실행 로직 (`core/JsonExtractorNode.ts`, `utils/flow/executionUtils.ts`)

1.  `execute` 메서드가 호출됩니다.
2.  설정된 `path`와 `defaultValue`를 가져옵니다. `path`가 없으면 오류 처리하고 `defaultValue` 반환.
3.  입력(`input`)이 문자열이면 `JSON.parse()`를 시도합니다.
4.  `extractValue(input, path)` 함수를 호출하여 값 추출을 시도합니다.
    -   `extractValue`는 경로 문자열을 파싱하여 단계별로 객체 속성이나 배열 인덱스에 접근합니다.
5.  추출된 값(`result`)이 `undefined` (경로 없음 등)이면 `defaultValue`를 반환하고, 그렇지 않으면 `result`를 반환합니다.
6.  추출 과정에서 오류 발생 시 오류를 기록하고 `defaultValue`를 반환합니다.
7.  최종 반환값을 `storeOutput`으로 저장하고 다음 노드로 전달합니다.

### 4. 백엔드 상호작용 및 역할

-   JSON Extractor 노드는 **프론트엔드 기반 노드**이며, 백엔드와 직접 상호작용하지 않습니다.

### 5. 데이터 흐름 및 출력 형식

-   **입력:** JSON 객체 (Object) 또는 JSON 형식 문자열 (String).
-   **처리:** 프론트엔드에서 경로 기반 값 추출.
-   **출력:** 추출된 값 (Any 타입) 또는 기본값.

---

## Conditional 노드

### 1. 개요

`Conditional` 노드는 입력 데이터를 기반으로 설정된 조건을 평가하고, 그 결과(참/거짓)에 따라 워크플로우 실행 경로를 분기시키는 **프론트엔드 기반 노드**입니다. 참(True) 경로와 거짓(False) 경로 각각에 다른 후속 노드를 연결할 수 있습니다.

-   **입력:** 조건을 평가하는 데 사용될 데이터 (Any 타입).
-   **처리 (`core/ConditionalNode.ts`):**
    -   설정된 조건 유형(`conditionType`)과 조건 값(`conditionValue`)을 사용하여 입력 데이터(`input`)를 평가합니다 (`evaluateCondition` 유틸리티 사용).
    -   지원하는 조건 유형:
        -   `numberGreaterThan`: 입력값이 숫자이고 조건 값보다 큰지 비교.
        -   `numberLessThan`: 입력값이 숫자이고 조건 값보다 작은지 비교.
        -   `equalTo`: 입력값이 조건 값과 같은지 비교 (형 변환 후 비교 가능성 있음).
        -   `containsSubstring`: 입력값(문자열로 변환)이 조건 값(문자열)을 포함하는지 확인.
        -   `jsonPathExistsTruthy`: 입력값(객체/배열)에서 조건 값(JSON 경로)에 해당하는 값이 존재하고 Truthy한지 확인.
    -   조건 평가 결과(`true` 또는 `false`)를 저장합니다.
    -   실행 흐름 제어: 실제 분기 로직은 `getChildNodes` 메서드에서 처리됩니다. `execute` 메서드는 조건 평가만 수행하고 입력을 그대로 반환합니다.
-   **출력:** Conditional 노드 자체는 다음 노드로 입력 데이터를 그대로 전달하지만, 실제 실행되는 다음 노드는 조건 평가 결과(참/거짓)에 따라 연결된 경로(True 또는 False 핸들에서 나가는 엣지)를 따라 결정됩니다.

### 2. 프론트엔드 UI (노드 설정 패널 - `ConditionalNodeConfig.tsx`)

-   **Condition Type:** 드롭다운 목록에서 평가할 조건의 종류를 선택합니다.
-   **Value:** 조건과 비교할 값을 입력합니다. (조건 유형에 따라 숫자, 문자열, JSON 경로 등을 입력).

**(노드 본체)**

-   노드에는 두 개의 출력 핸들(Source)이 있습니다:
    -   `True`: 조건 평가 결과가 참일 때 연결된 노드가 실행됩니다.
    -   `False`: 조건 평가 결과가 거짓일 때 연결된 노드가 실행됩니다.

### 3. 실행 로직 (`core/ConditionalNode.ts`, `utils/flow/executionUtils.ts`)

1.  `execute` 메서드가 호출되고, 설정된 `conditionType`과 `conditionValue`를 가져옵니다.
2.  `evaluateCondition(input, conditionType, conditionValue)` 함수를 호출하여 조건을 평가하고 결과를(`true`/`false`) 얻습니다.
3.  평가 결과를 `storeOutput`으로 저장합니다.
4.  `execute` 메서드는 원래의 `input`을 반환합니다.
5.  (FlowRunner 로직) `ConditionalNode`의 실행이 끝나면, `getChildNodes` 메서드가 호출됩니다.
6.  `getChildNodes` 메서드:
    -   `context.getOutput(this.id)`를 통해 저장된 조건 평가 결과(`true`/`false`)를 가져옵니다.
    -   결과에 따라 사용할 소스 핸들(`source-true` 또는 `source-false`)을 결정합니다.
    -   해당 소스 핸들에서 나가는 엣지(`edges`)를 찾아 연결된 타겟 노드 ID 목록을 얻습니다.
    -   타겟 노드 ID에 해당하는 노드 인스턴스를 생성하여 반환합니다. 이 노드들이 다음으로 실행될 노드들입니다.

### 4. 백엔드 상호작용 및 역할

-   Conditional 노드는 **프론트엔드 기반 노드**이며, 백엔드와 직접 상호작용하지 않습니다.

### 5. 데이터 흐름 및 출력 형식

-   **입력:** Any 타입.
-   **처리:** 프론트엔드에서 조건 평가 및 실행 경로 결정.
-   **출력:** (직접 출력 없음) 실행 흐름이 조건 결과에 따라 True 또는 False 경로로 분기됨.

---

## Merger 노드

### 1. 개요

`Merger` 노드는 여러 개의 들어오는 경로(Upstream 노드들)로부터 입력을 받아 하나의 결과로 병합하는 **프론트엔드 기반 노드**입니다. 모든 입력이 도착할 때까지 기다리는 것이 아니라, 각 입력이 도착할 때마다 현재까지 수집된 항목들을 저장하고 반환합니다.

-   **입력:** 여러 소스로부터 다양한 타입의 데이터를 받을 수 있습니다.
-   **처리 (`core/MergerNode.ts`):**
    -   노드가 실행될 때마다 전달된 입력(`input`)을 내부 메모리(`collectedItems`) 및 Zustand 스토어(`content.items`)에 추가합니다. (null/undefined 입력은 무시)
    -   **주의:** 현재 구현은 각 입력이 도착할 때마다 **지금까지 수집된 모든 항목의 배열**을 반환합니다. 이는 Merger 노드에 연결된 후속 노드가 여러 번 실행될 수 있음을 의미합니다. (예: 입력 A 도착 -> `[A]` 반환, 입력 B 도착 -> `[A, B]` 반환)
    -   병합 전략(`strategy`) 설정은 현재 `execute` 로직에서는 직접 사용되지 않지만, 향후 특정 시점에 최종 병합 결과를 생성하는 데 사용될 수 있습니다 (예: `object` 전략).
-   **출력:** 현재까지 수집된 모든 입력 항목을 포함하는 **배열 (Array)**.

### 2. 프론트엔드 UI (노드 설정 패널 - `MergerNodeConfig.tsx`, 상세 사이드바 - `MergerNodeSidebar.tsx`)

-   **(설정 패널)** (설정 UI는 현재 단순하거나 없을 수 있음 - 코드 확인 결과, `strategy`나 `keys` 설정 UI는 명시적으로 보이지 않음. 기본적으로 배열로 동작.)
    -   *(미래 기능)* 병합 전략 (`array` 또는 `object`) 및 객체 키 지정 옵션이 추가될 수 있습니다.
-   **(상세 사이드바)**
    -   **Collected Items:** Merger 노드가 실행되면서 수집된 항목들의 목록(또는 개수)을 표시합니다. 실시간으로 업데이트될 수 있습니다.
    -   *(미래 기능)* 수동으로 병합된 결과를 후속 노드로 전달하는 트리거 버튼 등이 추가될 수 있습니다.

### 3. 실행 로직 (`core/MergerNode.ts`)

1.  `execute` 메서드가 호출됩니다.
2.  수신된 `input`이 유효하면 내부 `collectedItems` 배열에 추가합니다.
3.  업데이트된 `collectedItems` 배열을 복사하여 Zustand 스토어(`content.items`)에 저장합니다 (UI 업데이트 목적).
4.  업데이트된 `collectedItems` 배열을 복사하여 `storeOutput`으로 저장합니다.
5.  **현재 `collectedItems` 배열의 복사본을 반환합니다.**

**참고:** 현재 설계는 각 입력마다 후속 노드가 실행되므로, 모든 입력이 완료된 후에만 후속 처리를 하려면 Merger 노드 다음에 `Group` 노드 (Batch 모드의 `Input` 노드를 소스로 사용) 또는 특정 조건/이벤트에 의해 트리거되는 다른 메커니즘이 필요할 수 있습니다.

### 4. 백엔드 상호작용 및 역할

-   Merger 노드는 **프론트엔드 기반 노드**이며, 백엔드와 상호작용하지 않습니다.

### 5. 데이터 흐름 및 출력 형식

-   **입력:** Any 타입 (여러 소스로부터).
-   **처리:** 프론트엔드 메모리 및 스토어에 입력 누적.
-   **출력:** 현재까지 누적된 모든 입력을 담은 **배열 (Array)**.
 