# AgentSphere Mandatory Hands-On Assessments (01 to 15)

This handbook provides verifiable implementation evidence, architecture summaries, and test execution results for all 15 mandatory assessments required by the technical cohort project brief.

| Assessment | Title | Primary Files | Automated Tests / Verification | Status |
| :--- | :--- | :--- | :--- | :--- |
| **01** | AI SaaS Frontend | `apps/web/src/app/page.tsx`, `layout.tsx` | Next.js production build (`next build`) | **COMPLETE** |
| **02** | AI Platform Backend | `apps/core-api/src/routes/*.ts`, `src/app.ts` | `tests/auth.test.ts`, `tests/auth_and_rbac.test.ts` | **COMPLETE** |
| **03** | AI Data Architecture | `apps/core-api/src/db/migrations/`, `src/db/index.ts` | `tests/tenant_isolation.test.ts` | **COMPLETE** |
| **04** | AI Platform Security | `apps/core-api/src/services/security.service.ts` | `tests/security_and_safety.test.ts` | **COMPLETE** |
| **05** | Python Document Pipeline | `apps/python-service/services/document_pipeline.py` | `tests/test_document_pipeline.py` | **COMPLETE** |
| **06** | FastAPI Model Gateway | `apps/python-service/services/model_gateway.py` | `tests/test_model_gateway.py` | **COMPLETE** |
| **07** | Agent Orchestration Engine | `apps/core-api/src/services/orchestrator.service.ts` | `tests/orchestration.test.ts` | **COMPLETE** |
| **08** | AI Provider Integrations | `apps/python-service/services/model_gateway.py` | Fallback adapter test suite | **COMPLETE** |
| **09** | Docker AI Infrastructure | `docker-compose.yml`, `docker/Dockerfile.*` | Docker Compose validation | **COMPLETE** |
| **10** | Prompt Version Governance | `apps/core-api/src/routes/agent.routes.ts` | Prompt rollback & diff viewer in UI | **COMPLETE** |
| **11** | AI CI/CD and Evaluations | `.github/workflows/ci.yml`, `evals.yml` | GitHub Actions workflow files | **COMPLETE** |
| **12** | AI Safety & Reliability | `apps/core-api/src/services/security.service.ts` | `tests/security_and_safety.test.ts` | **COMPLETE** |
| **13** | AI API Documentation | `docs/api/openapi.json`, `postman_collection.json` | OpenAPI 3.0 & Postman v2.1 collection | **COMPLETE** |
| **14** | AI SaaS Deployment | `scripts/backup_db.sh`, `scripts/restore_db.sh` | Production docker configs & backup scripts | **COMPLETE** |
| **15** | AI Incident Simulation | `docs/incidents/*.md`, `scripts/simulate_incidents.py` | 5 Incident RCA runbooks & python runner | **COMPLETE** |
