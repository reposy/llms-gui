# 🗂️ 백엔드 코드 아키텍처 개요 (backend-code-architecture-overview.md)

이 문서는 백엔드(FastAPI) 프로젝트의 코드 구조, 주요 의존성, 설정 관리, 로깅 및 핵심 개발 원칙을 설명합니다.

**핵심 개발 원칙:**

*   **단순성 및 명확성:** 각 모듈과 함수는 명확한 단일 책임을 가집니다.
*   **일관성:** 코드 스타일, 네이밍 컨벤션, API 응답 구조 등의 일관성을 유지합니다.
*   **재사용성:** 중복 코드를 최소화하고 로직을 재사용 가능한 함수로 분리합니다.
*   **유지보수성:** 가독성 높고 잘 구조화된 코드를 작성합니다.

## 1. 디렉토리 구조

```
backend-fastapi-py/
├── services/             # 핵심 비즈니스 로직 (현재는 웹 크롤링만)
│   └── web_crawler.py    # Playwright 기반 웹 크롤링 서비스
├── project-meta/         # 프로젝트 관련 문서
│   └── ... (가이드 문서 등)
├── settings.py           # Pydantic 기반 설정 관리
├── main.py               # FastAPI 애플리케이션 정의 및 API 엔드포인트
├── requirements.txt      # Python 의존성 목록
├── Dockerfile            # Docker 이미지 빌드 정의
└── .env                  # 환경 변수 파일 (선택적, Git 무시 대상)
```

## 2. 주요 기술 스택 및 의존성

*   **웹 프레임워크:** FastAPI
*   **웹 서버:** Uvicorn (주로 개발 환경에서 사용)
*   **웹 크롤링:** Playwright (Chromium 브라우저 사용)
*   **HTML 파싱:** BeautifulSoup4 (lxml 파서 사용 권장)
*   **HTTP 클라이언트:** Httpx (현재 제거됨 - LLM 서비스 제거)
*   **설정 관리:** Pydantic-Settings
*   **데이터 유효성 검증:** Pydantic
*   **런타임 환경:** Docker

주요 의존성은 `requirements.txt` 파일에 관리됩니다. 새로운 의존성 추가 시 반드시 이 파일을 업데이트하고 Docker 이미지를 재빌드해야 합니다 (`docker compose up -d --build`).

## 3. 설정 관리 (`settings.py`)

*   애플리케이션 설정(향후 추가될 수 있는 API 키, 기본값 등)은 `settings.py` 파일에서 Pydantic의 `BaseSettings`를 사용하여 중앙 집중식으로 관리합니다.
*   `BaseSettings`는 `.env` 파일이나 환경 변수로부터 설정을 자동으로 로드할 수 있습니다.
*   코드 내에서는 `from .settings import settings`와 같이 임포트하여 설정 값에 접근합니다.

## 4. 로깅 설정 (`main.py`)

*   애플리케이션의 로깅 설정은 `main.py` 상단에서 `logging.basicConfig`를 사용하여 표준화된 형식으로 구성됩니다.
*   각 모듈에서는 `logging.getLogger(__name__)`을 사용하여 로거 인스턴스를 얻고 로그를 기록합니다.
*   기본 로그 레벨은 INFO 이며, 표준 로그 포맷은 `시간 - 로거 이름 - 로그 레벨 - 메시지` 형식입니다.

## 5. 웹 크롤링 서비스 (`services/web_crawler.py`)

*   `crawl_webpage` 함수는 웹 크롤링의 주 진입점입니다.
*   내부적으로 Playwright 초기화, 페이지 설정, 네비게이션 및 대기, 콘텐츠 추출 등의 로직이 비공개 헬퍼 함수(`_setup_browser_and_page`, `_navigate_and_wait` 등)로 분리되어 가독성과 유지보수성을 높였습니다.
*   Playwright와 BeautifulSoup을 사용하여 동적 웹 페이지의 HTML, 텍스트, 특정 요소 데이터를 추출합니다.
*   오류 발생 시 일관된 형식(`status`, `error` 포함)의 결과를 반환하며, `finally` 블록을 통해 브라우저 리소스를 안전하게 정리합니다.

## 6. API 엔드포인트 (`main.py`)

