import os
import uvicorn
from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Dict, Any

from config import settings
from models.schemas import (
    DocumentExtractRequest, DocumentChunkRequest, DocumentChunkResponse,
    EmbeddingRequest, EmbeddingResponse,
    SimilaritySearchRequest, SimilaritySearchResponse,
    ChatCompletionRequest, ChatCompletionResponse,
    GuardrailCheckRequest, GuardrailCheckResponse
)
from services.document_pipeline import document_pipeline
from services.embedding_service import embedding_service
from services.model_gateway import model_gateway
from services.guardrails import GuardrailsService

app = FastAPI(
    title=settings.service_name,
    description="AgentSphere FastAPI Service: Document Pipeline & Model Gateway",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Health & Readiness Endpoints
@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": settings.service_name,
        "environment": settings.environment,
        "default_provider": settings.default_provider,
        "fallback_provider": settings.fallback_provider
    }

@app.get("/ready")
def readiness_check():
    return {
        "status": "READY",
        "embeddings_dimension": settings.embedding_dimension,
        "providers_online": ["mock", "mock-fallback", "openai", "anthropic"]
    }

# 2. Document Processing & Pipeline Endpoints
@app.post("/documents/extract")
def extract_document(req: DocumentExtractRequest):
    extracted = document_pipeline.extract_text(req.content_raw or "", req.mime_type)
    return {
        "filename": req.filename,
        "mime_type": req.mime_type,
        "extracted_text": extracted,
        "length_chars": len(extracted)
    }

@app.post("/documents/chunk", response_model=DocumentChunkResponse)
def chunk_document(req: DocumentChunkRequest):
    return document_pipeline.chunk_text(
        text=req.text,
        filename=req.filename,
        tenant_id=req.tenant_id,
        chunk_size=req.chunk_size,
        chunk_overlap=req.chunk_overlap,
        generate_embeddings=req.generate_embeddings
    )

@app.get("/documents/benchmark")
def get_benchmark():
    return document_pipeline.run_benchmark()

# 3. Vector Embedding & Search Endpoints
@app.post("/embeddings/generate", response_model=EmbeddingResponse)
def generate_embeddings(req: EmbeddingRequest):
    embeddings = embedding_service.generate_embeddings(req.texts)
    est_tokens = sum(len(t.split()) for t in req.texts) * 1.3
    return EmbeddingResponse(
        model=req.model,
        embeddings=embeddings,
        tokens_used=int(est_tokens)
    )

@app.post("/embeddings/similarity-search", response_model=SimilaritySearchResponse)
def similarity_search(req: SimilaritySearchRequest):
    top_chunks = embedding_service.similarity_search(
        query_text=req.query_text,
        candidates=req.candidate_chunks,
        top_k=req.top_k
    )
    return SimilaritySearchResponse(
        query=req.query_text,
        top_chunks=top_chunks
    )

# 4. Model Gateway Endpoints
@app.post("/gateway/chat/completions", response_model=ChatCompletionResponse)
async def chat_completion(req: ChatCompletionRequest):
    if req.stream:
        return StreamingResponse(
            model_gateway.stream_completion(req),
            media_type="text/event-stream"
        )
    return await model_gateway.execute_with_retry_and_fallback(req)

@app.post("/gateway/simulate-outage")
def toggle_outage(payload: Dict[str, bool]):
    enabled = payload.get("enabled", False)
    model_gateway.set_primary_outage(enabled)
    return {"outage_simulation_active": enabled}

# 5. Guardrails & Prompt Injection Protection
@app.post("/guardrails/check-injection", response_model=GuardrailCheckResponse)
def check_injection(req: GuardrailCheckRequest):
    return GuardrailsService.inspect(
        text=req.text,
        check_pii=req.check_pii,
        check_injection=req.check_prompt_injection
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
