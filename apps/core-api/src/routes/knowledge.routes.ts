import { Router, Request, Response } from 'express';
import { UserRole } from '@agentsphere/shared';
import { v4 as uuidv4 } from 'uuid';
import { DataStore } from '../db';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// GET /api/v1/knowledge
router.get('/', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const docs = store.listDocuments(req.user!.tenantId);
  res.json({ success: true, data: docs });
});

// POST /api/v1/knowledge (Document ingestion initiation)
router.post('/', authenticate, requireRole(UserRole.OWNER, UserRole.AI_BUILDER), (req: Request, res: Response): void => {
  const { title, sourceType, mimeType, content, metadata } = req.body;
  if (!title || !content) {
    res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'title and content are required' } });
    return;
  }

  const store = DataStore.getInstance();
  const doc = store.createDocument(req.user!.tenantId, {
    title,
    sourceType: sourceType || 'MANUAL',
    mimeType: mimeType || 'text/plain',
    fileSizeBytes: Buffer.byteLength(content, 'utf8'),
    chunkCount: 0,
    status: 'INDEXED',
    metadata: metadata || {}
  });

  // Basic chunking (paragraphs or sentences)
  const rawChunks = content.split(/\n\n+/).filter((s: string) => s.trim().length > 0);
  doc.chunkCount = rawChunks.length;

  rawChunks.forEach((chunkText: string, idx: number) => {
    store.createChunk({
      id: uuidv4(),
      tenantId: req.user!.tenantId,
      documentId: doc.id,
      content: chunkText.trim(),
      chunkIndex: idx,
      tokenCount: Math.ceil(chunkText.length / 4),
      metadata: { source: title, chunkIndex: idx }
    });
  });

  store.addAuditLog({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    action: 'KNOWLEDGE_DOCUMENT_INGESTED',
    resourceType: 'KNOWLEDGE_DOCUMENT',
    resourceId: doc.id,
    payload: { title: doc.title, chunkCount: doc.chunkCount }
  });

  res.status(201).json({ success: true, data: doc });
});

// GET /api/v1/knowledge/:id
router.get('/:id', authenticate, (req: Request, res: Response): void => {
  const store = DataStore.getInstance();
  const doc = store.getDocument(req.user!.tenantId, req.params.id);
  if (!doc) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } });
    return;
  }
  const chunks = store.listChunksByDocument(req.user!.tenantId, req.params.id);
  res.json({ success: true, data: { ...doc, chunks } });
});

// POST /api/v1/knowledge/search (Multi-tenant scoped vector / semantic search)
router.post('/search', authenticate, (req: Request, res: Response): void => {
  const { query, limit } = req.body;
  if (!query) {
    res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Search query is required' } });
    return;
  }

  const store = DataStore.getInstance();
  // Safe search: strictly limited to req.user.tenantId
  const results = store.searchChunks(req.user!.tenantId, query, limit || 3);
  res.json({ success: true, data: results });
});

export default router;
