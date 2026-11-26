import request from 'supertest';
import { app } from '../src/app';
import { DataStore } from '../src/db';

describe('Assessment 02 & Assessment 04: Authentication & RBAC', () => {
  beforeEach(() => {
    DataStore.getInstance().reset();
  });

  it('should authenticate owner with valid credentials and return JWT token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@acme.com',
        password: 'Password123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('OWNER');
    expect(res.body.data.tenant.slug).toBe('acme-corp');
  });

  it('should reject invalid password with 401', async () => {
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

  it('should allow AI_BUILDER to create an agent', async () => {
    // 1. Login as AI Builder
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'builder@acme.com', password: 'Password123!' });
    const token = loginRes.body.data.token;

    // 2. Create Agent
    const res = await request(app)
      .post('/api/v1/agents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Automated Triaging Bot',
        description: 'Classifies inbound support tickets',
        workflowSteps: [
          {
            id: 's1',
            name: 'Analyze Request',
            stepType: 'LLM_PROMPT',
            config: { model: 'mock-gpt-4o', promptTemplate: 'Classify: {{query}}' }
          }
        ],
        allowedToolIds: [],
        knowledgeDocumentIds: []
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Automated Triaging Bot');
  });

  it('should forbid AUDITOR from creating an agent with 403', async () => {
    // 1. Login as Auditor
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'auditor@acme.com', password: 'Password123!' });
    const token = loginRes.body.data.token;

    // 2. Attempt Create Agent
    const res = await request(app)
      .post('/api/v1/agents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Unauthorized Agent',
        workflowSteps: []
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should authenticate using a scoped API key', async () => {
    // 1. Login as Owner to generate an API key
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@acme.com', password: 'Password123!' });
    const token = loginRes.body.data.token;

    const keyRes = await request(app)
      .post('/api/v1/auth/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CI/CD Pipeline Key', scopes: ['read', 'execute'] });

    expect(keyRes.status).toBe(201);
    const rawApiKey = keyRes.body.data.apiKey;
    expect(rawApiKey).toMatch(/^asp_live_/);

    // 2. Access endpoints with X-API-Key header
    const accessRes = await request(app)
      .get('/api/v1/agents')
      .set('x-api-key', rawApiKey);

    expect(accessRes.status).toBe(200);
    expect(accessRes.body.success).toBe(true);
  });
});
