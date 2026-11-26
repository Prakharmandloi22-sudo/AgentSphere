# AgentSphere System Architecture

## 1. High-Level Modular Architecture

AgentSphere follows a modular microservice architecture designed for multi-tenant isolation, resilience, and horizontal scalability.

```mermaid
flowchart TD
    subgraph Client Layer
        Web["Next.js App Router Frontend (Port 3000)"]
    end

    subgraph API Gateway & Core API
        Core["Node.js / Express Core Backend (Port 4000)"]
        Auth["JWT / API Key & RBAC Middleware"]
        Orch["Agent Orchestration Engine"]
        Sec["AES-256-GCM Security & Guardrail Shield"]
    end

    subgraph Python Processing Service
        PySvc["FastAPI Gateway & Pipeline (Port 8000)"]
        DocExtract["Document Extraction & Chunking"]
        Embeddings["Embedding Generation"]
        ModelGate["Model Gateway (OpenAI / Anthropic / Fallback)"]
    end

    subgraph Persistence & Infrastructure
        PG[("PostgreSQL 16 + pgvector")]
        Redis[("Redis 7 (Cache & Jobs)")]
    end

    Web -->|REST / JSON| Core
    Core --> Auth
    Auth --> Orch
    Orch --> Sec
    Orch -->|HTTP / JSON| PySvc
    Core --> PG
    Core --> Redis
    PySvc --> PG
```

## 2. Service Responsibilities & Authority

| Service | Primary Responsibility | Data Entities Owned |
| :--- | :--- | :--- |
| **Next.js Web** | User Interface, Canvas, Traces, Approval Cockpit | Client-side UI state, token session cache |
| **Node.js Core API** | Business Logic, Authorization, Orchestration, Budgeting | `tenants`, `users`, `agents`, `prompt_versions`, `tools`, `executions`, `human_approvals`, `usage_metrics`, `audit_logs` |
| **Python FastAPI** | Document text extraction, token chunking, model gateway routing, fallback handling | `document_chunks`, vector embeddings, streaming completions |
| **PostgreSQL** | Durable relational storage, ACID compliance, constraints, indexes | System of record for all platform entities |
| **Redis** | Rate-limiting buckets, execution lock state, asynchronous task queue | Ephemeral locks, cached quota counters |
