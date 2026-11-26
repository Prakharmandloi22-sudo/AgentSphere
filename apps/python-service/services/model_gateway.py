import time
import uuid
import asyncio
from typing import AsyncGenerator, Dict, Any, List
from models.schemas import ChatCompletionRequest, ChatCompletionResponse, Message
from config import settings

class ModelGatewayService:
    def __init__(self):
        # Pricing per 1000 tokens in USD
        self.pricing = {
            "gpt-4o": {"prompt": 0.005, "completion": 0.015},
            "claude-3-5-sonnet": {"prompt": 0.003, "completion": 0.015},
            "mock-gpt-4o": {"prompt": 0.002, "completion": 0.006},
            "mock-fallback": {"prompt": 0.001, "completion": 0.003}
        }
        self.simulate_primary_outage = False

    def set_primary_outage(self, enabled: bool):
        self.simulate_primary_outage = enabled

    def _estimate_tokens(self, text: str) -> int:
        return max(1, int(len(text.split()) * 1.3))

    def _calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        rate = self.pricing.get(model, self.pricing["mock-gpt-4o"])
        cost = (prompt_tokens / 1000.0 * rate["prompt"]) + (completion_tokens / 1000.0 * rate["completion"])
        return round(cost, 6)

    async def execute_with_retry_and_fallback(self, request: ChatCompletionRequest) -> ChatCompletionResponse:
        start_time = time.perf_counter()
        provider = request.provider_override or settings.default_provider
        is_fallback = False

        # Build prompt string for token estimation
        full_prompt = " ".join([m.content for m in request.messages])
        prompt_tokens = self._estimate_tokens(full_prompt)

        # Primary attempt with retry logic
        success = False
        reply_content = ""
        used_model = request.model
        used_provider = provider

        for attempt in range(2): # Up to 2 retries
            try:
                if self.simulate_primary_outage and provider != "mock-fallback":
                    raise ConnectionError("Primary AI provider 503 Service Unavailable / Gateway Timeout")

                # Mock generation response based on the query
                last_msg = request.messages[-1].content if request.messages else "Hello"
                reply_content = self._generate_mock_reply(last_msg, used_model)
                success = True
                break
            except Exception as e:
                await asyncio.sleep(0.05 * (attempt + 1))

        # If primary failed, trigger fallback provider
        if not success:
            is_fallback = True
            used_provider = settings.fallback_provider
            used_model = "mock-fallback"
            last_msg = request.messages[-1].content if request.messages else "Hello"
            reply_content = f"[FALLBACK ADAPTER] Successfully processed fallback response: {self._generate_mock_reply(last_msg, used_model)}"

        completion_tokens = self._estimate_tokens(reply_content)
        total_tokens = prompt_tokens + completion_tokens
        cost_usd = self._calculate_cost(used_model, prompt_tokens, completion_tokens)
        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return ChatCompletionResponse(
            id=f"chatcmpl-{uuid.uuid4().hex[:12]}",
            model=used_model,
            provider=used_provider,
            reply=reply_content,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cost_usd=cost_usd,
            latency_ms=round(latency_ms, 2),
            is_fallback=is_fallback
        )

    def _generate_mock_reply(self, query: str, model: str) -> str:
        q_lower = query.lower()
        if "refund" in q_lower:
            return "Based on Acme Refund Policy Section 1.1, purchases under $100 are automatically eligible. For requests exceeding $100, secondary operational supervisor approval is required."
        elif "material" in q_lower or "alloy" in q_lower or "globex" in q_lower:
            return "Globex Spec Alpha alloy features a nominal melting point of 3200K and remains superconductive under high thermal stress."
        elif "hello" in q_lower or "hi" in q_lower:
            return f"Hello! I am your AI agent powered by {model}. How can I assist you with your workflow today?"
        else:
            return f"Successfully processed request: '{query}'. Analysis completed with zero anomalies detected."

    async def stream_completion(self, request: ChatCompletionRequest) -> AsyncGenerator[str, None]:
        res = await self.execute_with_retry_and_fallback(request)
        words = res.reply.split(" ")
        for i, word in enumerate(words):
            chunk_data = {
                "id": res.id,
                "delta": word + (" " if i < len(words) - 1 else ""),
                "is_fallback": res.is_fallback
            }
            yield f"data: {chunk_data}\n\n"
            await asyncio.sleep(0.02)
        yield "data: [DONE]\n\n"

model_gateway = ModelGatewayService()
