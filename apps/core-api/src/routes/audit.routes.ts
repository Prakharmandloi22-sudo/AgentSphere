import { Router, Request, Response } from 'express';
import { UserRole } from '@agentsphere/shared';
import { DataStore } from '../db';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// GET /api/v1/audit (Immutable audit trail query)
router.get('/', authenticate, requireRole(UserRole.OWNER, UserRole.AUDITOR), (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const logs = store.listAuditLogs(req.user!.tenantId, limit);
  res.json({ success: true, data: logs });
});

export default router;
