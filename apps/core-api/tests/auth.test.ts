import request from 'supertest';
import { createApp } from '../src/app';
import { DataStore } from '../src/db';
import { UserRole } from '@agentsphere/shared';

describe('Assessment 02 & 04: Authentication & Security API Tests', () => {
  const app = createApp();

  beforeEach(() => {
    DataStore.getInstance().reset();
  });

  it('should authenticate user and return JWT with tenant context', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@acme.com',
        password: 'Password123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe(UserRole.OWNER);
    expect(res.body.data.tenant.slug).toBe('acme-corp');
  });

  it('should reject invalid credentials with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@acme.com',
        password: 'WrongPassword!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should generate a secure scoped API key and allow authentication via X-API-Key', async () => {
    // 1. Login to get token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@acme.com', password: 'Password123!' });
    const token = loginRes.body.data.token;

    // 2. Generate API Key
    const keyRes = await request(app)
      .post('/api/v1/auth/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CI/CD Automation Key', scopes: ['agents:read', 'executions:write'] });

    expect(keyRes.status).toBe(201);
    expect(keyRes.body.data.apiKey).toMatch(/^asp_live_/);
    const liveKey = keyRes.body.data.apiKey;

    // 3. Access authenticated route with X-API-Key header
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('X-API-Key', liveKey);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('owner@acme.com');
  });

  it('should enforce RBAC role permissions', async () => {
    // Charlie is a WORKFLOW_OPERATOR (not OWNER)
    const operatorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'operator@acme.com', password: 'Password123!' });
    const operatorToken = operatorLogin.body.data.token;

    // WORKFLOW_OPERATOR cannot update tenant budget (requires OWNER)
    const budgetRes = await request(app)
      .patch('/api/v1/tenants/11111111-1111-1111-1111-111111111111/budget')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ monthlyBudgetUsd: 1000.00 });

    expect(budgetRes.status).toBe(403);
    expect(budgetRes.body.error.code).toBe('FORBIDDEN');
  });
});