*   현재 `/api/web-crawler/fetch` (POST) 엔드포인트만 제공하며, 웹 크롤링 요청을 받아 처리합니다.
*   Pydantic 모델(`WebCrawlerRequest`, `WebCrawlerResponse`)을 사용하여 요청 및 응답 데이터의 유효성을 검증하고 구조를 명확히 합니다.
*   **오류 응답 처리:** 모든 엔드포인트는 내부 오류 발생 시에도 HTTP 200 OK 상태 코드를 반환하며, 응답 본문의 `status` 필드를 `"error"`로, `error` 필드에 오류 메시지를 담아 전달합니다. 프론트엔드는 이 `status` 필드를 확인하여 성공/실패 여부를 판단해야 합니다.

## 7. Docker 환경

*   `Dockerfile`은 Python 3.9 슬림 이미지를 기반으로 하며, `requirements.txt` 설치 및 Playwright 브라우저 설치(`playwright install --with-deps`) 단계를 포함합니다.
*   애플리케이션은 `uvicorn main:app --host 0.0.0.0 --port 8000` 명령어로 컨테이너 내에서 실행됩니다.
*   의존성 변경 시에는 반드시 `--build` 플래그를 사용하여 이미지를 재빌드해야 합니다.

# 백엔드 아키텍처 상세 가이드

## 백엔드 플로우 실행 시스템 구현 가이드

이 문서는 프론트엔드에서 생성된 JSON 플로우 맵을 실행할 수 있는 FastAPI 기반 백엔드 시스템 구현 방법을 설명합니다.

### 1. 아키텍처 개요

FastAPI 백엔드 플로우 실행 시스템은 다음과 같은 구조로 설계됩니다:

```
backend-fastapi-py/
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── flow_execution.py     # 플로우 실행 엔드포인트
│   │   │   ├── llm.py                # LLM 관련 엔드포인트
│   │   │   ├── web_crawler.py        # 웹 크롤링 엔드포인트
│   │   │   └── api_proxy.py          # API 프록시 엔드포인트
│   ├── core/
│   │   ├── config.py                 # 앱 설정
│   │   └── security.py               # 보안 관련 기능
│   ├── flow_engine/
│   │   ├── engine.py                 # 플로우 실행 엔진
│   │   ├── context.py                # 실행 컨텍스트
│   │   └── factory.py                # 노드 팩토리
│   ├── nodes/
│   │   ├── base.py                   # 기본 노드 클래스
│   │   ├── html_parser_node.py       # HTML 파서 노드
│   │   ├── web_crawler_node.py       # 웹 크롤러 노드
│   │   ├── llm_node.py               # LLM 노드
│   │   └── ...                       # 기타 노드 구현
│   ├── services/
│   │   ├── llm_service.py            # LLM 서비스
│   │   ├── web_crawler_service.py    # 웹 크롤링 서비스
│   │   └── api_service.py            # API 호출 서비스
│   └── main.py                       # 앱 진입점
```

### 2. 주요 컴포넌트

#### 2.1 플로우 실행 엔진 (`flow_engine/engine.py`)

플로우 실행 엔진은 JSON 형식의 플로우 맵을 받아 노드와 엣지를 분석하고 올바른 순서로 실행합니다:

```python
class FlowExecutionEngine:
    def __init__(self):
        self.node_factory = NodeFactory()
        
    async def execute_flow(self, flow_data: dict) -> dict:
        """
        JSON 플로우 맵을 실행하고 결과를 반환합니다.
        
        Args:
            flow_data: 프론트엔드에서 생성된 JSON 플로우 맵
            
        Returns:
            실행 결과 (각 노드의 출력 포함)
        """
        # 실행 컨텍스트 생성
        context = ExecutionContext()
        
        # 노드와 엣지 추출
        nodes = flow_data.get("nodes", [])
        edges = flow_data.get("edges", [])
        
        # 실행 그래프 생성
        execution_graph = self._build_execution_graph(nodes, edges)
        
        # 노드 인스턴스 생성
        node_instances = {}
        for node_data in nodes:
            node_id = node_data.get("id")
            node_type = node_data.get("type")
            node_content = node_data.get("data", {}).get("content", {})
            
            node = self.node_factory.create_node(node_type, node_id, node_content)
            node_instances[node_id] = node
        
        # 시작 노드 식별 (들어오는 엣지가 없는 노드들)
        start_nodes = self._identify_start_nodes(execution_graph)
        
        # 플로우 실행
        for start_node_id in start_nodes:
            await self._execute_node(start_node_id, node_instances, execution_graph, context)
        
        return context.get_results()
    
    # 나머지 헬퍼 메소드들...
```

