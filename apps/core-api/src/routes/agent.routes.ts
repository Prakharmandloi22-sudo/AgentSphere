import { Router, Request, Response } from 'express';
import { UserRole } from '@agentsphere/shared';
import { DataStore } from '../db';
import { authenticate, requireRole, enforceTenantIsolation } from '../middleware/auth.middleware';

const router = Router();

// GET /api/v1/agents
router.get('/', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const agents = store.listAgents(req.user!.tenantId);
  res.json({ success: true, data: agents });
});

// POST /api/v1/agents
router.post('/', authenticate, requireRole(UserRole.OWNER, UserRole.AI_BUILDER), (req: Request, res: Response): void => {
  const { name, description, workflowSteps, allowedToolIds, knowledgeDocumentIds, maxExecutionSteps, timeoutSeconds } = req.body;
  if (!name) {
    res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Agent name is required' } });
    return;
  }

  const store = DataStore.getInstance();
  const tenant = store.getTenant(req.user!.tenantId);
  const currentCount = store.listAgents(req.user!.tenantId).length;

  if (tenant && currentCount >= tenant.maxAgents) {
    res.status(403).json({
      success: false,
      error: { code: 'QUOTA_EXCEEDED', message: `Tenant agent quota of ${tenant.maxAgents} reached. Upgrade plan to create more.` }
    });
    return;
  }

  const agent = store.createAgent(req.user!.tenantId, {
    name,
    description: description || '',
    workflowSteps: workflowSteps || [],
    allowedToolIds: allowedToolIds || [],
    knowledgeDocumentIds: knowledgeDocumentIds || [],
    maxExecutionSteps: maxExecutionSteps || 10,
    timeoutSeconds: timeoutSeconds || 60,
    isPublished: true
  });

  store.addAuditLog({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    action: 'AGENT_CREATED',
    resourceType: 'AGENT',
    resourceId: agent.id,
    payload: { name: agent.name }
  });

  res.status(201).json({ success: true, data: agent });
});

// GET /api/v1/agents/:id
router.get('/:id', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const agent = store.getAgent(req.user!.tenantId, req.params.id);
  if (!agent) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } });
    return;
  }
  res.json({ success: true, data: agent });
});

// PUT /api/v1/agents/:id
router.put('/:id', authenticate, requireRole(UserRole.OWNER, UserRole.AI_BUILDER), (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  try {
    const updated = store.updateAgent(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
  }
});

// DELETE /api/v1/agents/:id
router.delete('/:id', authenticate, requireRole(UserRole.OWNER), (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const deleted = store.deleteAgent(req.user!.tenantId, req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } });
    return;
  }
  res.json({ success: true, message: 'Agent deleted successfully' });
});

// --- Prompt Governance & Versioning Routes (Assessment 10) ---

// GET /api/v1/agents/:id/prompts
router.get('/:id/prompts', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  try {
    const versions = store.listPromptVersions(req.user!.tenantId, req.params.id);
    res.json({ success: true, data: versions });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
  }
});

// POST /api/v1/agents/:id/prompts
router.post('/:id/prompts', authenticate, requireRole(UserRole.OWNER, UserRole.AI_BUILDER), (req: Request, res: Response): void => {
  const { systemPrompt, userPromptTemplate, model, temperature, maxTokens, changeLog, isActive } = req.body;
  if (!systemPrompt) {
    res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'System prompt is required' } });
    return;
  }

  const store = DataStore.getInstance();
  try {
    const newVersion = store.createPromptVersion(req.user!.tenantId, req.params.id, {
      systemPrompt,
      userPromptTemplate: userPromptTemplate || '',
      model: model || 'gpt-4o-mini',
      temperature: temperature !== undefined ? temperature : 0.7,
      maxTokens: maxTokens || 2048,
      changeLog: changeLog || 'Routine update',
      authorId: req.user!.id,
      isActive: isActive !== undefined ? isActive : true
    });

    store.addAuditLog({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      action: 'PROMPT_VERSION_CREATED',
      resourceType: 'PROMPT_VERSION',
      resourceId: newVersion.id,
      payload: { agentId: req.params.id, version: newVersion.version, changeLog: newVersion.changeLog }
    });

    res.status(201).json({ success: true, data: newVersion });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// POST /api/v1/agents/:id/prompts/:versionId/activate (Rollback / Release Activation)
router.post('/:id/prompts/:versionId/activate', authenticate, requireRole(UserRole.OWNER, UserRole.AI_BUILDER), (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  try {
    const activated = store.activatePromptVersion(req.user!.tenantId, req.params.id, req.params.versionId);
    store.addAuditLog({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      action: 'PROMPT_VERSION_ACTIVATED',
      resourceType: 'PROMPT_VERSION',
      resourceId: activated.id,
      payload: { agentId: req.params.id, activeVersion: activated.version }
    });
    res.json({ success: true, data: activated });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
  }
});

export default router;
