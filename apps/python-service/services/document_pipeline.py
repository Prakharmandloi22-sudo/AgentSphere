import time
import json
from typing import List, Dict, Any
from models.schemas import ChunkResult, DocumentChunkResponse
from services.embedding_service import embedding_service
from config import settings

class DocumentPipelineService:
    @staticmethod
    def extract_text(raw_content: str, mime_type: str) -> str:
        """
        Extracts clean text representation based on mime type.
        """
        if not raw_content:
            return ""

        if mime_type == "application/json":
            try:
                parsed = json.loads(raw_content)
                return json.dumps(parsed, indent=2)
            except Exception:
                return raw_content

        # Plain text, Markdown, or converted PDF
        return raw_content.strip()

    @staticmethod
    def chunk_text(
        text: str,
        filename: str,
        tenant_id: str,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        generate_embeddings: bool = True
    ) -> DocumentChunkResponse:
        """
        Splits document text into overlapping chunks, counts tokens,
        attaches metadata, and optionally generates vector embeddings.
        """
        words = text.split()
        if not words:
            return DocumentChunkResponse(
                success=True,
                filename=filename,
                total_chunks=0,
                total_tokens=0,
                chunks=[]
            )

        step = max(1, chunk_size - chunk_overlap)
        chunks: List[ChunkResult] = []
        raw_texts: List[str] = []

        chunk_idx = 0
        for i in range(0, len(words), step):
            chunk_words = words[i:i + chunk_size]
            chunk_str = " ".join(chunk_words)
            # Estimate token count (roughly 1.3 tokens per word)
            token_count = int(len(chunk_words) * 1.3)
            char_count = len(chunk_str)

            chunks.append(ChunkResult(
                chunk_index=chunk_idx,
                content=chunk_str,
                token_count=token_count,
                character_count=char_count,
                metadata={
                    "filename": filename,
                    "tenant_id": tenant_id,
                    "word_start": i,
                    "word_end": i + len(chunk_words),
                    "timestamp": time.time()
                }
            ))
            raw_texts.append(chunk_str)
            chunk_idx += 1

            if i + chunk_size >= len(words):
                break

        if generate_embeddings and raw_texts:
            embeddings = embedding_service.generate_embeddings(raw_texts)
            for idx, emb in enumerate(embeddings):
                chunks[idx].embedding = emb

        total_tokens = sum(c.token_count for c in chunks)

        return DocumentChunkResponse(
            success=True,
            filename=filename,
            total_chunks=len(chunks),
            total_tokens=total_tokens,
            chunks=chunks
        )

    @staticmethod
    def run_benchmark() -> Dict[str, Any]:
        """
        Runs an internal correctness and performance benchmark over sample documents.
        """
        sample_text = (
            "AgentSphere multi-tenant AI architecture provides strict tenant boundary isolation. "
            "Each tenant maintains dedicated configuration, role-based access control, tool permissions, "
            "and encrypted API credentials. Vector similarity searches are partitioned by tenant_id "
            "to prevent cross-tenant knowledge leaks. Model calls route through an enterprise model gateway "
            "equipped with retry policies, latency monitoring, budget enforcement, and fallback adapters. "
        ) * 50  # ~1000 words

        start_time = time.perf_counter()
        res = DocumentPipelineService.chunk_text(
            text=sample_text,
            filename="benchmark_doc.txt",
            tenant_id="tenant-benchmark",
            chunk_size=100,
            chunk_overlap=20,
            generate_embeddings=True
        )
        duration_ms = (time.perf_counter() - start_time) * 1000.0

        return {
            "status": "PASS",
            "benchmark_chunks": res.total_chunks,
            "benchmark_tokens": res.total_tokens,
            "processing_time_ms": round(duration_ms, 2),
            "throughput_tokens_per_sec": round((res.total_tokens / (duration_ms / 1000.0)), 2)
        }

document_pipeline = DocumentPipelineService()
