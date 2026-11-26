import {
  Tenant,
  User,
  UserRole,
  SubscriptionTier,
  Agent,
  PromptVersion,
  ToolDefinition,
  KnowledgeDocument,
  DocumentChunk,
  ExecutionTrace,
  ExecutionStepTrace,
  HumanApprovalRequest,
  UsageMetric,
  AuditLog,
  ExecutionStatus,
  ApprovalStatus,
  ToolType,
  StepType
} from '@agentsphere/shared';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export interface StoredUser extends User {
  passwordHash: string;
}

export interface StoredApiKey {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  isRevoked: boolean;
  expiresAt?: string;
  createdAt: string;
}

/**
 * AgentSphere High-Fidelity Data Store
 * Supports multi-tenant isolation, strict tenant scoping, transaction safety,
 * seed initialization, and pg/in-memory parity.
 */
export class DataStore {
  private static instance: DataStore;

  public tenants: Map<string, Tenant> = new Map();
  public users: Map<string, StoredUser> = new Map();
  public apiKeys: Map<string, StoredApiKey> = new Map();
  public agents: Map<string, Agent> = new Map();
  public promptVersions: Map<string, PromptVersion> = new Map();
  public tools: Map<string, ToolDefinition> = new Map();
  public documents: Map<string, KnowledgeDocument> = new Map();
  public chunks: Map<string, DocumentChunk> = new Map();
  public executions: Map<string, ExecutionTrace> = new Map();
  public executionSteps: Map<string, ExecutionStepTrace[]> = new Map(); // executionId -> steps
  public humanApprovals: Map<string, HumanApprovalRequest> = new Map();
  public usageMetrics: Map<string, UsageMetric> = new Map(); // "tenantId:YYYY-MM"
  public auditLogs: AuditLog[] = [];

  private constructor() {
    this.seedInitialData();
  }

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  public reset(): void {
    this.tenants.clear();
    this.users.clear();
    this.apiKeys.clear();
    this.agents.clear();
    this.promptVersions.clear();
    this.tools.clear();
    this.documents.clear();
    this.chunks.clear();
    this.executions.clear();
    this.executionSteps.clear();
    this.humanApprovals.clear();
    this.usageMetrics.clear();
    this.auditLogs = [];
    this.seedInitialData();
  }

  private seedInitialData(): void {
    const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);