#### 2.2 노드 팩토리 (`flow_engine/factory.py`)

다양한 노드 타입을 생성하는 팩토리 패턴 구현:

```python
class NodeFactory:
    def __init__(self):
        self._registry = {}
        self._register_default_nodes()
    
    def _register_default_nodes(self):
        """기본 노드 타입들을 등록합니다."""
        self.register("html-parser", HTMLParserNode)
        self.register("web-crawler", WebCrawlerNode)
        self.register("llm", LLMNode)
        self.register("api", APINode)
        self.register("output", OutputNode)
        # 추가 노드 타입 등록...
    
    def register(self, node_type: str, node_class: Type[BaseNode]):
        """새 노드 타입을 등록합니다."""
        self._registry[node_type] = node_class
    
    def create_node(self, node_type: str, node_id: str, node_content: dict) -> BaseNode:
        """등록된 노드 타입에 따라 노드 인스턴스를 생성합니다."""
        if node_type not in self._registry:
            raise ValueError(f"Unknown node type: {node_type}")
        
        return self._registry[node_type](node_id, node_content)
```

#### 2.3 기본 노드 클래스 (`nodes/base.py`)

모든 노드 구현의 기초가 되는 추상 클래스:

```python
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, List

class BaseNode(ABC):
    def __init__(self, node_id: str, content: Dict[str, Any]):
        self.node_id = node_id
        self.content = content
        self.context = None
    
    def set_context(self, context):
        """실행 컨텍스트를 설정합니다."""
        self.context = context
    
    async def process(self, input_data: Any = None) -> Any:
        """
        노드 실행 로직의 공통 워크플로우입니다.
        1. 상태를 'running'으로 설정
        2. execute 메소드 호출
        3. 결과 저장
        4. 상태를 'success'로 설정
        """
        try:
            # 실행 시작 로깅
            self.context.log_node_start(self.node_id)
            
            # 실제 노드 로직 실행
            result = await self.execute(input_data)
            
            # 결과 저장
            self.context.store_output(self.node_id, result)
            
            # 성공 상태 기록
            self.context.mark_node_success(self.node_id)
            
            return result
        except Exception as e:
            # 오류 기록
            self.context.mark_node_error(self.node_id, str(e))
            raise
    
    @abstractmethod
    async def execute(self, input_data: Any = None) -> Any:
        """
        각 노드 타입별로 구현해야 하는 실제 로직입니다.
        """
        pass
```

### 3. 노드 구현 예시

#### 3.1 HTML 파서 노드

```python
class HTMLParserNode(BaseNode):
    async def execute(self, input_data: Any = None) -> Dict[str, Any]:
        """
        HTML 파싱 및 데이터 추출 구현
        """
        # HTML 문자열 추출
        html_content = self._get_html_content(input_data)
        if not html_content:
            return input_data
            
        # 추출 규칙 가져오기
        extraction_rules = self.content.get("extractionRules", [])
        if not extraction_rules:
            return html_content
            
        # 결과 객체 초기화
        result = {}
        
        # BeautifulSoup을 사용하여 HTML 파싱
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # 각 규칙에 따라 데이터 추출
        for rule in extraction_rules:
            rule_name = rule.get("name")
            selector = rule.get("selector")
            target = rule.get("target", "text")  # text, html, attribute
            attribute = rule.get("attribute_name")
            multiple = rule.get("multiple", False)
            
            # 선택자를 사용하여 요소 찾기
            elements = soup.select(selector)
            
            if multiple:
                # 다중 요소 처리
                result[rule_name] = []
                for el in elements:
                    if target == "text":
                        result[rule_name].append(el.get_text().strip())
                    elif target == "html":
                        result[rule_name].append(str(el))
                    elif target == "attribute" and attribute:
                        attr_value = el.get(attribute)
                        if attr_value:
                            result[rule_name].append(attr_value)
            else:
                # 단일 요소 처리
                if elements:
                    el = elements[0]
                    if target == "text":
                        result[rule_name] = el.get_text().strip()
                    elif target == "html":
                        result[rule_name] = str(el)
                    elif target == "attribute" and attribute:
                        result[rule_name] = el.get(attribute)
        
        return result
    
    def _get_html_content(self, input_data):
        """다양한 입력 형식에서 HTML 콘텐츠 추출"""
        if not input_data:
            return None
            
        if isinstance(input_data, str):
            return input_data
            
        if isinstance(input_data, dict):
            # .html 또는 .text 필드 확인
            if "html" in input_data:
                return input_data["html"]
            if "text" in input_data:
                return input_data["text"]
                
        return None
```

