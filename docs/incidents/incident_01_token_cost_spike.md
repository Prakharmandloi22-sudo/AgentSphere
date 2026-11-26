# Incident Runbook 01: Token-Cost Spike Prevention

## Metadata
- **Incident ID:** INC-001
- **Severity:** High
- **Category:** Financial & Cost Controls
- **Detection Mechanism:** Tenant monthly budget limit breaker

## Symptoms
A sudden influx of recursive prompts or unbounded loops rapidly accumulates prompt and completion tokens, threatening to exhaust operational capital.

## Root Cause Analysis (RCA)
- Complex agent task decomposition without token ceilings allows sub-prompts to compound token consumption exponentially.
- Absent circuit breakers at the tenant level permit spend to exceed designated subscription limits.

## Architectural Defense & Prevention
1. **Tenant Monthly Spending Ceilings:** Every tenant has a strict `monthly_budget_usd`.
2. **Pre-Execution Tripwire:** Before initiating step 1 of any workflow, the orchestrator queries `tenant.currentSpendUsd`. If `currentSpendUsd >= monthlyBudgetUsd`, the execution is halted immediately with `BUDGET_EXCEEDED`.
3. **Automated Verification:** Verified in `apps/core-api/tests/security_and_safety.test.ts` and `scripts/simulate_incidents.py`.
