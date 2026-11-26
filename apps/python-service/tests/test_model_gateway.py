import asyncio
from services.model_gateway import model_gateway
from models.schemas import ChatCompletionRequest, Message

def test_chat_completion_success_path():
    async def _run():
        req = ChatCompletionRequest(
            tenant_id="tenant-acme-001",
            messages=[
                Message(role="system", content="You are a helpful assistant."),
                Message(role="user", content="How do I get a refund for my order?")
            ]
        )
        res = await model_gateway.execute_with_retry_and_fallback(req)
        assert res.provider == "mock"
        assert res.prompt_tokens > 0
        assert res.completion_tokens > 0
        assert res.total_tokens == res.prompt_tokens + res.completion_tokens
        assert res.cost_usd > 0
        assert res.is_fallback is False
        assert "refund" in res.reply.lower()

    asyncio.run(_run())

def test_chat_completion_fallback_trigger_on_outage():
    async def _run():
        model_gateway.set_primary_outage(True)
        try:
            req = ChatCompletionRequest(
                tenant_id="tenant-globex-002",
                messages=[Message(role="user", content="Explain high temperature alloy specs.")]
            )
            res = await model_gateway.execute_with_retry_and_fallback(req)
            assert res.is_fallback is True
            assert res.provider == "mock-fallback"
            assert "[FALLBACK ADAPTER]" in res.reply
        finally:
            model_gateway.set_primary_outage(False)

    asyncio.run(_run())
