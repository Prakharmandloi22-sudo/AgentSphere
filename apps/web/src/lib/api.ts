import { ApiResponse, Tenant, User, Agent, PromptVersion, ToolDefinition, KnowledgeDocument, ExecutionTrace, HumanApprovalRequest, UsageMetric, AuditLog } from '@agentsphere/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiClient {
  private static token: string = '';
  private static tenantId: string = '11111111-1111-1111-1111-111111111111';

  public static setAuth(token: string, tenantId: string) {
    this.token = token;
    this.tenantId = tenantId;
  }

  public static getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': this.tenantId
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // Auth
  public static async login(email: string, password: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (json.success) {
      this.setAuth(json.data.token, json.data.tenant.id);
    }
    return json;
  }

  // Tenants
  public static async getTenants(): Promise<Tenant[]> {
    const res = await fetch(`${API_BASE}/tenants`, { headers: this.getHeaders() });
    const json = await res.json();
    return json.success ? json.data : [];
  }

  public static async updateBudget(tenantId: string, monthlyBudgetUsd: number): Promise<Tenant> {
    const res = await fetch(`${API_BASE}/tenants/${tenantId}/budget`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ monthlyBudgetUsd })
    });
    const json = await res.json();
    return json.data;
  }

  // Agents
  public static async getAgents(): Promise<Agent[]> {
    const res = await fetch(`${API_BASE}/agents`, { headers: this.getHeaders() });
    const json = await res.json();
    return json.success ? json.data : [];
  }

  public static async createAgent(agentData: Partial<Agent>): Promise<Agent> {
    const res = await fetch(`${API_BASE}/agents`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(agentData)
    });
    const json = await res.json();
    return json.data;
  }

  // Prompts & Governance
  public static async getPromptVersions(agentId: string): Promise<PromptVersion[]> {
    const res = await fetch(`${API_BASE}/agents/${agentId}/prompts`, { headers: this.getHeaders() });
    const json = await res.json();
    return json.success ? json.data : [];
  }

  public static async createPromptVersion(agentId: string, versionData: Partial<PromptVersion>): Promise<PromptVersion> {
    const res = await fetch(`${API_BASE}/agents/${agentId}/prompts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(versionData)
    });
    const json = await res.json();
    return json.data;
  }

  public static async activatePromptVersion(agentId: string, versionId: string): Promise<PromptVersion> {
    const res = await fetch(`${API_BASE}/agents/${agentId}/prompts/${versionId}/activate`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    const json = await res.json();
    return json.data;
  }

  // Tools
  public static async getTools(): Promise<ToolDefinition[]> {
    const res = await fetch(`${API_BASE}/tools`, { headers: this.getHeaders() });
    const json = await res.json();
    return json.success ? json.data : [];
  }

  public static async testTool(toolId: string, parameters: any): Promise<any> {
    const res = await fetch(`${API_BASE}/tools/${toolId}/test`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ parameters })
    });
    return res.json();
  }

  // Knowledge
  public static async getDocuments(): Promise<KnowledgeDocument[]> {
    const res = await fetch(`${API_BASE}/knowledge`, { headers: this.getHeaders() });
    const json = await res.json();
    return json.success ? json.data : [];
  }

  public static async ingestDocument(doc: { title: string; content: string }): Promise<KnowledgeDocument> {
    const res = await fetch(`${API_BASE}/knowledge`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(doc)
    });
    const json = await res.json();
    return json.data;
  }

  public static async searchKnowledge(query: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/knowledge/search`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    return json.success ? json.data : [];
  }

  // Executions & Traces
  public static async runAgent(agentId: string, inputQuery: string): Promise<ExecutionTrace> {
    const res = await fetch(`${API_BASE}/executions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ agentId, inputQuery })
    });
    const json = await res.json();
    return json.data;
  }

  public static async getExecutions(agentId?: string): Promise<ExecutionTrace[]> {
    const url = agentId ? `${API_BASE}/executions?agentId=${agentId}` : `${API_BASE}/executions`;
    const res = await fetch(url, { headers: this.getHeaders() });
    const json = await res.json();
    return json.success ? json.data : [];
  }

  // Approvals
  public static async getApprovals(): Promise<HumanApprovalRequest[]> {
    const res = await fetch(`${API_BASE}/approvals`, { headers: this.getHeaders() });
    const json = await res.json();
    return json.success ? json.data : [];
  }

  public static async resolveApproval(approvalId: string, approved: boolean, comment?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/approvals/${approvalId}/resolve`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ approved, comment })
    });
    return res.json();
  }

  // Usage & Billing
  public static async getUsage(): Promise<any> {
    const res = await fetch(`${API_BASE}/usage`, { headers: this.getHeaders() });
    return res.json();
  }

  // Audit
  public static async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/audit`, { headers: this.getHeaders() });
    const json = await res.json();
    return json.success ? json.data : [];
  }
}
