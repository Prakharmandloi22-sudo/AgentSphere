import request from 'supertest';
import { createApp } from '../src/app';
import { DataStore } from '../src/db';

describe('Assessment 03 & 04: Multi-Tenant Data Isolation & Security Tests', () => {
  const app = createApp();

  beforeEach(() => {
    DataStore.getInstance().reset();
  });

  it('should strictly isolate agents so tenant A cannot view tenant B agents', async () => {
    // Acme Corp Owner
    const acmeLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@acme.com', password: 'Password123!' });
    const acmeToken = acmeLogin.body.data.token;

    // Globex Owner
    const globexLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'lead@globex.com', password: 'Password123!' });
    const globexToken = globexLogin.body.data.token;

    // Acme owner lists agents (has agent-acme-001)
    const acmeAgentsRes = await request(app)
      .get('/api/v1/agents')
      .set('Authorization', `Bearer ${acmeToken}`);
    expect(acmeAgentsRes.status).toBe(200);
    expect(acmeAgentsRes.body.data.length).toBeGreaterThan(0);
    expect(acmeAgentsRes.body.data[0].id).toBe('agent-acme-001');

    // Globex owner lists agents (should have 0 agents initially)
    const globexAgentsRes = await request(app)
      .get('/api/v1/agents')
      .set('Authorization', `Bearer ${globexToken}`);
    expect(globexAgentsRes.status).toBe(200);
    expect(globexAgentsRes.body.data.length).toBe(0);

    // Globex user attempts to directly access Acme agent by ID
    const crossAccessRes = await request(app)
      .get('/api/v1/agents/agent-acme-001')
      .set('Authorization', `Bearer ${globexToken}`);
    expect(crossAccessRes.status).toBe(404);
  });

  it('should block cross-tenant header spoofing with 403 Forbidden', async () => {
    const globexLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'lead@globex.com', password: 'Password123!' });
    const globexToken = globexLogin.body.data.token;

    // Globex user sends X-Tenant-ID header of Acme Corp
    const breachRes = await request(app)
      .get('/api/v1/tenants/11111111-1111-1111-1111-111111111111')
      .set('Authorization', `Bearer ${globexToken}`)
      .set('X-Tenant-ID', '11111111-1111-1111-1111-111111111111');

    expect(breachRes.status).toBe(403);
    expect(breachRes.body.error.code).toBe('CROSS_TENANT_VIOLATION');
  });

  it('should enforce monthly spending limit and block executions when budget is exceeded', async () => {
    const store = DataStore.getInstance();
    // Artificially set Acme spend to exceed budget
    const acme = store.getTenant('11111111-1111-1111-1111-111111111111')!;
    acme.currentSpendUsd = acme.monthlyBudgetUsd + 10.00;

    const acmeLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@acme.com', password: 'Password123!' });
    const acmeToken = acmeLogin.body.data.token;

    const execRes = await request(app)
      .post('/api/v1/executions')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        agentId: 'agent-acme-001',
        inputQuery: 'Process refund for damaged item'
      });

    expect(execRes.status).toBe(400);
    expect(execRes.body.error.message).toContain('Tenant monthly budget limit');
  });
});
