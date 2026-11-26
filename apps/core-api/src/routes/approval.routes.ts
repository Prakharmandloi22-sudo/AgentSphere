import { Router, Request, Response } from 'express';
import { UserRole, ApprovalStatus } from '@agentsphere/shared';
import { DataStore } from '../db';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { OrchestrationService } from '../services/orchestrator.service';

const router = Router();

// GET /api/v1/approvals (List pending/resolved approvals)
router.get('/', authenticate, (req: Request, res: Response): void => {
  const { status } = req.query;
  const store = DataStore.getInstance();
  const approvals = store.listApprovals(req.user!.tenantId, status as ApprovalStatus | undefined);
  res.json({ success: true, data: approvals });
});

// GET /api/v1/approvals/:id
router.get('/:id', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const approval = store.getApproval(req.user!.tenantId, req.params.id);
  if (!approval) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Approval request not found' } });
    return;
  }
  res.json({ success: true, data: approval });
});

// POST /api/v1/approvals/:id/resolve
router.post('/:id/resolve', authenticate, requireRole(UserRole.OWNER, UserRole.WORKFLOW_OPERATOR), async (req: Request, res: Response): Promise<void> => {
  const { approved, comment } = req.body;
  if (typeof approved !== 'boolean') {
    res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'approved (boolean) is required' } });
    return;
  }

  try {
    const updatedExecution = await OrchestrationService.resolveApprovalAndResume(
      req.user!.tenantId,
      req.params.id,
      approved,
      req.user!.id,
      comment
    );
    res.json({
      success: true,
      data: {
        approvalStatus: approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        execution: updatedExecution
      }
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'RESOLUTION_ERROR', message: err.message } });
  }
});

export default router;
