# llms-gui: LLM 기반 자동화 워크플로우 빌더

llms-gui는 사용자가 노드 기반 인터페이스를 통해 다양한 LLM 및 외부 도구(API, 웹 크롤러 등)를 연결하여 복잡한 자동화 워크플로우를 시각적으로 구축하고 실행할 수 있는 웹 애플리케이션입니다.

## 주요 기능

*   **시각적 플로우 편집:** 드래그 앤 드롭 인터페이스로 노드를 배치하고 연결하여 워크플로우를 설계합니다.
*   **다양한 노드 타입:** LLM(Ollama, OpenAI), API 호출, 웹 크롤링, HTML 파싱, JSON 추출, 조건부 분기, 데이터 병합 등 다양한 기능을 제공하는 노드를 지원합니다.
*   **실시간 실행 및 결과 확인:** 각 노드의 실행 상태와 결과를 플로우 에디터 내에서 실시간으로 확인할 수 있습니다.
*   **그룹 및 반복 실행:** 여러 노드를 그룹화하고 입력 데이터에 따라 반복 실행하는 기능을 지원합니다.
*   **프론트엔드 기반 처리:** HTML 파싱 등 일부 무거운 작업은 프론트엔드에서 처리하여 백엔드 부하를 줄입니다.

## 설치 및 설정

### 요구 사항

*   Node.js (v18 이상 권장)
*   npm 또는 yarn
*   Python (v3.9 이상 권장)
*   pip 또는 poetry
*   (선택 사항) Docker
*   (선택 사항) Ollama (로컬 LLM 사용 시)

### Frontend 설정

```bash
cd frontend-react-ts
npm install
# 또는 yarn install
```

### Backend 설정

```bash
cd backend-fastapi-py
# Poetry 사용 시
poetry install
# 또는 pip 사용 시
pip install -r requirements.txt
```

## 애플리케이션 실행

### Frontend 실행

```bash
cd frontend-react-ts
npm run dev
# 또는 yarn dev
```
Frontend는 기본적으로 `http://localhost:5173` 에서 실행됩니다.

### Backend 실행

```bash
cd backend-fastapi-py
# Poetry 사용 시
poetry run uvicorn main:app --reload --port 8000
# 또는 직접 실행 시
uvicorn main:app --reload --port 8000
```
Backend는 기본적으로 `http://localhost:8000` 에서 실행됩니다.

## 상세 가이드

프로젝트 아키텍처, 각 노드 상세 설명 등 더 자세한 내용은 `/project-meta` 디렉토리의 가이드 문서들을 참고하세요.

*   `ARCHITECTURE.md`: 프로젝트 구조, 기술 스택, 데이터 흐름 등
*   `NODES.md`: 각 노드 타입별 상세 설명 및 사용법
