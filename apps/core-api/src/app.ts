import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

import authRoutes from './routes/auth.routes';
import tenantRoutes from './routes/tenant.routes';
import agentRoutes from './routes/agent.routes';
import toolRoutes from './routes/tool.routes';
import knowledgeRoutes from './routes/knowledge.routes';
import executionRoutes from './routes/execution.routes';
import approvalRoutes from './routes/approval.routes';
import usageRoutes from './routes/usage.routes';
import auditRoutes from './routes/audit.routes';
import healthRoutes from './routes/health.routes';

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const reqId = (req.headers['x-request-id'] as string) || uuidv4();
    req.requestId = reqId;
    res.setHeader('X-Request-ID', reqId);
    next();
  });

  // Base Health Check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'agentsphere-core-api', timestamp: new Date().toISOString() });
  });

  // Mount API v1 Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/tenants', tenantRoutes);
  app.use('/api/v1/agents', agentRoutes);
  app.use('/api/v1/tools', toolRoutes);
  app.use('/api/v1/knowledge', knowledgeRoutes);
  app.use('/api/v1/executions', executionRoutes);
  app.use('/api/v1/approvals', approvalRoutes);
  app.use('/api/v1/usage', usageRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/health', healthRoutes);

  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: 'ENDPOINT_NOT_FOUND', message: `Route ${req.method} ${req.path} does not exist` }
    });
  });

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err.status || 500;
    // Don't leak stack traces in production
    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected internal error occurred'
      },
      meta: { requestId: req.requestId }
    });
  });

  return app;
};

export const app = createApp();

