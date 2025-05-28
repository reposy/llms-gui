# llms-gui: 시각적 LLM 자동화 워크플로우 빌더

**llms-gui**는 노드 기반 GUI 환경에서 LLM, API, 웹 크롤러 등 다양한 도구를 연결하여, 블로그 포스팅·데이터 분석 등 복잡한 프로세스를 한눈에 설계·실행할 수 있는 오픈소스 자동화 플랫폼입니다.

## 주요 특징

- **시각적 플로우 편집**: 드래그&드롭으로 노드를 배치·연결, 복잡한 워크플로우를 직관적으로 설계
- **다양한 노드 타입**: LLM(Ollama, OpenAI), API 호출, 웹 크롤링, HTML 파싱, JSON 추출, 조건 분기, 데이터 병합 등 지원
- **실시간 실행/결과 확인**: 각 노드의 실행 상태와 결과를 플로우 에디터 내에서 실시간 확인
- **그룹/반복 실행**: 노드 그룹화, 입력 데이터에 따른 반복 실행
- **확장성**: 새로운 노드 타입, 실행 전략, 입력 매핑 등 손쉽게 확장 가능
- **프론트엔드 기반 처리**: HTML 파싱 등 일부 무거운 작업은 프론트엔드에서 처리

## 빠른 시작

### 1. 요구 사항

- Node.js (v18+), npm 또는 yarn
- Python (v3.9+), pip 또는 poetry
- Docker, docker-compose (권장)
- (선택) Ollama (로컬 LLM 사용 시)

### 2. 환경 변수

- `.env` 파일 또는 환경 변수로 `OPENAI_API_KEY` 등 필요시 설정

### 3. docker-compose로 실행 (권장)

```bash
docker-compose up --build
```
- 프론트엔드: http://localhost:5173
- 백엔드: http://localhost:8000

### 4. 개별 실행 (개발용)

#### 프론트엔드

```bash
cd frontend-react-ts
npm install
npm run dev
```

#### 백엔드

```bash
cd backend-fastapi-py
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## 문서/가이드

최신 구조/패턴/네이밍/상태관리 원칙은 `/project-meta` 디렉토리의 문서에서 확인하세요.

- **아키텍처**: [`01_ARCHITECTURE/overview.md`](project-meta/01_ARCHITECTURE/overview.md), [`frontend_architecture.md`](project-meta/01_ARCHITECTURE/frontend_architecture.md), [`backend_architecture.md`](project-meta/01_ARCHITECTURE/backend_architecture.md)
- **노드 타입**: [`02_NODES/overview.md`](project-meta/02_NODES/overview.md) 및 각 노드별 문서
- **핵심 개념**: [`03_CONCEPTS/project_principles.md`](project-meta/03_CONCEPTS/project_principles.md), [`data_flow_and_execution.md`](project-meta/03_CONCEPTS/data_flow_and_execution.md)
- **개발 가이드**: [`04_GUIDES/adding_new_node.md`](project-meta/04_GUIDES/adding_new_node.md), [`debugging_flows.md`](project-meta/04_GUIDES/debugging_flows.md)

> **문서 최신화 원칙**  
> 2024.06 리팩토링 이후, 모든 문서는 실제 코드/구조/네이밍/상태관리와 100% 일치하도록 유지됩니다.  
> 문서와 코드가 불일치할 경우, 반드시 문서를 최신 코드에 맞게 직접 업데이트해 주세요.

## 기술 스택

- **Frontend**: React, TypeScript, zustand, @xyflow/react, TailwindCSS 등
- **Backend**: FastAPI, httpx, playwright, beautifulsoup4, lxml 등
- **LLM**: Ollama, OpenAI 등 연동 지원

## 기여/문의

- 문서/코드 개선, 버그 리포트, 기능 제안 등 환영합니다.
- 자세한 개발/확장 가이드는 `/project-meta/04_GUIDES/adding_new_node.md` 참고

---

**TODO**
- 테스트 코드 및 coverage 강화
- 예시 플로우/샘플 데이터 추가
- CI/CD, 배포 가이드 보강
