import { Router, Request, Response } from 'express';
import { UserRole, ToolType } from '@agentsphere/shared';
import { DataStore } from '../db';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { ToolRunnerService } from '../services/toolRunner.service';

const router = Router();

// GET /api/v1/tools (Tenant-specific tools + global built-in tools)
router.get('/', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const tools = store.listTools(req.user!.tenantId);
  res.json({ success: true, data: tools });
});

// GET /api/v1/tools/:id
router.get('/:id', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const tool = store.getTool(req.user!.tenantId, req.params.id);
  if (!tool) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tool not found or unauthorized' } });
    return;
  }
  res.json({ success: true, data: tool });
});

// POST /api/v1/tools
router.post('/', authenticate, requireRole(UserRole.OWNER, UserRole.AI_BUILDER), (req: Request, res: Response): void => {
  const { name, description, type, endpointUrl, method, parameters, requiresApproval, timeoutMs, maxRetries } = req.body;
  if (!name || !description || !type) {
    res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'name, description, and type are required' } });
    return;
  }

  const store = DataStore.getInstance();
  const tool = store.createTool(req.user!.tenantId, {
    name,
    description,
    type: type as ToolType,
    endpointUrl: endpointUrl || null,
    method: method || 'POST',
    parameters: parameters || [],
    requiresApproval: requiresApproval || false,
    timeoutMs: timeoutMs || 5000,
    maxRetries: maxRetries || 2,
    isSandboxed: true
  });

  store.addAuditLog({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    action: 'TOOL_CREATED',
    resourceType: 'TOOL',
    resourceId: tool.id,
    payload: { name: tool.name, type: tool.type }
  });

  res.status(201).json({ success: true, data: tool });
});

// POST /api/v1/tools/:id/test (Sandboxed test invocation)
router.post('/:id/test', authenticate, requireRole(UserRole.OWNER, UserRole.AI_BUILDER), async (req: Request, res: Response): Promise<void> => {
  const { parameters } = req.body;
  const result = await ToolRunnerService.executeTool(req.user!.tenantId, req.params.id, parameters || {});
  res.json({ success: result.success, data: result.output, durationMs: result.durationMs, error: result.error });
});

export default router;
