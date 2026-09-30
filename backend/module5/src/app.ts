import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { anonymousUserSchema, archivePeriodSchema, feedbackSchema, type SessionFactsPort } from './contracts.js';
import { openDatabase } from './database.js';
import { DevelopmentSessionFactsAdapter } from './session-facts.js';
import { DomainError, GrowthService } from './service.js';

export interface AppOptions { databasePath?: string; sessionFacts?: SessionFactsPort }

export function createApp(options: AppOptions = {}) {
  const database = openDatabase(options.databasePath);
  const sessionFacts = options.sessionFacts ?? new DevelopmentSessionFactsAdapter();
  const service = new GrowthService(database, sessionFacts);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use((_request, response, next) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, Idempotency-Key');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (_request.method === 'OPTIONS') return response.sendStatus(204);
    next();
  });

  app.get('/api/v1/health', (_request, response) => response.json({ data: { status: 'ok', module: 'growth', time: new Date().toISOString() } }));
  app.post('/api/v1/users/anonymous', (request, response) => {
    const input = anonymousUserSchema.parse(request.body ?? {});
    response.status(201).json({ data: service.createAnonymous(input.age_mode) });
  });

  app.use('/api/v1', (request, _response, next) => {
    if (request.path === '/health' || request.path === '/users/anonymous') return next();
    const userId = request.header('X-User-Id');
    if (!userId || !service.hasUser(userId)) return next(new DomainError('UNAUTHORIZED', '缺少有效的 X-User-Id', 401));
    request.userId = userId;
    next();
  });

  app.get('/api/v1/feedback/pending', async (request, response) => response.json({ data: await service.pendingFeedback(request.userId!) }));
  app.post('/api/v1/feedback', async (request, response) => {
    const input = feedbackSchema.parse(request.body);
    const idempotencyKey = request.header('Idempotency-Key') || `feedback:${input.session_id}`;
    response.status(201).json({ data: await service.submitFeedback(request.userId!, input, idempotencyKey) });
  });
  app.get('/api/v1/preferences', (request, response) => response.json({ data: service.preferences(request.userId!) }));
  app.get('/api/v1/points', (request, response) => response.json({ data: service.points(request.userId!) }));
  app.get('/api/v1/archive', (request, response) => {
    const period = archivePeriodSchema.parse(request.query.period ?? '7d');
    response.json({ data: service.archive(request.userId!, period) });
  });

  app.use((_request, _response, next) => next(new DomainError('NOT_FOUND', '接口不存在', 404)));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ZodError) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '请求参数不符合契约', details: error.issues } });
    if (error instanceof DomainError) return response.status(error.status).json({ error: { code: error.code, message: error.message } });
    console.error(error);
    return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务暂时不可用' } });
  });
  return { app, service, database, sessionFacts };
}

declare global {
  namespace Express { interface Request { userId?: string } }
}
