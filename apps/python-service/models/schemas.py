from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# Document Pipeline Schemas
class DocumentExtractRequest(BaseModel):
    content_raw: Optional[str] = None
    filename: str
    mime_type: str = "text/plain"
    tenant_id: str

class ChunkResult(BaseModel):
    chunk_index: int
    content: str
    token_count: int
    character_count: int
    metadata: Dict[str, Any] = Field(default_factory=dict)
    embedding: Optional[List[float]] = None

class DocumentChunkRequest(BaseModel):
    text: str
    filename: str
    tenant_id: str
    chunk_size: int = 500
    chunk_overlap: int = 50
    generate_embeddings: bool = True

class DocumentChunkResponse(BaseModel):
    success: bool
    filename: str
    total_chunks: int
    total_tokens: int
    chunks: List[ChunkResult]

# Embedding Schemas
class EmbeddingRequest(BaseModel):
    texts: List[str]
    tenant_id: str
    model: str = "text-embedding-3-small"

class EmbeddingResponse(BaseModel):
    model: str
    embeddings: List[List[float]]
    tokens_used: int

class SimilaritySearchRequest(BaseModel):
    query_text: str
    candidate_chunks: List[Dict[str, Any]] # Each chunk has 'id', 'content', 'embedding'
    top_k: int = 3
    tenant_id: str

class ScoredChunk(BaseModel):
    id: str
    content: str
    score: float
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SimilaritySearchResponse(BaseModel):
    query: str
    top_chunks: List[ScoredChunk]

# Model Gateway Schemas
class Message(BaseModel):
    role: str # "system", "user", "assistant", "tool"
    content: str

class ChatCompletionRequest(BaseModel):
    tenant_id: str
    agent_id: Optional[str] = None
    model: str = "gpt-4o"
    messages: List[Message]
    temperature: float = 0.7
    max_tokens: int = 2048
    stream: bool = False
    provider_override: Optional[str] = None

class ChatCompletionResponse(BaseModel):
    id: str
    model: str
    provider: str
    reply: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float
    latency_ms: float
    is_fallback: bool = False

# Guardrail Schemas
class GuardrailCheckRequest(BaseModel):
    tenant_id: str
    text: str
    check_pii: bool = True
    check_prompt_injection: bool = True

class GuardrailCheckResponse(BaseModel):
    is_safe: bool
    risk_level: str # "LOW", "MEDIUM", "HIGH"
    detected_patterns: List[str] = Field(default_factory=list)
    sanitized_text: str
    action_taken: str # "PASSED", "MASKED", "BLOCKED"
