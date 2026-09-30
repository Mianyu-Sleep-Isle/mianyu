import { Router, type NextFunction, type Request, type Response } from 'express';
import { ApiError, userIdFrom } from '../../shared/http.ts';
import type { UserDirectory } from '../common/users.ts';
import { archivePeriodSchema, feedbackSchema } from './contracts.ts';
import { DomainError, type GrowthService } from './service.ts';

export const growthErrorTranslator = (error: unknown): ApiError | null =>
  error instanceof DomainError ? new ApiError(error.code, error.message, error.status) : null;

const registeredUser = (users: UserDirectory) => (request: Request, response: Response, next: NextFunction) => {
  const userId = userIdFrom(request);
  if (!userId || !users.hasUser(userId)) return next(new ApiError('UNAUTHORIZED', '缺少有效的 X-User-Id', 401));
  response.locals.userId = userId;
  next();
};

export function createGrowthRouter(service: GrowthService, users: UserDirectory): Router {
  const router = Router();
  const guard = registeredUser(users);
  const userId = (response: Response) => String(response.locals.userId);

  router.get('/feedback/pending', guard, async (_request, response) => {
    response.json({ data: await service.pendingFeedback(userId(response)) });
  });
  router.post('/feedback', guard, async (request, response) => {
    const input = feedbackSchema.parse(request.body);
    const idempotencyKey = request.header('Idempotency-Key') || `feedback:${input.session_id}`;
    response.status(201).json({ data: await service.submitFeedback(userId(response), input, idempotencyKey) });
  });
  router.get('/preferences', guard, (_request, response) => {
    response.json({ data: service.preferences(userId(response)) });
  });
  router.get('/points', guard, (_request, response) => {
    response.json({ data: service.points(userId(response)) });
  });
  router.get('/archive', guard, (request, response) => {
    const period = archivePeriodSchema.parse(request.query.period ?? '7d');
    response.json({ data: service.archive(userId(response), period) });
  });
  return router;
}
