from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # .env 파일 또는 환경 변수에서 로드될 설정 정의
    # 예: LOG_LEVEL: str = "INFO"
    
    # 현재 사용되지 않지만 향후 추가될 수 있는 설정 예시
    # DEFAULT_CRAWLER_TIMEOUT_MS: int = 30000 

    # .env 파일 로드 설정 (선택적)
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

settings = Settings() 