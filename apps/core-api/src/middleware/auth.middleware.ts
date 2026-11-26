import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@agentsphere/shared';
import { DataStore } from '../db';
import { SecurityService } from '../services/security.service';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenantId?: string;
      requestId?: string;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-minimum-32-chars-long-example';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const store = DataStore.getInstance();
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string;

  // 1. API Key Authentication
  if (apiKeyHeader) {
    const keyHash = SecurityService.hashApiKey(apiKeyHeader);
    const keyRecord = store.getApiKeyByHash(keyHash);
    if (!keyRecord) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_API_KEY', message: 'The provided API key is invalid or revoked' }
      });
      return;
    }

    const user = store.getUser(keyRecord.userId);
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        error: { code: 'INACTIVE_USER', message: 'User associated with API key is inactive' }
      });
      return;
    }

    req.user = {
      id: user.id,
      tenantId: keyRecord.tenantId,
      email: user.email,
      name: user.name,
      role: user.role
    };
    req.tenantId = keyRecord.tenantId;
    return next();
  }

  // 2. JWT Bearer Token Authentication
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing Bearer token or X-API-Key' }
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = store.getUser(decoded.userId);
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        error: { code: 'INACTIVE_USER', message: 'User account is inactive or not found' }
      });
      return;
    }

    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role
    };
    req.tenantId = user.tenantId;
    return next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Token is expired or invalid' }
    });
    return;
  }
};

/**
 * RBAC Role Gatekeeper
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    // PLATFORM_ADMIN has universal access
    if (req.user.role === UserRole.PLATFORM_ADMIN || allowedRoles.includes(req.user.role)) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: `Access denied. Role '${req.user.role}' lacks sufficient privileges. Required: [${allowedRoles.join(', ')}]`
      }
    });
  };
};

/**
 * Multi-Tenant Strict Isolation Guard
 * Prevents cross-tenant leaks by comparing header/request tenant with authenticated tenant.
 */
export const enforceTenantIsolation = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  const requestedTenantId = (req.headers['x-tenant-id'] as string) || req.params.tenantId || req.body?.tenantId;

  // Platform admin can switch tenant context if explicitly provided
  if (req.user.role === UserRole.PLATFORM_ADMIN && requestedTenantId) {
    req.tenantId = requestedTenantId;
    return next();
  }

  // Cross-tenant access attempt by normal tenant user
  if (requestedTenantId && requestedTenantId !== req.user.tenantId) {
    const store = DataStore.getInstance();
    store.addAuditLog({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      action: 'SECURITY_ALERT_CROSS_TENANT_ACCESS_DENIED',
      resourceType: 'TENANT',
      resourceId: requestedTenantId,
      payload: { attemptedTenantId: requestedTenantId, userTenantId: req.user.tenantId },
      ipAddress: req.ip
    });

    res.status(403).json({
      success: false,
      error: {
        code: 'CROSS_TENANT_VIOLATION',
        message: 'Security Violation: Access to resource in another tenant is strictly prohibited'
      }
    });
    return;
  }

  req.tenantId = req.user.tenantId;
  next();
};