#### 3.2 웹 크롤러 노드

```python
class WebCrawlerNode(BaseNode):
    async def execute(self, input_data: Any = None) -> Dict[str, str]:
        """웹 페이지 크롤링 구현"""
        # 목표 URL 결정
        target_url = self._get_target_url(input_data)
        if not target_url:
            raise ValueError("No URL specified for web crawler")
            
        # 설정 값 가져오기
        wait_selector = self.content.get("waitForSelector")
        timeout = self.content.get("timeout", 30000)  # 기본 30초
        headers = self.content.get("headers", {})
        
        # WebCrawlerService 사용하여 크롤링 수행
        service = WebCrawlerService()
        result = await service.fetch_url(
            url=target_url,
            wait_for_selector=wait_selector,
            timeout_ms=timeout,
            headers=headers
        )
        
        return result
    
    def _get_target_url(self, input_data):
        """입력 데이터 또는 노드 콘텐츠에서 URL 추출"""
        # 노드 콘텐츠의 URL 확인
        content_url = self.content.get("url")
        
        # 입력이 문자열이면 URL로 사용
        if isinstance(input_data, str) and input_data.startswith(("http://", "https://")):
            return input_data
            
        # 입력이 객체면 url 필드 확인
        if isinstance(input_data, dict) and "url" in input_data:
            return input_data["url"]
            
        # 기본값으로 콘텐츠 URL 반환
        return content_url
```

### 4. API 엔드포인트 구현

#### 4.1 플로우 실행 엔드포인트 (`api/routes/flow_execution.py`)

```python
from fastapi import APIRouter, Depends, HTTPException
from app.flow_engine.engine import FlowExecutionEngine
from app.schemas.flow import FlowExecutionRequest, FlowExecutionResponse

router = APIRouter()

@router.post("/execute", response_model=FlowExecutionResponse)
async def execute_flow(request: FlowExecutionRequest):
    """
    JSON 플로우 맵을 받아 실행하고 결과를 반환합니다.
    """
    try:
        engine = FlowExecutionEngine()
        result = await engine.execute_flow(request.flow_data)
        return FlowExecutionResponse(
            success=True,
            results=result
        )
    except Exception as e:
        return FlowExecutionResponse(
            success=False,
            error=str(e)
        )
```

#### 4.2 개별 노드 실행 엔드포인트

```python
@router.post("/execute-node/{node_type}")
async def execute_single_node(
    node_type: str,
    node_content: dict,
    input_data: Any = None
):
    """
    단일 노드를 실행하고 결과를 반환합니다.
    """
    try:
        # 노드 팩토리 생성
        factory = NodeFactory()
        
        # 임시 ID로 노드 생성
        node = factory.create_node(node_type, "temp_node_id", node_content)
        
        # 임시 컨텍스트 생성
        context = ExecutionContext()
        node.set_context(context)
        
        # 노드 실행
        result = await node.process(input_data)
        
        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
```

### 5. 프론트엔드와의 호환성 유지

#### 5.1 데이터 구조 호환성

백엔드는 프론트엔드와 동일한 노드 데이터 구조를 사용해야 합니다:

```python
# schemas/flow.py
from typing import List, Dict, Any
from pydantic import BaseModel

class NodeContent(BaseModel):
    """프론트엔드의 노드 콘텐츠와 호환되는 스키마"""
    # 공통 필드
    label: str = ""
    
    # 추가 필드는 각 노드 타입에 따라 다름
    # 동적 확장을 위해 추가 필드 허용
    class Config:
        extra = "allow"

class NodeData(BaseModel):
    """노드 데이터 스키마"""
    id: str
    type: str
    position: Dict[str, float]
    data: Dict[str, Any] = {}
    
    class Config:
        extra = "allow"

class Edge(BaseModel):
    """엣지 스키마"""
    id: str
    source: str
    target: str
    sourceHandle: str = None
    targetHandle: str = None
    
    class Config:
        extra = "allow"

class FlowData(BaseModel):
    """전체 플로우 데이터 스키마"""
    nodes: List[NodeData]
    edges: List[Edge]

class FlowExecutionRequest(BaseModel):
    """플로우 실행 요청"""
    flow_data: FlowData

class FlowExecutionResponse(BaseModel):
    """플로우 실행 응답"""
    success: bool
    results: Dict[str, Any] = None
    error: str = None
```