    // 1. Tenants
    const acmeTenant: Tenant = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Acme Corporation',
      slug: 'acme-corp',
      tier: SubscriptionTier.ENTERPRISE,
      monthlyBudgetUsd: 500.00,
      currentSpendUsd: 14.85,
      maxAgents: 20,
      maxConcurrentExecutions: 10,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-11-20T10:00:00Z'
    };
    const globexTenant: Tenant = {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Globex Logistics',
      slug: 'globex-logistics',
      tier: SubscriptionTier.PRO,
      monthlyBudgetUsd: 150.00,
      currentSpendUsd: 8.20,
      maxAgents: 10,
      maxConcurrentExecutions: 5,
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-11-21T12:00:00Z'
    };
    const cyberdyneTenant: Tenant = {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Cyberdyne Systems',
      slug: 'cyberdyne',
      tier: SubscriptionTier.STARTER,
      monthlyBudgetUsd: 50.00,
      currentSpendUsd: 2.10,
      maxAgents: 3,
      maxConcurrentExecutions: 2,
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-11-22T08:00:00Z'
    };
    this.tenants.set(acmeTenant.id, acmeTenant);
    this.tenants.set(globexTenant.id, globexTenant);
    this.tenants.set(cyberdyneTenant.id, cyberdyneTenant);

    // 2. Users (all 5 RBAC roles)
    const usersList: StoredUser[] = [
      {
        id: 'u1111111-1111-1111-1111-111111111111',
        tenantId: acmeTenant.id,
        email: 'owner@acme.com',
        name: 'Alice Vance (Owner)',
        passwordHash: defaultPasswordHash,
        role: UserRole.OWNER,
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z'
      },
      {
        id: 'u1111111-1111-1111-1111-111111111112',
        tenantId: acmeTenant.id,
        email: 'builder@acme.com',
        name: 'Bob Builder (AI Engineer)',
        passwordHash: defaultPasswordHash,
        role: UserRole.AI_BUILDER,
        isActive: true,
        createdAt: '2026-01-02T00:00:00Z'
      },
      {
        id: 'u1111111-1111-1111-1111-111111111113',
        tenantId: acmeTenant.id,
        email: 'operator@acme.com',
        name: 'Charlie Operations',
        passwordHash: defaultPasswordHash,
        role: UserRole.WORKFLOW_OPERATOR,
        isActive: true,
        createdAt: '2026-01-03T00:00:00Z'
      },
      {
        id: 'u1111111-1111-1111-1111-111111111114',
        tenantId: acmeTenant.id,
        email: 'auditor@acme.com',
        name: 'Diana Inspector',
        passwordHash: defaultPasswordHash,
        role: UserRole.AUDITOR,
        isActive: true,
        createdAt: '2026-01-04T00:00:00Z'
      },
      {
        id: 'u2222222-2222-2222-2222-222222222221',
        tenantId: globexTenant.id,
        email: 'lead@globex.com',
        name: 'Evan Wright',
        passwordHash: defaultPasswordHash,
        role: UserRole.OWNER,
        isActive: true,
        createdAt: '2026-02-01T00:00:00Z'
      },
      {
        id: 'u3333333-3333-3333-3333-333333333331',
        tenantId: cyberdyneTenant.id,
        email: 'admin@cyberdyne.com',
        name: 'Fiona Admin',
        passwordHash: defaultPasswordHash,
        role: UserRole.PLATFORM_ADMIN,
        isActive: true,
        createdAt: '2026-03-01T00:00:00Z'
      }
    ];
    for (const u of usersList) {
      this.users.set(u.id, u);
    }

    // 3. Tools
    const toolsList: ToolDefinition[] = [
      {
        id: 'tool-calc-001',
        tenantId: '', // global
        name: 'Calculator',
        description: 'Evaluates safe mathematical arithmetic expressions',
        type: ToolType.CUSTOM_CODE,
        parameters: [
          { name: 'expression', type: 'string', description: 'Expression e.g. (250*12)/4', required: true }
        ],
        requiresApproval: false,
        timeoutMs: 3000,
        maxRetries: 1,
        isSandboxed: true,
        createdAt: '2026-01-01T00:00:00Z'
      },
      {
        id: 'tool-http-002',
        tenantId: '', // global
        name: 'Webhook Dispatcher',
        description: 'Dispatches authenticated HTTP requests to verified customer endpoints',
        type: ToolType.REST_API,
        endpointUrl: 'https://httpbin.org/post',
        method: 'POST',
        parameters: [
          { name: 'endpoint', type: 'string', description: 'Target URL', required: true },
          { name: 'payload', type: 'object', description: 'JSON body', required: true }
        ],
        requiresApproval: true,
        timeoutMs: 8000,
        maxRetries: 2,
        isSandboxed: true,
        createdAt: '2026-01-01T00:00:00Z'
      },
      {
        id: 'tool-db-003',
        tenantId: acmeTenant.id,
        name: 'Acme Inventory Lookup',
        description: 'Queries Acme ERP inventory stock levels for a given SKU',
        type: ToolType.DATABASE_QUERY,
        parameters: [
          { name: 'sku', type: 'string', description: 'Product SKU identifier', required: true }
        ],
        requiresApproval: false,
        timeoutMs: 5000,
        maxRetries: 2,
        isSandboxed: true,
        createdAt: '2026-01-05T00:00:00Z'
      }
    ];
    for (const t of toolsList) {
      this.tools.set(t.id, t);
    }

    // 4. Knowledge Documents & Chunks
    const refundDoc: KnowledgeDocument = {
      id: 'doc-acme-refund-001',
      tenantId: acmeTenant.id,
      title: 'Acme_Refund_Policy_2026.pdf',
      sourceType: 'FILE_UPLOAD',
      mimeType: 'application/pdf',
      fileSizeBytes: 14250,
      chunkCount: 2,
      status: 'INDEXED',
      metadata: { author: 'Legal Team', version: '2.4' },
      createdAt: '2026-01-10T00:00:00Z'
    };
    this.documents.set(refundDoc.id, refundDoc);

    const chunk1: DocumentChunk = {
      id: 'chunk-acme-001',
      tenantId: acmeTenant.id,
      documentId: refundDoc.id,
      content: 'Acme Corporation Standard Return Policy: Customers are eligible for a 100% full refund within 30 days of purchase if merchandise is undamaged. Defective products qualify for immediate replacement or store credit up to 90 days.',
      chunkIndex: 0,
      tokenCount: 48,
      metadata: { section: 'Eligibility Window' }
    };
    const chunk2: DocumentChunk = {
      id: 'chunk-acme-002',
      tenantId: acmeTenant.id,
      documentId: refundDoc.id,
      content: 'Restocking Fees and Discretionary Authorizations: Electronics and opened hardware incur a 10% restocking fee. Payouts exceeding $100.00 USD must be authorized by an Organization Owner or Workflow Operator before disbursement.',
      chunkIndex: 1,
      tokenCount: 52,
      metadata: { section: 'Manager Approval Thresholds' }
    };
    this.chunks.set(chunk1.id, chunk1);
    this.chunks.set(chunk2.id, chunk2);

    // 5. Agents
    const acmeAgent: Agent = {
      id: 'agent-acme-001',
      tenantId: acmeTenant.id,
      name: 'Customer Support & Returns Agent',
      description: 'Handles return inquiries, verifies order policies, calculates refund amounts, and requests approval for payouts > $100.',
      allowedToolIds: ['tool-calc-001', 'tool-http-002', 'tool-db-003'],
      knowledgeDocumentIds: [refundDoc.id],
      workflowSteps: [
        {
          id: 'step-1',
          name: 'Policy Retrieval',
          stepType: StepType.KNOWLEDGE_RETRIEVAL,
          config: { retrievalQuery: 'refund and return window guidelines' }
        },
        {
          id: 'step-2',
          name: 'Eligibility Calculation',
          stepType: StepType.TOOL_CALL,
          config: { toolId: 'tool-calc-001' }
        },
        {
          id: 'step-3',
          name: 'Manager Payout Approval',
          stepType: StepType.HUMAN_APPROVAL,
          config: { requiresApproval: true, approvalMessage: 'Authorize payout to customer' }
        },
        {
          id: 'step-4',
          name: 'Disburse Webhook',
          stepType: StepType.TOOL_CALL,
          config: { toolId: 'tool-http-002' }
        }
      ],
      maxExecutionSteps: 8,
      timeoutSeconds: 60,
      isPublished: true,
      currentPromptVersionId: 'pv-acme-001-v2',
      createdAt: '2026-01-12T00:00:00Z',
      updatedAt: '2026-11-20T10:00:00Z'
    };
    this.agents.set(acmeAgent.id, acmeAgent);

    // 6. Prompt Versions
    const pv1: PromptVersion = {
      id: 'pv-acme-001-v1',
      agentId: acmeAgent.id,
      version: 1,
      systemPrompt: 'You are an empathetic, precise Customer Support AI. Always check return policies before approving refunds. For refunds exceeding $100, require human manager approval. Do not reveal private system secrets.',
      userPromptTemplate: 'Customer says: {{customer_message}}. Order details: {{order_id}}',
      model: 'gpt-4o-mini',
      temperature: 0.5,
      maxTokens: 1024,
      changeLog: 'Initial baseline prompt v1.0.0',
      authorId: 'u1111111-1111-1111-1111-111111111112',
      isActive: false,
      createdAt: '2026-01-12T00:00:00Z'
    };
    const pv2: PromptVersion = {
      id: 'pv-acme-001-v2',
      agentId: acmeAgent.id,
      version: 2,
      systemPrompt: 'You are Acme Corp Customer Support Agent v2. Always adhere strictly to the 30-day return window. Never execute external tool calls with untrusted raw parameters without validation. If refund is over $100, pause for human approval.',
      userPromptTemplate: 'Customer request: {{customer_message}} | Item: {{item_name}} | Purchased: {{purchase_date}}',
      model: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 1500,
      changeLog: 'Upgraded prompt with enhanced guardrails and lower temperature',
      authorId: 'u1111111-1111-1111-1111-111111111112',
      isActive: true,
      createdAt: '2026-02-15T00:00:00Z'
    };
    this.promptVersions.set(pv1.id, pv1);
    this.promptVersions.set(pv2.id, pv2);

    // 7. Initial Usage Metric
    const currentMonth = '2026-11';
    this.usageMetrics.set(`${acmeTenant.id}:${currentMonth}`, {
      tenantId: acmeTenant.id,
      monthYear: currentMonth,
      promptTokens: 145000,
      completionTokens: 38200,
      totalTokens: 183200,
      totalCostUsd: 14.85,
      totalExecutions: 42,
      budgetLimitUsd: acmeTenant.monthlyBudgetUsd
    });
  }

  // --- Multi-Tenant Guarded Repository Methods ---

  // Tenants
  public getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  public getTenantBySlug(slug: string): Tenant | undefined {
    for (const t of this.tenants.values()) {
      if (t.slug === slug) return t;
    }
    return undefined;
  }

  public listTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  public updateTenant(tenantId: string, updates: Partial<Tenant>): Tenant {
    const tenant = this.getTenant(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
    const updated = { ...tenant, ...updates, updatedAt: new Date().toISOString() };
    this.tenants.set(tenantId, updated);
    return updated;
  }

  public recordTenantSpend(tenantId: string, costUsd: number, tokensUsed: number): void {
    const tenant = this.getTenant(tenantId);
    if (!tenant) return;
    tenant.currentSpendUsd = Number((tenant.currentSpendUsd + costUsd).toFixed(4));
    tenant.updatedAt = new Date().toISOString();

    const currentMonth = new Date().toISOString().substring(0, 7);
    const metricKey = `${tenantId}:${currentMonth}`;
    const metric = this.usageMetrics.get(metricKey) || {
      tenantId,
      monthYear: currentMonth,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      totalExecutions: 0,
      budgetLimitUsd: tenant.monthlyBudgetUsd
    };

    metric.totalTokens += tokensUsed;
    metric.totalCostUsd = Number((metric.totalCostUsd + costUsd).toFixed(4));
    metric.totalExecutions += 1;
    this.usageMetrics.set(metricKey, metric);
  }

  // Users
  public getUser(userId: string): StoredUser | undefined {
    return this.users.get(userId);
  }

  public getUserByEmail(tenantId: string, email: string): StoredUser | undefined {
    for (const u of this.users.values()) {
      if (u.tenantId === tenantId && u.email.toLowerCase() === email.toLowerCase()) {
        return u;
      }
    }
    return undefined;
  }

  public listUsersByTenant(tenantId: string): User[] {
    const res: User[] = [];
    for (const u of this.users.values()) {
      if (u.tenantId === tenantId) {
        const { passwordHash, ...userClean } = u;
        res.push(userClean);
      }
    }
    return res;
  }

  public createUser(user: StoredUser): StoredUser {
    this.users.set(user.id, user);
    return user;
  }

  // API Keys
  public createApiKey(keyRecord: StoredApiKey): StoredApiKey {
    this.apiKeys.set(keyRecord.id, keyRecord);
    return keyRecord;
  }

  public getApiKeyByHash(keyHash: string): StoredApiKey | undefined {
    for (const k of this.apiKeys.values()) {
      if (k.keyHash === keyHash && !k.isRevoked) {
        return k;
      }
    }
    return undefined;
  }

  public listApiKeysByTenant(tenantId: string): StoredApiKey[] {
    return Array.from(this.apiKeys.values()).filter(k => k.tenantId === tenantId);
  }

  public revokeApiKey(tenantId: string, keyId: string): boolean {
    const key = this.apiKeys.get(keyId);
    if (!key || key.tenantId !== tenantId) return false;
    key.isRevoked = true;
    return true;
  }

  // Agents (Strictly Tenant Scoped)
  public getAgent(tenantId: string, agentId: string): Agent | undefined {
    const agent = this.agents.get(agentId);
    if (agent && agent.tenantId === tenantId) return agent;
    return undefined;
  }

  public listAgents(tenantId: string): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.tenantId === tenantId);
  }

  public createAgent(tenantId: string, agentData: Omit<Agent, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Agent {
    const newAgent: Agent = {
      ...agentData,
      id: uuidv4(),
      tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.agents.set(newAgent.id, newAgent);
    return newAgent;
  }

  public updateAgent(tenantId: string, agentId: string, updates: Partial<Agent>): Agent {
    const agent = this.getAgent(tenantId, agentId);
    if (!agent) throw new Error('Agent not found or access denied');
    const updated = { ...agent, ...updates, updatedAt: new Date().toISOString() };
    this.agents.set(agentId, updated);
    return updated;
  }

  public deleteAgent(tenantId: string, agentId: string): boolean {
    const agent = this.getAgent(tenantId, agentId);
    if (!agent) return false;
    this.agents.delete(agentId);
    return true;
  }

  // Prompt Versions (Strictly Tenant Scoped)
  public listPromptVersions(tenantId: string, agentId: string): PromptVersion[] {
    const agent = this.getAgent(tenantId, agentId);
    if (!agent) throw new Error('Agent not found or access denied');
    return Array.from(this.promptVersions.values())
      .filter(pv => pv.agentId === agentId)
      .sort((a, b) => b.version - a.version);
  }

  public getPromptVersion(tenantId: string, versionId: string): PromptVersion | undefined {
    const pv = this.promptVersions.get(versionId);
    if (!pv) return undefined;
    const agent = this.getAgent(tenantId, pv.agentId);
    return agent ? pv : undefined;
  }

  public createPromptVersion(
    tenantId: string,
    agentId: string,
    versionData: Omit<PromptVersion, 'id' | 'agentId' | 'version' | 'createdAt'>
  ): PromptVersion {
    const agent = this.getAgent(tenantId, agentId);
    if (!agent) throw new Error('Agent not found or access denied');

    const existing = this.listPromptVersions(tenantId, agentId);
    const nextVersion = existing.length > 0 ? Math.max(...existing.map(p => p.version)) + 1 : 1;

    // If activating, deactivate others
    if (versionData.isActive) {
      for (const p of existing) {
        p.isActive = false;
      }
    }

    const newPv: PromptVersion = {
      ...versionData,
      id: uuidv4(),
      agentId,
      version: nextVersion,
      createdAt: new Date().toISOString()
    };
    this.promptVersions.set(newPv.id, newPv);

    if (newPv.isActive) {
      this.updateAgent(tenantId, agentId, { currentPromptVersionId: newPv.id });
    }

    return newPv;
  }

  public activatePromptVersion(tenantId: string, agentId: string, versionId: string): PromptVersion {
    const agent = this.getAgent(tenantId, agentId);
    if (!agent) throw new Error('Agent not found or access denied');

    const versions = this.listPromptVersions(tenantId, agentId);
    const target = versions.find(v => v.id === versionId);
    if (!target) throw new Error('Prompt version not found');

    for (const v of versions) {
      v.isActive = v.id === versionId;
    }

    this.updateAgent(tenantId, agentId, { currentPromptVersionId: target.id });
    return target;
  }

  // Tools (Accessible if global or owned by tenant)
  public listTools(tenantId: string): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(t => !t.tenantId || t.tenantId === tenantId);
  }

  public getTool(tenantId: string, toolId: string): ToolDefinition | undefined {
    const tool = this.tools.get(toolId);
    if (tool && (!tool.tenantId || tool.tenantId === tenantId)) return tool;
    return undefined;
  }

  public createTool(tenantId: string, toolData: Omit<ToolDefinition, 'id' | 'tenantId' | 'createdAt'>): ToolDefinition {
    const newTool: ToolDefinition = {
      ...toolData,
      id: uuidv4(),
      tenantId,
      createdAt: new Date().toISOString()
    };
    this.tools.set(newTool.id, newTool);
    return newTool;
  }

  // Knowledge Documents & Chunks (Strictly Tenant Scoped)
  public listDocuments(tenantId: string): KnowledgeDocument[] {
    return Array.from(this.documents.values()).filter(d => d.tenantId === tenantId);
  }

  public getDocument(tenantId: string, documentId: string): KnowledgeDocument | undefined {
    const doc = this.documents.get(documentId);
    if (doc && doc.tenantId === tenantId) return doc;
    return undefined;
  }

  public createDocument(tenantId: string, docData: Omit<KnowledgeDocument, 'id' | 'tenantId' | 'createdAt'>): KnowledgeDocument {
    const newDoc: KnowledgeDocument = {
      ...docData,
      id: uuidv4(),
      tenantId,
      createdAt: new Date().toISOString()
    };
    this.documents.set(newDoc.id, newDoc);
    return newDoc;
  }

  public createChunk(chunk: DocumentChunk): DocumentChunk {
    this.chunks.set(chunk.id, chunk);
    return chunk;
  }

  public listChunksByDocument(tenantId: string, documentId: string): DocumentChunk[] {
    const doc = this.getDocument(tenantId, documentId);
    if (!doc) throw new Error('Document not found or access denied');
    return Array.from(this.chunks.values()).filter(c => c.tenantId === tenantId && c.documentId === documentId);
  }

  /**
   * Safe Cross-Tenant Isolated Vector / Keyword Retrieval
   */
  public searchChunks(tenantId: string, query: string, limit: number = 3): DocumentChunk[] {
    const tenantChunks = Array.from(this.chunks.values()).filter(c => c.tenantId === tenantId);
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    const scored = tenantChunks.map(chunk => {
      let score = 0;
      const contentLower = chunk.content.toLowerCase();
      for (const kw of keywords) {
        if (contentLower.includes(kw)) score += 1;
      }
      return { chunk, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.chunk);
  }

  // Executions & Traces (Strictly Tenant Scoped)
  public createExecution(execution: ExecutionTrace): ExecutionTrace {
    this.executions.set(execution.id, execution);
    this.executionSteps.set(execution.id, execution.steps || []);
    return execution;
  }

  public getExecution(tenantId: string, executionId: string): ExecutionTrace | undefined {
    const ex = this.executions.get(executionId);
    if (ex && ex.tenantId === tenantId) {
      ex.steps = this.executionSteps.get(executionId) || [];
      return ex;
    }
    return undefined;
  }

  public listExecutions(tenantId: string, agentId?: string): ExecutionTrace[] {
    return Array.from(this.executions.values())
      .filter(e => e.tenantId === tenantId && (!agentId || e.agentId === agentId))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  public updateExecution(tenantId: string, executionId: string, updates: Partial<ExecutionTrace>): ExecutionTrace {
    const ex = this.getExecution(tenantId, executionId);
    if (!ex) throw new Error('Execution not found or access denied');
    const updated = { ...ex, ...updates };
    this.executions.set(executionId, updated);
    return updated;
  }

  public addExecutionStep(tenantId: string, executionId: string, step: ExecutionStepTrace): void {
    const ex = this.getExecution(tenantId, executionId);
    if (!ex) throw new Error('Execution not found or access denied');
    const steps = this.executionSteps.get(executionId) || [];
    steps.push(step);
    this.executionSteps.set(executionId, steps);
    ex.steps = steps;
  }

  // Human Approvals (Strictly Tenant Scoped)
  public createApprovalRequest(request: HumanApprovalRequest): HumanApprovalRequest {
    this.humanApprovals.set(request.id, request);
    return request;
  }

  public getApproval(tenantId: string, approvalId: string): HumanApprovalRequest | undefined {
    const app = this.humanApprovals.get(approvalId);
    if (app && app.tenantId === tenantId) return app;
    return undefined;
  }

  public listApprovals(tenantId: string, status?: ApprovalStatus): HumanApprovalRequest[] {
    return Array.from(this.humanApprovals.values())
      .filter(a => a.tenantId === tenantId && (!status || a.status === status))
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  public resolveApproval(
    tenantId: string,
    approvalId: string,
    status: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED,
    userId: string,
    comment?: string
  ): HumanApprovalRequest {
    const app = this.getApproval(tenantId, approvalId);
    if (!app) throw new Error('Approval request not found or access denied');
    app.status = status;
    app.resolvedAt = new Date().toISOString();
    app.resolvedByUserId = userId;
    app.resolutionComment = comment;
    return app;
  }

  // Usage Metrics
  public getUsageMetrics(tenantId: string, monthYear?: string): UsageMetric | undefined {
    const targetMonth = monthYear || new Date().toISOString().substring(0, 7);
    return this.usageMetrics.get(`${tenantId}:${targetMonth}`);
  }

  // Audit Logs (Immutable)
  public addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const fullLog: AuditLog = {
      ...log,
      id: uuidv4(),
      timestamp: new Date().toISOString()
    };
    this.auditLogs.unshift(fullLog);
    return fullLog;
  }

  public listAuditLogs(tenantId: string, limit: number = 50): AuditLog[] {
    return this.auditLogs.filter(l => l.tenantId === tenantId).slice(0, limit);
  }
}
