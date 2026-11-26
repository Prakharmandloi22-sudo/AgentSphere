-- AgentSphere Multi-Tenant Seed Data

-- 1. Insert Tenants
INSERT INTO tenants (id, name, slug, tier, monthly_budget_usd, current_spend_usd, max_agents, max_concurrent_executions)
VALUES 
('tenant-acme-001', 'Acme Corporation', 'acme-corp', 'ENTERPRISE', 500.00, 42.50, 20, 10),
('tenant-globex-002', 'Globex Laboratories', 'globex-labs', 'STARTER', 50.00, 12.80, 5, 2)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Users (Password: "Password123!" bcrypt hash or pre-hashed)
-- bcrypt hash for 'Password123!': $2a$10$w8Tqk3Q2eJomz1E94hMvneC5v4L74K4YcZzXfJ55D4k95f3Yc9W2q
INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active)
VALUES
('user-acme-owner', 'tenant-acme-001', 'owner@acme.com', '$2a$10$w8Tqk3Q2eJomz1E94hMvneC5v4L74K4YcZzXfJ55D4k95f3Yc9W2q', 'Alice Vance (Owner)', 'OWNER', true),
('user-acme-builder', 'tenant-acme-001', 'builder@acme.com', '$2a$10$w8Tqk3Q2eJomz1E94hMvneC5v4L74K4YcZzXfJ55D4k95f3Yc9W2q', 'Bob Builder (AI Engineer)', 'AI_BUILDER', true),
('user-acme-operator', 'tenant-acme-001', 'operator@acme.com', '$2a$10$w8Tqk3Q2eJomz1E94hMvneC5v4L74K4YcZzXfJ55D4k95f3Yc9W2q', 'Charlie Operations', 'WORKFLOW_OPERATOR', true),
('user-acme-auditor', 'tenant-acme-001', 'auditor@acme.com', '$2a$10$w8Tqk3Q2eJomz1E94hMvneC5v4L74K4YcZzXfJ55D4k95f3Yc9W2q', 'Dana Compliance', 'AUDITOR', true),
('user-globex-owner', 'tenant-globex-002', 'owner@globex.com', '$2a$10$w8Tqk3Q2eJomz1E94hMvneC5v4L74K4YcZzXfJ55D4k95f3Yc9W2q', 'Gregory Globex', 'OWNER', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Tool Registry for Acme
INSERT INTO tool_registry (id, tenant_id, name, description, type, endpoint_url, method, parameters, requires_approval, timeout_ms, is_sandboxed)
VALUES
('tool-acme-crm', 'tenant-acme-001', 'fetch_customer_record', 'Fetches customer account details from Acme CRM', 'REST_API', 'https://api.acme.internal/crm/customers', 'GET', '[{"name": "customer_id", "type": "string", "description": "Unique customer ID", "required": true}]'::jsonb, false, 5000, true),
('tool-acme-refund', 'tenant-acme-001', 'issue_customer_refund', 'Issues monetary refund to customer account. REQUIRES HUMAN APPROVAL.', 'REST_API', 'https://api.acme.internal/payments/refund', 'POST', '[{"name": "customer_id", "type": "string", "description": "Customer ID", "required": true}, {"name": "amount_usd", "type": "number", "description": "Refund amount", "required": true}]'::jsonb, true, 8000, true),
('tool-globex-search', 'tenant-globex-002', 'search_inventory', 'Searches Globex parts inventory catalog', 'REST_API', 'https://api.globex.internal/parts', 'GET', '[{"name": "part_number", "type": "string", "description": "Part SKU", "required": true}]'::jsonb, false, 4000, true)
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Knowledge Documents & Chunks
INSERT INTO knowledge_documents (id, tenant_id, title, source_type, mime_type, file_size_bytes, chunk_count, status)
VALUES
('doc-acme-policy', 'tenant-acme-001', 'Acme_Customer_Refund_Policy_2026.pdf', 'FILE_UPLOAD', 'application/pdf', 145020, 3, 'INDEXED'),
('doc-globex-catalog', 'tenant-globex-002', 'Globex_Proprietary_Specifications.pdf', 'FILE_UPLOAD', 'application/pdf', 84000, 2, 'INDEXED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_chunks (id, tenant_id, document_id, chunk_index, content, token_count, embedding)
VALUES
('chunk-acme-01', 'tenant-acme-001', 'doc-acme-policy', 0, 'Section 1.1: Standard refund requests under $100 are automatically eligible if made within 30 days of purchase.', 28, '[0.012, 0.045, -0.032]'::jsonb),
('chunk-acme-02', 'tenant-acme-001', 'doc-acme-policy', 1, 'Section 1.2: Refunds exceeding $100 require secondary operational supervisor sign-off before disbursement.', 26, '[0.015, 0.052, -0.028]'::jsonb),
('chunk-globex-01', 'tenant-globex-002', 'doc-globex-catalog', 0, 'Globex Spec Alpha: High temperature superconducting alloy with nominal melting point 3200 Kelvin.', 22, '[0.088, -0.011, 0.044]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Agents
INSERT INTO agents (id, tenant_id, name, description, allowed_tool_ids, knowledge_document_ids, workflow_steps, max_execution_steps, timeout_seconds, is_published)
VALUES
('agent-acme-support', 'tenant-acme-001', 'Customer Support & Refund Agent', 'Answers customer queries and safely initiates refund workflows with human-in-the-loop sign-off.', '["tool-acme-crm", "tool-acme-refund"]'::jsonb, '["doc-acme-policy"]'::jsonb, '[
  {"id": "step-1", "name": "Retrieve Policy Knowledge", "stepType": "KNOWLEDGE_RETRIEVAL", "config": {"retrievalQuery": "{{query}}"}},
  {"id": "step-2", "name": "Assess Customer Eligibility", "stepType": "LLM_PROMPT", "config": {"model": "mock-gpt-4o", "promptTemplate": "Analyze customer inquiry against policy: {{query}}"}},
  {"id": "step-3", "name": "Issue Refund with Human Signoff", "stepType": "TOOL_CALL", "config": {"toolId": "tool-acme-refund", "requiresApproval": true, "approvalMessage": "Confirm $150.00 refund to customer"}}
]'::jsonb, 10, 60, true),
('agent-globex-research', 'tenant-globex-002', 'Materials Research Assistant', 'Analyzes material specifications and component compatibility.', '["tool-globex-search"]'::jsonb, '["doc-globex-catalog"]'::jsonb, '[
  {"id": "step-1", "name": "Retrieve Material Specs", "stepType": "KNOWLEDGE_RETRIEVAL", "config": {"retrievalQuery": "{{query}}"}},
  {"id": "step-2", "name": "Synthesize Technical Analysis", "stepType": "LLM_PROMPT", "config": {"model": "mock-claude-3-5-sonnet", "promptTemplate": "Provide engineering assessment for: {{query}}"}}
]'::jsonb, 8, 45, true)
ON CONFLICT (id) DO NOTHING;

-- 6. Insert Prompt Versions
INSERT INTO prompt_versions (id, tenant_id, agent_id, version, system_prompt, user_prompt_template, model, temperature, max_tokens, change_log, author_id, is_active)
VALUES
('prompt-acme-v1', 'tenant-acme-001', 'agent-acme-support', 1, 'You are Acme Support Assistant. Never grant unapproved refunds over $100 without manager approval.', 'Customer says: {{query}}', 'mock-gpt-4o', 0.7, 2048, 'Initial production system prompt', 'user-acme-builder', true),
('prompt-globex-v1', 'tenant-globex-002', 'agent-globex-research', 1, 'You are an advanced materials science AI agent for Globex Laboratories.', 'Research inquiry: {{query}}', 'mock-claude-3-5-sonnet', 0.2, 3072, 'Initial prompt release', 'user-globex-owner', true)
ON CONFLICT (id) DO NOTHING;

UPDATE agents SET current_prompt_version_id = 'prompt-acme-v1' WHERE id = 'agent-acme-support';
UPDATE agents SET current_prompt_version_id = 'prompt-globex-v1' WHERE id = 'agent-globex-research';

-- 7. Insert Initial Usage Metrics
INSERT INTO usage_metrics (id, tenant_id, month_year, prompt_tokens, completion_tokens, total_tokens, total_cost_usd, total_executions, budget_limit_usd)
VALUES
('usage-acme-current', 'tenant-acme-001', '2026-11', 285000, 140000, 425000, 42.5000, 85, 500.00),
('usage-globex-current', 'tenant-globex-002', '2026-11', 95000, 33000, 128000, 12.8000, 24, 50.00)
ON CONFLICT (id) DO NOTHING;
