# Incident Runbook 03: Primary Provider Outage & Seamless Failover

## Metadata
- **Incident ID:** INC-003
- **Severity:** High
- **Category:** Availability & Upstream Dependency Outage
- **Detection Mechanism:** HTTP 5xx / Timeout circuit breaker

## Symptoms
Upstream LLM provider experiences network degradation, rate limits, or 503 Service Unavailable errors, leading to hung agent steps.

## Root Cause Analysis (RCA)
- Direct coupling between core backend and a single external AI vendor API.

## Architectural Defense & Prevention
1. **Model Gateway Abstraction:** Node.js backend routes model calls through the FastAPI model gateway.
2. **Exponential Backoff & Automatic Fallback:** If primary model fails or times out across 2 retries, the gateway switches to secondary fallback adapter (`mock-fallback` / Anthropic adapter).
3. **Automated Verification:** Verified in `apps/python-service/tests/test_model_gateway.py` and `scripts/simulate_incidents.py`.
