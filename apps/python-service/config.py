import os
from pydantic import BaseModel

class Settings(BaseModel):
    service_name: str = "AgentSphere-Python-Service"
    port: int = int(os.getenv("PYTHON_PORT", "8000"))
    environment: str = os.getenv("ENVIRONMENT", "development")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "mock-openai-key")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "mock-anthropic-key")
    default_provider: str = os.getenv("DEFAULT_MODEL_PROVIDER", "mock")
    fallback_provider: str = os.getenv("FALLBACK_MODEL_PROVIDER", "mock-fallback")
    embedding_dimension: int = int(os.getenv("EMBEDDING_DIMENSION", "1536"))
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "500"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "50"))

settings = Settings()
