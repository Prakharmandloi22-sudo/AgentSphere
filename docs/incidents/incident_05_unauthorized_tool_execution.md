# Incident Runbook 05: Unauthorized Tool Execution Attempt

## Metadata
- **Incident ID:** INC-005
- **Severity:** Critical
- **Category:** Agent Sandboxing & Least Privilege
- **Detection Mechanism:** Server-side Tool Allowlist Validator

## Symptoms
Adversarial prompt injection tricks an LLM into producing a function call targeting an unapproved administrative or destructive tool.

## Root Cause Analysis (RCA)
- Relying on model compliance rather than strict server-side authorization enforcement.

## Architectural Defense & Prevention
1. **Server-Side Tool Allowlist:** Agent configuration includes an immutable `allowedToolIds` array.
2. **Pre-Execution Check:** Before invoking any tool in `OrchestrationService`, the engine verifies `agent.allowedToolIds.includes(toolId)`. If not present, execution is terminated immediately with status `FAILED`.
3. **Automated Verification:** Verified in `apps/core-api/tests/security_and_safety.test.ts`.
