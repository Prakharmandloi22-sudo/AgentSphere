/**
 * AgentSphere Shared Types & Contracts
 * Multi-Tenant AI Agent, Knowledge & Workflow Automation Platform
 */

// User & Tenant Enums
export enum UserRole {
  OWNER = 'OWNER',
  AI_BUILDER = 'AI_BUILDER',
  WORKFLOW_OPERATOR = 'WORKFLOW_OPERATOR',
  AUDITOR = 'AUDITOR',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN'
}

export enum SubscriptionTier {
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE'
}

export enum ExecutionStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum StepType {
  LLM_PROMPT = 'LLM_PROMPT',
  TOOL_CALL = 'TOOL_CALL',
  KNOWLEDGE_RETRIEVAL = 'KNOWLEDGE_RETRIEVAL',
  HUMAN_APPROVAL = 'HUMAN_APPROVAL',
  TRANSFORM = 'TRANSFORM'
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum ToolType {
  REST_API = 'REST_API',
  DATABASE_QUERY = 'DATABASE_QUERY',
  CUSTOM_CODE = 'CUSTOM_CODE',
  WEB_SCRAPER = 'WEB_SCRAPER'
}

// Domain Interfaces
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  tier: SubscriptionTier;
  monthlyBudgetUsd: number;
  currentSpendUsd: number;
  maxAgents: number;
  maxConcurrentExecutions: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  tenant: Tenant;
  token: string;
  refreshToken: string;
}

export interface PromptVersion {
  id: string;
  agentId: string;
  version: number;
  systemPrompt: string;
  userPromptTemplate?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  changeLog?: string;
  authorId: string;
  isActive: boolean;
  createdAt: string;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  defaultValue?: any;
}

export interface ToolDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  type: ToolType;
  endpointUrl?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  parameters: ToolParameter[];
  requiresApproval: boolean;
  timeoutMs: number;
  maxRetries: number;
  isSandboxed: boolean;
  createdAt: string;
}

export interface KnowledgeDocument {
  id: string;
  tenantId: string;
  title: string;
  sourceType: 'FILE_UPLOAD' | 'URL' | 'API' | 'MANUAL';
  mimeType: string;
  fileSizeBytes: number;
  chunkCount: number;
  status: 'PROCESSING' | 'INDEXED' | 'FAILED';
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  tenantId: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  stepType: StepType;
  config: {
    promptTemplate?: string;
    toolId?: string;
    model?: string;
    requiresApproval?: boolean;
    approvalMessage?: string;
    retrievalQuery?: string;
    maxTokens?: number;
    timeoutSeconds?: number;
  };
}

export interface Agent {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  currentPromptVersionId?: string;
  allowedToolIds: string[];
  knowledgeDocumentIds: string[];
  workflowSteps: WorkflowStep[];
  maxExecutionSteps: number;
  timeoutSeconds: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionStepTrace {
  id: string;
  executionId: string;
  stepNumber: number;
  stepName: string;
  stepType: StepType;
  input: any;
  output: any;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED' | 'WAITING_APPROVAL' | 'SKIPPED';
  errorMessage?: string;
  timestamp: string;
}

export interface HumanApprovalRequest {
  id: string;
  executionId: string;
  tenantId: string;
  stepNumber: number;
  stepName: string;
  actionDetails: string;
  sensitivePayload: any;
  status: ApprovalStatus;
  requestedAt: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  resolutionComment?: string;
}

export interface ExecutionTrace {
  id: string;
  tenantId: string;
  agentId: string;
  initiatedByUserId: string;
  inputQuery: string;
  finalOutput?: string;
  status: ExecutionStatus;
  totalTokensUsed: number;
  totalCostUsd: number;
  durationMs: number;
  steps: ExecutionStepTrace[];
  approvalRequest?: HumanApprovalRequest;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export interface UsageMetric {
  tenantId: string;
  monthYear: string; // e.g. "2026-11"
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalExecutions: number;
  budgetLimitUsd: number;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload: any;
  ipAddress?: string;
  timestamp: string;
}

// API Response standard format
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    requestId?: string;
    page?: number;
    limit?: number;
    total?: number;
  };
}
