import hashlib
import numpy as np
from typing import List, Dict, Any
from config import settings
from models.schemas import ScoredChunk

class EmbeddingService:
    def __init__(self, dimension: int = 1536):
        self.dimension = dimension

    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generates normalized vector embeddings.
        Uses deterministic pseudorandom vector generation seeded with hash of input
        to enable fast, robust local testing without external API dependence.
        """
        results: List[List[float]] = []
        for text in texts:
            # Deterministic seed from sha256
            seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)
            rng = np.random.default_rng(seed)
            # Create a 1536-dimensional float vector
            vector = rng.standard_normal(self.dimension)
            # L2 normalize
            norm = np.linalg.norm(vector)
            if norm > 0:
                vector = vector / norm
            results.append(vector.tolist())
        return results

    def similarity_search(self, query_text: str, candidates: List[Dict[str, Any]], top_k: int = 3) -> List[ScoredChunk]:
        """
        Computes cosine similarity between query text embedding and candidate chunk embeddings.
        """
        if not candidates:
            return []

        query_vec = np.array(self.generate_embeddings([query_text])[0])
        scored: List[ScoredChunk] = []

        for item in candidates:
            item_id = item.get("id", "unknown")
            content = item.get("content", "")
            raw_emb = item.get("embedding")
            metadata = item.get("metadata", {})

            if raw_emb:
                cand_vec = np.array(raw_emb)
            else:
                cand_vec = np.array(self.generate_embeddings([content])[0])

            # Cosine similarity
            denom = (np.linalg.norm(query_vec) * np.linalg.norm(cand_vec))
            similarity = float(np.dot(query_vec, cand_vec) / denom) if denom > 0 else 0.0

            scored.append(ScoredChunk(
                id=item_id,
                content=content,
                score=round(similarity, 4),
                metadata=metadata
            ))

        # Sort descending by score
        scored.sort(key=lambda x: x.score, reverse=True)
        return scored[:top_k]

embedding_service = EmbeddingService(dimension=settings.embedding_dimension)
