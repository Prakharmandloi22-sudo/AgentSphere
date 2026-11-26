import pytest
from services.document_pipeline import document_pipeline
from services.embedding_service import embedding_service

def test_extract_text_plain_and_json():
    plain = document_pipeline.extract_text("Hello World", "text/plain")
    assert plain == "Hello World"

    json_raw = '{"name": "AgentSphere", "active": true}'
    extracted = document_pipeline.extract_text(json_raw, "application/json")
    assert "AgentSphere" in extracted

def test_chunk_text_with_overlap():
    sample = " ".join([f"Word{i}" for i in range(100)])
    result = document_pipeline.chunk_text(
        text=sample,
        filename="test.txt",
        tenant_id="tenant-123",
        chunk_size=30,
        chunk_overlap=5,
        generate_embeddings=True
    )
    assert result.success is True
    assert result.total_chunks > 1
    assert result.chunks[0].chunk_index == 0
    assert len(result.chunks[0].embedding) == 1536
    assert result.chunks[0].metadata["tenant_id"] == "tenant-123"

def test_benchmark_execution():
    bench = document_pipeline.run_benchmark()
    assert bench["status"] == "PASS"
    assert bench["benchmark_chunks"] > 0
    assert bench["processing_time_ms"] > 0

def test_similarity_search_ranking():
    query = "Customer refund procedure"
    candidates = [
        {"id": "c1", "content": "Refunds under 100 dollars are processed automatically within 30 days."},
        {"id": "c2", "content": "Superconducting magnets for particle accelerator physics."},
        {"id": "c3", "content": "Return policy and invoice credit adjustment steps."}
    ]
    results = embedding_service.similarity_search(query, candidates, top_k=2)
    assert len(results) == 2
    assert results[0].score >= -1.0 and results[0].score <= 1.0
