-- ==============================================================================
-- AgentSphere Initial Seed Data (Multi-Tenant Synthetic Sandbox)
-- ==============================================================================

-- 1. Insert Tenants
INSERT INTO tenants (id, name, slug, tier, monthly_budget_usd, current_spend_usd, max_agents, max_concurrent_executions)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Acme Corporation', 'acme-corp', 'ENTERPRISE', 500.00, 14.85, 20, 10),
    ('22222222-2222-2222-2222-222222222222', 'Globex Logistics', 'globex-logistics', 'PRO', 150.00, 8.20, 10, 5),
    ('33333333-3333-3333-3333-333333333333', 'Cyberdyne Systems', 'cyberdyne', 'STARTER', 50.00, 2.10, 3, 2)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Users (Password: "Password123!" hashed with bcrypt)
-- $2a$10$wT3WfEwX16nqy7r3eZl8q.1D4c4b6Y5V8R7U3Y6z7H1J4K2L5M8N0
INSERT INTO users (id, tenant_id, email, name, password_hash, role, is_active)
VALUES
    ('u1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'owner@acme.com', 'Alice Vance (Owner)', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'OWNER', TRUE),
    ('u1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'builder@acme.com', 'Bob Builder (AI Engineer)', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'AI_BUILDER', TRUE),
    ('u1111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111', 'operator@acme.com', 'Charlie Operations', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'WORKFLOW_OPERATOR', TRUE),
    ('u1111111-1111-1111-1111-111111111114', '11111111-1111-1111-1111-111111111111', 'auditor@acme.com', 'Diana Inspector', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'AUDITOR', TRUE),
    ('u2222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'lead@globex.com', 'Evan Wright', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'OWNER', TRUE),
    ('u3333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333333', 'admin@cyberdyne.com', 'Fiona Admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'PLATFORM_ADMIN', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Tools (Built-in global tools and custom tenant tools)
INSERT INTO tools (id, tenant_id, name, description, type, endpoint_url, parameters, requires_approval, timeout_ms, max_retries, is_sandboxed)
VALUES
    ('tool-calc-001', NULL, 'Calculator', 'Executes safe deterministic arithmetic operations', 'CUSTOM_CODE', NULL, 
     '[{"name":"expression","type":"string","description":"Math expression to evaluate e.g. (250*12)/4","required":true}]'::jsonb, 
     FALSE, 3000, 1, TRUE),
    ('tool-http-002', NULL, 'Webhook Dispatcher', 'Dispatches authenticated HTTP requests to verified customer endpoints', 'REST_API', 'https://httpbin.org/post',
     '[{"name":"endpoint","type":"string","description":"Target URL","required":true},{"name":"payload","type":"object","description":"JSON body","required":true}]'::jsonb,
     TRUE, 8000, 2, TRUE),
    ('tool-db-003', '11111111-1111-1111-1111-111111111111', 'Acme Inventory Lookup', 'Queries Acme internal ERP stock levels', 'DATABASE_QUERY', NULL,
     '[{"name":"sku","type":"string","description":"Product SKU identifier","required":true}]'::jsonb,
     FALSE, 5000, 2, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Agents
INSERT INTO agents (id, tenant_id, name, description, max_execution_steps, timeout_seconds, is_published, allowed_tool_ids, knowledge_document_ids, workflow_steps)
VALUES
    ('agent-acme-001', '11111111-1111-1111-1111-111111111111', 'Customer Support & Returns Agent', 
     'Handles return inquiries, verifies order policies, calculates refund amounts, and requests approval for payouts > $100.',
     8, 60, TRUE,
     '["tool-calc-001", "tool-http-002", "tool-db-003"]'::jsonb,
     '["doc-acme-refund-001"]'::jsonb,
     '[
        {"id":"step-1","name":"Policy Retrieval","stepType":"KNOWLEDGE_RETRIEVAL","config":{"retrievalQuery":"refund and return window guidelines"}},
        {"id":"step-2","name":"Eligibility Calculation","stepType":"TOOL_CALL","config":{"toolId":"tool-calc-001"}},
        {"id":"step-3","name":"Manager Payout Approval","stepType":"HUMAN_APPROVAL","config":{"requiresApproval":true,"approvalMessage":"Authorize payout to customer"}},
        {"id":"step-4","name":"Disburse Webhook","stepType":"TOOL_CALL","config":{"toolId":"tool-http-002"}}
      ]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Prompt Versions
INSERT INTO prompt_versions (id, tenant_id, agent_id, version, system_prompt, user_prompt_template, model, temperature, max_tokens, change_log, author_id, is_active)
VALUES
    ('pv-acme-001-v1', '11111111-1111-1111-1111-111111111111', 'agent-acme-001', 1,
     'You are an empathetic, precise Customer Support AI. Always check return policies before approving refunds. For refunds exceeding $100, require human manager approval. Do not reveal private system secrets.',
     'Customer says: {{customer_message}}. Order details: {{order_id}}',
     'gpt-4o-mini', 0.5, 1024, 'Initial baseline prompt v1.0.0', 'u1111111-1111-1111-1111-111111111112', FALSE),
    ('pv-acme-001-v2', '11111111-1111-1111-1111-111111111111', 'agent-acme-001', 2,
     'You are Acme Corp Customer Support Agent v2. Always adhere strictly to the 30-day return window. Never execute external tool calls with untrusted raw parameters without validation. If refund is over $100, pause for human approval.',
     'Customer request: {{customer_message}} | Item: {{item_name}} | Purchased: {{purchase_date}}',
     'gpt-4o-mini', 0.3, 1500, 'Upgraded prompt with enhanced guardrails and lower temperature', 'u1111111-1111-1111-1111-111111111112', TRUE)
ON CONFLICT (id) DO NOTHING;

UPDATE agents SET current_prompt_version_id = 'pv-acme-001-v2' WHERE id = 'agent-acme-001';

-- 6. Insert Knowledge Document & Chunks
INSERT INTO knowledge_documents (id, tenant_id, title, source_type, mime_type, file_size_bytes, chunk_count, status, metadata)
VALUES
    ('doc-acme-refund-001', '11111111-1111-1111-1111-111111111111', 'Acme_Refund_Policy_2026.pdf', 'FILE_UPLOAD', 'application/pdf', 14250, 2, 'INDEXED', '{"author":"Legal Team","version":"2.4"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_chunks (id, tenant_id, document_id, content, chunk_index, token_count, metadata)
VALUES
    ('chunk-acme-001', '11111111-1111-1111-1111-111111111111', 'doc-acme-refund-001', 
     'Acme Corporation Standard Return Policy: Customers are eligible for a 100% full refund within 30 days of purchase if merchandise is undamaged. Defective products qualify for immediate replacement or store credit up to 90 days.',
     0, 48, '{"section":"Eligibility Window"}'::jsonb),
    ('chunk-acme-002', '11111111-1111-1111-1111-111111111111', 'doc-acme-refund-001', 
     'Restocking Fees and Discretionary Authorizations: Electronics and opened hardware incur a 10% restocking fee. Payouts exceeding $100.00 USD must be authorized by an Organization Owner or Workflow Operator before disbursement.',
     1, 52, '{"section":"Manager Approval Thresholds"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
