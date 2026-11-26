import { Router, Request, Response } from 'express';
import { UserRole, ExecutionStatus } from '@agentsphere/shared';
import { DataStore } from '../db';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { OrchestrationService } from '../services/orchestrator.service';

const router = Router();

// GET /api/v1/executions
router.get('/', authenticate, (req: Request, res: Response): void => {
  const { agentId } = req.query;
  const store = DataStore.getInstance();
  const executions = store.listExecutions(req.user!.tenantId, agentId as string | undefined);
  res.json({ success: true, data: executions });
});

// POST /api/v1/executions (Run an agent)
router.post('/', authenticate, requireRole(UserRole.OWNER, UserRole.AI_BUILDER, UserRole.WORKFLOW_OPERATOR), async (req: Request, res: Response): Promise<void> => {
  const { agentId, inputQuery } = req.body;
  if (!agentId || !inputQuery) {
    res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'agentId and inputQuery are required' } });
    return;
  }

  try {
    const trace = await OrchestrationService.startExecution(
      req.user!.tenantId,
      agentId,
      req.user!.id,
      inputQuery
    );
    res.status(201).json({ success: true, data: trace });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'EXECUTION_FAILED', message: err.message } });
  }
});

// GET /api/v1/executions/:id (Trace details with multi-step waterfall)
router.get('/:id', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const execution = store.getExecution(req.user!.tenantId, req.params.id);
  if (!execution) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Execution trace not found' } });
    return;
  }
  res.json({ success: true, data: execution });
});

// POST /api/v1/executions/:id/cancel
router.post('/:id/cancel', authenticate, requireRole(UserRole.OWNER, UserRole.WORKFLOW_OPERATOR), (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const execution = store.getExecution(req.user!.tenantId, req.params.id);
  if (!execution) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Execution not found' } });
    return;
  }

  if (execution.status === ExecutionStatus.COMPLETED || execution.status === ExecutionStatus.FAILED) {
    res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Execution is already finished' } });
    return;
  }

  execution.status = ExecutionStatus.CANCELLED;
  execution.errorMessage = `Cancelled by user ${req.user!.email}`;
  execution.completedAt = new Date().toISOString();
  store.updateExecution(req.user!.tenantId, execution.id, execution);

  res.json({ success: true, data: execution });
});

export default router;
