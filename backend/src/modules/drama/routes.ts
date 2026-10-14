import { existsSync } from 'node:fs';
import path from 'node:path';
import { Router, type Request } from 'express';
import { ApiError, requireUserId } from '../../shared/http.ts';
import { mediaType, verifyMedia } from './media-sign.ts';
import { crisisHit } from './review.ts';
import { briefBodySchema, chatSchema, jobSchema } from './schemas.ts';
import type { DramaService } from './service.ts';
import type { UserService } from '../common/users.ts';

export interface MediaAccess {
  secret: string;
  resolve(jobId: string, fileName: string): string | null;
}

export function createDramaRouter(drama: DramaService, users: UserService, media: MediaAccess): Router {
  const router = Router();

  router.use((request, _response, next) => {
    const raw = `${request.originalUrl} ${request.url}`;
    if (raw.includes('/drama/media/') && /(\.\.|%2e%2e)/i.test(raw)) {
      next(new ApiError('MEDIA_LINK_EXPIRED', '媒体链接已失效', 403));
      return;
    }
    next();
  });

  router.get('/drama/media/:jobId/:fileName', (request, response, next) => {
    const jobId = String(request.params.jobId ?? '');
    const fileName = String(request.params.fileName ?? '');
    const exp = typeof request.query.exp === 'string' ? request.query.exp : undefined;
    const sig = typeof request.query.sig === 'string' ? request.query.sig : undefined;
    if (jobId.includes('..') || fileName.includes('..') || !verifyMedia(media.secret, jobId, fileName, exp, sig)) {
      next(new ApiError('MEDIA_LINK_EXPIRED', '媒体链接已失效', 403));
      return;
    }
    const file = media.resolve(jobId, fileName);
    if (!file || !existsSync(file) || !path.resolve(file).endsWith(path.join(jobId, fileName))) {
      next(new ApiError('MEDIA_NOT_FOUND', '视频文件不存在', 404));
      return;
    }
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.type(mediaType(fileName));
    response.sendFile(path.resolve(file), (error) => {
      if (error) next(error);
    });
  });

  router.use((request, _response, next) => {
    if (!request.path.includes('/drama')) {
      next();
      return;
    }
    const userId = requireUserId(request);
    const user = users.get(userId);
    request.dramaUserId = userId;
    request.dramaAgeMode = user.age_mode;
    if (!request.path.endsWith('/drama/capabilities') && user.age_mode === 'child') {
      next(new ApiError('DRAMA_CHILD_MODE_FORBIDDEN', '儿童模式下只能使用预先审核的故事', 403));
      return;
    }
    if (request.method !== 'GET' && crisisHit(request.body)) {
      next(new ApiError('PRODUCT_BOUNDARY_CRISIS', '本产品不能提供危机干预，请立即联系可信任的人或当地紧急援助', 400, []));
      return;
    }
    next();
  });

  router.get('/drama/capabilities', async (request, response) => {
    response.json({ data: await drama.capabilitiesLive(request.dramaAgeMode ?? 'adult', request.dramaUserId ?? '') });
  });

  router.post('/drama/chat', async (request, response) => {
    rejectExtraRound(request.body);
    const input = chatSchema.parse(request.body);
    response.json({ data: await drama.chat(userId(request), input) });
  });

  router.post('/drama/brief', async (request, response) => {
    rejectExtraRound(request.body);
    const input = chatSchema.parse(request.body);
    response.json({ data: await drama.brief(userId(request), input) });
  });

  router.get('/drama/jobs', (request, response) => {
    const raw = Number(request.query.limit ?? 20);
    const limit = Number.isInteger(raw) && raw >= 1 && raw <= 50 ? raw : 20;
    response.json({ data: drama.list(userId(request), limit) });
  });

  router.post('/drama/jobs', (request, response) => {
    const parsed = jobSchema.parse(request.body);
    const created = drama.createJob(userId(request), request.header('Idempotency-Key')?.trim(), parsed.brief);
    response.status(created.status).json({ data: created.job });
  });

  router.get('/drama/showcase', (_request, response) => {
    response.json({ data: drama.showcase() });
  });

  router.get('/drama/jobs/:jobId', (request, response) => {
    response.json({ data: drama.get(userId(request), String(request.params.jobId)) });
  });

  router.post('/drama/jobs/:jobId/cancel', (request, response) => {
    response.json({ data: drama.cancel(userId(request), String(request.params.jobId)) });
  });

  router.post('/drama/jobs/:jobId/retry', (request, response) => {
    response.json({ data: drama.retry(userId(request), String(request.params.jobId)) });
  });

  router.get('/drama/jobs/:jobId/result', (request, response) => {
    response.json({ data: drama.result(userId(request), String(request.params.jobId)) });
  });

  router.delete('/drama/jobs/:jobId', (request, response) => {
    response.json({ data: drama.remove(userId(request), String(request.params.jobId)) });
  });

  router.post('/drama/jobs/:jobId/shots/:order/regenerate', (_request, _response, next) => {
    next(new ApiError('NOT_IMPLEMENTED', '单镜头重画尚未开放', 501));
  });

  return router;
}

function userId(request: Request): string {
  return request.dramaUserId ?? requireUserId(request);
}

function rejectExtraRound(body: unknown): void {
  if (!body || typeof body !== 'object' || !('messages' in body) || !Array.isArray(body.messages)) return;
  const rounds = body.messages.filter((message) => message && typeof message === 'object' && 'role' in message && message.role === 'user').length;
  if (rounds > 6) throw new ApiError('DRAMA_CHAT_ROUND_LIMIT', '对话已经足够了，可以直接生成故事', 400);
}

export {};

declare global {
  namespace Express {
    interface Request {
      dramaUserId?: string;
      dramaAgeMode?: 'adult' | 'child';
    }
  }
}
