import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { PlanningService } from './service.ts';
import { PlanningError, type AgeMode } from './types.ts';
import { fromFrontendIntent, toFrontendPlan } from './frontend-compat.ts';
const userContext = (request: Request) => { const userId = request.header('X-Mianyu-User-Id') ?? request.header('X-User-Id');
  if (!userId) throw new PlanningError('IDENTITY_REQUIRED', '缺少本机匿名身份', 401);
  return { userId, ageMode: ((request.header('X-Mianyu-Age-Mode') ?? request.header('X-Age-Mode')) === 'child' ? 'child' : 'adult') as AgeMode }; };
const sendError = (response: Response, error: unknown) => { const requestId = randomUUID();
  if (error instanceof PlanningError) return response.status(error.status).json({ error: { code: error.code, message: error.message, requestId, details: error.details } });
  if (error instanceof ZodError) return response.status(400).json({ error: { code: 'INVALID_REQUEST', message: '请求字段不合法', requestId, details: error.issues } });
  console.error(`[planning:${requestId}]`, error);
  return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', requestId, details: [] } }); };
export function createPlanningRouter(service: PlanningService): Router { const router = Router();
  router.post('/plans/compose', async (req, res) => { try { const ctx = userContext(req); const result = await service.compose(ctx.userId, ctx.ageMode, req.body, req.header('Idempotency-Key')); res.status(201).json({ ...result, data: toFrontendPlan(result.data) }); } catch (e) { sendError(res, e); } });
  // Compatibility routes used by frontend-api/http-adapters.js.
  router.post('/plans', async (req, res) => { try { const ctx = userContext(req); const result = await service.compose(ctx.userId, ctx.ageMode, fromFrontendIntent(req.body), req.header('Idempotency-Key')); res.status(201).json({ ...result, data: toFrontendPlan(result.data) }); } catch (e) { sendError(res, e); } });
  router.get('/plans/current', (req, res) => { try { const ctx = userContext(req); const plan = service.getCurrentPlan(ctx.userId); res.json({ data: plan ? toFrontendPlan(plan) : null }); } catch (e) { sendError(res, e); } });
  router.post('/plans/regenerate', async (req, res) => { try { const ctx = userContext(req); const result = await service.compose(ctx.userId, ctx.ageMode, fromFrontendIntent(req.body), req.header('Idempotency-Key')); res.status(201).json({ ...result, data: toFrontendPlan(result.data) }); } catch (e) { sendError(res, e); } });
  router.get('/plans/:planId', (req, res) => { try { const ctx = userContext(req); res.json({ data: toFrontendPlan(service.getPlan(String(req.params.planId), ctx.userId)) }); } catch (e) { sendError(res, e); } });
  router.post('/plans/:planId/confirm', (req, res) => { try { const ctx = userContext(req); res.json({ data: toFrontendPlan(service.confirm(String(req.params.planId), ctx.userId)) }); } catch (e) { sendError(res, e); } });
  router.post('/plans/:planId/regenerate', async (req, res) => { try { const ctx = userContext(req); const result = await service.regenerate(String(req.params.planId), ctx.userId, ctx.ageMode, req.header('Idempotency-Key')); res.status(201).json({ ...result, data: toFrontendPlan(result.data) }); } catch (e) { sendError(res, e); } }); return router; }
