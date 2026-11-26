-- ==============================================================================
-- AgentSphere Database Schema (PostgreSQL + pgvector)
-- Multi-Tenant AI Agent, Knowledge & Workflow Automation Platform
-- ==============================================================================

-- Enable UUID extension and Vector extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "vector"; -- for pgvector deployments

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'STARTER' CHECK (tier IN ('STARTER', 'PRO', 'ENTERPRISE')),
    monthly_budget_usd NUMERIC(10, 2) NOT NULL DEFAULT 50.00 CHECK (monthly_budget_usd >= 0),
    current_spend_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (current_spend_usd >= 0),
    max_agents INT NOT NULL DEFAULT 5 CHECK (max_agents > 0),
    max_concurrent_executions INT NOT NULL DEFAULT 3 CHECK (max_concurrent_executions > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('OWNER', 'AI_BUILDER', 'WORKFLOW_OPERATOR', 'AUDITOR', 'PLATFORM_ADMIN')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_user_email UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);

-- 3. Scoped API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    scopes TEXT[] NOT NULL DEFAULT '{"agents:read", "executions:write"}',
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_lookup ON api_keys(key_hash, is_revoked);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);

-- 4. Agents Table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    current_prompt_version_id UUID,
    allowed_tool_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    knowledge_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    workflow_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_execution_steps INT NOT NULL DEFAULT 10 CHECK (max_execution_steps BETWEEN 1 AND 25),
    timeout_seconds INT NOT NULL DEFAULT 60 CHECK (timeout_seconds BETWEEN 5 AND 300),
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);

-- 5. Prompt Versions Table (Governance & Semantic Versioning)
CREATE TABLE IF NOT EXISTS prompt_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    version INT NOT NULL,
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT DEFAULT '',
    model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
    temperature NUMERIC(3, 2) NOT NULL DEFAULT 0.7 CHECK (temperature BETWEEN 0.0 AND 2.0),
    max_tokens INT NOT NULL DEFAULT 2048 CHECK (max_tokens BETWEEN 64 AND 8192),
    change_log TEXT DEFAULT '',
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_agent_version UNIQUE (agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent ON prompt_versions(agent_id, is_active);

-- 6. Tools Registry Table
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL indicates platform global tool
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('REST_API', 'DATABASE_QUERY', 'CUSTOM_CODE', 'WEB_SCRAPER')),
    endpoint_url TEXT,
    method VARCHAR(10) DEFAULT 'POST',
    headers_encrypted TEXT,
    parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    timeout_ms INT NOT NULL DEFAULT 5000 CHECK (timeout_ms BETWEEN 500 AND 60000),
    max_retries INT NOT NULL DEFAULT 2 CHECK (max_retries BETWEEN 0 AND 5),
    is_sandboxed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tools_tenant ON tools(tenant_id);

-- 7. Knowledge Documents Table
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('FILE_UPLOAD', 'URL', 'API', 'MANUAL')),
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes INT NOT NULL DEFAULT 0,
    chunk_count INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'INDEXED', 'FAILED')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_tenant ON knowledge_documents(tenant_id);

-- 8. Document Chunks Table
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INT NOT NULL,
    token_count INT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding JSONB, -- fallback JSON or VECTOR(1536) in pgvector
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chunks_tenant_doc ON document_chunks(tenant_id, document_id);

-- 9. Executions Table
CREATE TABLE IF NOT EXISTS executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    initiated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    input_query TEXT NOT NULL,
    final_output TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'WAITING_FOR_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED')),
    total_tokens_used INT NOT NULL DEFAULT 0,
    total_cost_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    duration_ms INT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_executions_tenant_agent ON executions(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(tenant_id, status);

-- 10. Execution Steps Table (Traces & Observability)
CREATE TABLE IF NOT EXISTS execution_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_type VARCHAR(50) NOT NULL CHECK (step_type IN ('LLM_PROMPT', 'TOOL_CALL', 'KNOWLEDGE_RETRIEVAL', 'HUMAN_APPROVAL', 'TRANSFORM')),
    input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_payload JSONB DEFAULT '{}'::jsonb,
    tokens_used INT NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    duration_ms INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'WAITING_APPROVAL', 'SKIPPED')),
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_execution_steps ON execution_steps(execution_id, step_number);

-- 11. Human Approvals Table
CREATE TABLE IF NOT EXISTS human_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    action_details TEXT NOT NULL,
    sensitive_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_comment TEXT
);

CREATE INDEX IF NOT EXISTS idx_human_approvals_tenant ON human_approvals(tenant_id, status);

-- 12. Usage Metrics Table
CREATE TABLE IF NOT EXISTS usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL, -- e.g. "2026-11"
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    total_cost_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    total_executions INT NOT NULL DEFAULT 0,
    budget_limit_usd NUMERIC(10, 2) NOT NULL DEFAULT 50.00,
    CONSTRAINT uq_tenant_month UNIQUE (tenant_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics ON usage_metrics(tenant_id, month_year);

-- 13. Audit Logs Table (Immutable Log)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, timestamp DESC);