#### 5.2 노드 타입별 호환성

각 노드는 프론트엔드 구현체와 동일한 입출력 형식을 따라야 합니다:

1. **입력 처리**: 각 노드는 다양한 입력 형식을 처리할 수 있어야 합니다
2. **출력 형식**: 프론트엔드 노드와 동일한 형식으로 결과를 반환해야 합니다
3. **설정 이름**: 노드 콘텐츠의 필드 이름이 프론트엔드와 정확히 일치해야 합니다

예를 들어, HTML 파서 노드는 `extractionRules` 필드가 반드시 프론트엔드와 동일한 구조여야 합니다.

### 6. 실행 컨텍스트 구현 (`flow_engine/context.py`)

실행 컨텍스트는 노드 간 데이터 흐름과 실행 상태를 관리합니다:

```python
class ExecutionContext:
    def __init__(self):
        self.execution_id = str(uuid.uuid4())
        self.outputs = {}  # 노드 ID -> 출력 배열
        self.statuses = {}  # 노드 ID -> 상태
        self.errors = {}   # 노드 ID -> 오류 메시지
        self.logs = []     # 실행 로그
    
    def store_output(self, node_id: str, output: Any):
        """노드 출력을 저장합니다."""
        if node_id not in self.outputs:
            self.outputs[node_id] = []
        
        if isinstance(output, list):
            # 배열 출력 처리
            self.outputs[node_id].extend(output)
        else:
            # 단일 값 출력 처리
            self.outputs[node_id].append(output)
    
    def get_outputs(self, node_id: str) -> List[Any]:
        """노드의 모든 출력값을 반환합니다."""
        return self.outputs.get(node_id, [])
    
    def get_last_output(self, node_id: str) -> Any:
        """노드의 마지막 출력값을 반환합니다."""
        outputs = self.get_outputs(node_id)
        return outputs[-1] if outputs else None
    
    def mark_node_success(self, node_id: str):
        """노드를 성공 상태로 표시합니다."""
        self.statuses[node_id] = "success"
    
    def mark_node_error(self, node_id: str, error_message: str):
        """노드를 오류 상태로 표시합니다."""
        self.statuses[node_id] = "error"
        self.errors[node_id] = error_message
    
    def log_node_start(self, node_id: str):
        """노드 실행 시작을 로깅합니다."""
        self.statuses[node_id] = "running"
        self.logs.append({
            "time": datetime.now().isoformat(),
            "node_id": node_id,
            "event": "start"
        })
    
    def get_results(self) -> Dict[str, Any]:
        """전체 실행 결과를 반환합니다."""
        return {
            "execution_id": self.execution_id,
            "outputs": self.outputs,
            "statuses": self.statuses,
            "errors": self.errors,
            "logs": self.logs
        }
```

### 7. 확장 및 유지보수

#### 7.1 새로운 노드 타입 추가

새로운 노드 타입을 추가하려면:

1. `nodes/` 디렉토리에 새 노드 클래스 구현
2. `BaseNode` 상속 및 `execute` 메소드 구현
3. `NodeFactory`에 새 노드 타입 등록

#### 7.2 CI/CD 및 테스트

1. 노드 구현에 대한 단위 테스트 작성
2. 통합 테스트를 통한 전체 플로우 실행 검증
3. 프론트엔드와의 호환성 테스트 자동화

#### 7.3 버전 관리 및 마이그레이션

노드 구현이 변경될 때는 프론트엔드와의 호환성을 유지하기 위한 버전 관리가 필요합니다:

1. API 버전 관리 (예: `/api/v1/flow/execute`)
2. 구버전 노드 타입 지원을 위한 어댑터 패턴 사용
3. 마이그레이션 유틸리티 제공

### 결론

이 문서에서 설명한 아키텍처를 따라 구현하면 프론트엔드에서 생성된 JSON 플로우 맵을 실행할 수 있는 강력한 백엔드 시스템을 구축할 수 있습니다. 핵심은 모든 노드 타입에 대해 프론트엔드와 동일한 인터페이스와 데이터 구조를 유지하는 것입니다. 이를 통해 사용자는 GUI에서 설계한 워크플로우를 백엔드에서 그대로 실행할 수 있습니다. 