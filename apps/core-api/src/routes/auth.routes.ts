import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '@agentsphere/shared';
import { DataStore } from '../db';
import { authenticate } from '../middleware/auth.middleware';
import { SecurityService } from '../services/security.service';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-minimum-32-chars-long-example';

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { tenantSlug, email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Email and password required' } });
    return;
  }

  const store = DataStore.getInstance();
  let tenant = tenantSlug ? store.getTenantBySlug(tenantSlug) : undefined;

  // Fallback to searching by email across tenants if slug omitted
  if (!tenant) {
    for (const u of store.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        tenant = store.getTenant(u.tenantId);
        break;
      }
    }
  }

  if (!tenant) {
    res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials or tenant not found' } });
    return;
  }

  const user = store.getUserByEmail(tenant.id, email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, tenantId: tenant.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  const { passwordHash, ...cleanUser } = user;

  res.json({
    success: true,
    data: {
      token,
      user: cleanUser,
      tenant
    }
  });
});

// GET /api/v1/auth/me
router.get('/me', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const user = store.getUser(req.user!.id);
  const tenant = store.getTenant(req.user!.tenantId);

  if (!user || !tenant) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User or tenant record not found' } });
    return;
  }

  const { passwordHash, ...cleanUser } = user;
  res.json({ success: true, data: { user: cleanUser, tenant } });
});

// POST /api/v1/auth/api-keys
router.post('/api-keys', authenticate, (req: Request, res: Response): void => {
  const { name, scopes } = req.body;
  const store = DataStore.getInstance();

  const { apiKey, keyPrefix, keyHash } = SecurityService.generateApiKey();

  const keyRecord = store.createApiKey({
    id: uuidv4(),
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    name: name || 'Default Integration Key',
    keyPrefix,
    keyHash,
    scopes: scopes || ['agents:read', 'executions:write'],
    isRevoked: false,
    createdAt: new Date().toISOString()
  });

  store.addAuditLog({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    action: 'API_KEY_CREATED',
    resourceType: 'API_KEY',
    resourceId: keyRecord.id,
    payload: { keyPrefix, name }
  });

  // Full API key is only returned once upon generation
  res.status(201).json({
    success: true,
    data: {
      id: keyRecord.id,
      name: keyRecord.name,
      keyPrefix: keyRecord.keyPrefix,
      apiKey, // Live token
      scopes: keyRecord.scopes,
      createdAt: keyRecord.createdAt
    }
  });
});

// GET /api/v1/auth/api-keys
router.get('/api-keys', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const keys = store.listApiKeysByTenant(req.user!.tenantId).map(k => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: k.scopes,
    isRevoked: k.isRevoked,
    createdAt: k.createdAt
  }));
  res.json({ success: true, data: keys });
});

// DELETE /api/v1/auth/api-keys/:id
router.delete('/api-keys/:id', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const revoked = store.revokeApiKey(req.user!.tenantId, req.params.id);
  if (!revoked) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'API key not found' } });
    return;
  }
  res.json({ success: true, message: 'API key revoked successfully' });
});

export default router;
