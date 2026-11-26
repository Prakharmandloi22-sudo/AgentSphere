import { Router, Request, Response } from 'express';
import { DataStore } from '../db';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// GET /api/v1/usage (Current monthly metrics and spend summary)
router.get('/', authenticate, (req: Request, res: Response): void => {
  const { month } = req.query;
  const store = DataStore.getInstance();
  const tenant = store.getTenant(req.user!.tenantId);
  const metric = store.getUsageMetrics(req.user!.tenantId, month as string | undefined);

  res.json({
    success: true,
    data: {
      tenant: {
        id: tenant?.id,
        name: tenant?.name,
        tier: tenant?.tier,
        monthlyBudgetUsd: tenant?.monthlyBudgetUsd,
        currentSpendUsd: tenant?.currentSpendUsd,
        spendPercentage: tenant && tenant.monthlyBudgetUsd > 0
          ? Number(((tenant.currentSpendUsd / tenant.monthlyBudgetUsd) * 100).toFixed(1))
          : 0
      },
      metrics: metric || {
        tenantId: req.user!.tenantId,
        monthYear: month || new Date().toISOString().substring(0, 7),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        totalExecutions: 0,
        budgetLimitUsd: tenant?.monthlyBudgetUsd || 50.00
      }
    }
  });
});

export default router;
