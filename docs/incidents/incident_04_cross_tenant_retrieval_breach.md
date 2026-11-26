# Incident Runbook 04: Cross-Tenant Knowledge Retrieval Breach

## Metadata
- **Incident ID:** INC-004
- **Severity:** Critical
- **Category:** Data Privacy & Tenant Isolation
- **Detection Mechanism:** Tenant ID relational constraint & token middleware

## Symptoms
A malicious user from Tenant B requests information or submits a vector similarity query crafted to retrieve proprietary documents belonging to Tenant A.

## Root Cause Analysis (RCA)
- Inadequate row-level tenant filtering in vector search queries.

## Architectural Defense & Prevention
1. **Strict Partitioning by `tenant_id`:** Document chunks and embeddings are stored with explicit foreign key to `tenants(id)`.
2. **Context Enforcement:** All queries in `DataStore` filter strictly by `where tenant_id = req.user.tenantId`. Attempts to query cross-tenant documents return 404.
3. **Automated Verification:** Verified in `apps/core-api/tests/tenant_isolation.test.ts`.
