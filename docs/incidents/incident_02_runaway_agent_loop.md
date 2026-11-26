# Incident Runbook 02: Runaway Agent Loop Mitigation

## Metadata
- **Incident ID:** INC-002
- **Severity:** Critical
- **Category:** Execution Engine Stability
- **Detection Mechanism:** Step counter bounded threshold

## Symptoms
An agent tasked with solving an ambiguous customer inquiry enters an infinite loop, continuously re-querying tools and prompts without reaching a terminal completion state.

## Root Cause Analysis (RCA)
- Inadequate stopping criteria in dynamic agent task lists.
- Lack of hard upper bounds on step iteration.

## Architectural Defense & Prevention
1. **Bounded Multi-Step Limits:** Every agent record specifies `maxExecutionSteps` (default: 8, hard ceiling: 15).
2. **Loop Guard Breaker:** In `OrchestrationService`, if loop counter `i >= maxSteps`, execution status is set to `FAILED` with message `Runaway execution loop detected`.
3. **Automated Verification:** Verified in `scripts/simulate_incidents.py`.
