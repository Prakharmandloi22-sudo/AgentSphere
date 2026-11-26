import { Router, Request, Response } from 'express';
import { UserRole, SubscriptionTier } from '@agentsphere/shared';
import { DataStore } from '../db';
import { authenticate, requireRole, enforceTenantIsolation } from '../middleware/auth.middleware';

const router = Router();

// GET /api/v1/tenants (Current tenant or list if platform admin)
router.get('/', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  if (req.user!.role === UserRole.PLATFORM_ADMIN) {
    res.json({ success: true, data: store.listTenants() });
    return;
  }
  const tenant = store.getTenant(req.user!.tenantId);
  res.json({ success: true, data: tenant ? [tenant] : [] });
});

// GET /api/v1/tenants/:id
router.get('/:id', authenticate, enforceTenantIsolation, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const tenant = store.getTenant(req.params.id);
  if (!tenant) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    return;
  }
  res.json({ success: true, data: tenant });
});

// PATCH /api/v1/tenants/:id/budget
router.patch('/:id/budget', authenticate, enforceTenantIsolation, requireRole(UserRole.OWNER), (req: Request, res: Response): void => {
  const { monthlyBudgetUsd } = req.body;
  if (typeof monthlyBudgetUsd !== 'number' || monthlyBudgetUsd < 0) {
    res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'monthlyBudgetUsd must be a positive number' } });
    return;
  }

  const store = DataStore.getInstance();
  const updated = store.updateTenant(req.params.id, { monthlyBudgetUsd });

  store.addAuditLog({
    tenantId: req.params.id,
    userId: req.user!.id,
    action: 'TENANT_BUDGET_UPDATED',
    resourceType: 'TENANT',
    resourceId: req.params.id,
    payload: { oldBudget: updated.monthlyBudgetUsd, newBudget: monthlyBudgetUsd }
  });

  res.json({ success: true, data: updated });
});

// PATCH /api/v1/tenants/:id/plan (Subscription tier upgrade/downgrade simulation)
router.patch('/:id/plan', authenticate, enforceTenantIsolation, requireRole(UserRole.OWNER), (req: Request, res: Response): void => {
  const { tier } = req.body;
  if (!Object.values(SubscriptionTier).includes(tier)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid subscription tier' } });
    return;
  }

  const planLimits: Record<SubscriptionTier, { maxAgents: number; maxConcurrentExecutions: number; defaultBudget: number }> = {
    [SubscriptionTier.STARTER]: { maxAgents: 3, maxConcurrentExecutions: 2, defaultBudget: 50.00 },
    [SubscriptionTier.PRO]: { maxAgents: 10, maxConcurrentExecutions: 5, defaultBudget: 150.00 },
    [SubscriptionTier.ENTERPRISE]: { maxAgents: 50, maxConcurrentExecutions: 25, defaultBudget: 1000.00 }
  };

  const store = DataStore.getInstance();
  const limits = planLimits[tier as SubscriptionTier];
  const updated = store.updateTenant(req.params.id, {
    tier,
    maxAgents: limits.maxAgents,
    maxConcurrentExecutions: limits.maxConcurrentExecutions
  });

  store.addAuditLog({
    tenantId: req.params.id,
    userId: req.user!.id,
    action: 'SUBSCRIPTION_TIER_CHANGED',
    resourceType: 'TENANT',
    resourceId: req.params.id,
    payload: { tier, newLimits: limits }
  });

  res.json({ success: true, data: updated });
});

export default router;
