import os
from pydantic import BaseModel

class Settings(BaseModel):
    service_name: str = "agentsphere-python-service"
    environment: str = os.getenv("NODE_ENV", "development")
    port: int = int(os.getenv("PYTHON_PORT", "8000"))
    
    # Model Providers
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "mock-openai-key")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "mock-anthropic-key")
    default_model: str = os.getenv("DEFAULT_MODEL", "gpt-4o-mini")
    fallback_model: str = os.getenv("FALLBACK_MODEL", "claude-3-5-sonnet")
    
    # Chunking & Embedding defaults
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "500"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "50"))
    embedding_dimension: int = int(os.getenv("EMBEDDING_DIMENSION", "1536"))
    
    # Gateway Resilience
    gateway_timeout_seconds: float = 30.0
    gateway_max_retries: int = 3
    gateway_backoff_factor: float = 1.5

settings = Settings()
