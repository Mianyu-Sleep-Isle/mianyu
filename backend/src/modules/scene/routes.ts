import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import { userIdFrom } from '../../shared/http.ts';
import { frontendSceneSchema, saveCurrentDraft, toFrontendScene, type SceneAssetDirectory } from './frontend-compat.ts';
import { SceneService } from './service.ts';
import { SceneError, type SceneSnapshot } from './types.ts';

function requireUserId(request: Request): string {
  const userId = userIdFrom(request);
  if (!userId) throw new SceneError('IDENTITY_REQUIRED', '缺少本机匿名身份', 401);
  return userId;
}

function sceneConfigIdFrom(request: Request): string {
  const parsed = z.uuid().safeParse(String(request.params.sceneConfigId));
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}

function sendError(response: Response, error: unknown): void {
  const requestId = randomUUID();
  if (error instanceof SceneError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message, requestId, details: error.details } });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({ error: { code: 'INVALID_REQUEST', message: '请求字段不合法', requestId, details: error.issues } });
    return;
  }
  console.error(`[scene:${requestId}]`, error);
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', requestId, details: [] } });
}

export interface SceneRouterOptions {
  // When provided, responses also carry the frontend-api aliases and the
  // /scenes/current + /scenes/:id/handoff contract routes are mounted.
  assets?: SceneAssetDirectory;
}

export function createSceneRouter(service: SceneService, options: SceneRouterOptions = {}): Router {
  const router = Router();
  const { assets } = options;
  const present = (snapshot: SceneSnapshot) => assets ? toFrontendScene(snapshot, assets) : snapshot;

  if (assets) {
    router.get('/scenes/current', (request, response) => {
      try {
        const snapshot = service.current(requireUserId(request));
        response.json({ data: snapshot ? present(snapshot) : null });
      } catch (error) {
        sendError(response, error);
      }
    });
    router.put('/scenes/current', async (request, response) => {
      try {
        const snapshot = await saveCurrentDraft(service, requireUserId(request), request.body, assets, request.header('Idempotency-Key'));
        response.json({ data: present(snapshot) });
      } catch (error) {
        sendError(response, error);
      }
    });
    router.post('/scenes/:sceneConfigId/handoff', async (request, response) => {
      try {
        const userId = requireUserId(request);
        const sceneConfigId = sceneConfigIdFrom(request);
        const key = request.header('Idempotency-Key');
        if (Array.isArray(request.body?.sources) && service.get(userId, sceneConfigId).status === 'draft') {
          await saveCurrentDraft(service, userId, { ...frontendSceneSchema.parse(request.body), id: sceneConfigId }, assets, key);
        }
        response.json({ data: present(await service.handOff(userId, sceneConfigId, key)) });
      } catch (error) {
        sendError(response, error);
      }
    });
  }

  router.post('/scenes', async (request, response) => {
    try {
      const snapshot = await service.create(requireUserId(request), request.body ?? {}, request.header('Idempotency-Key'));
      response.status(201).json({ data: present(snapshot) });
    } catch (error) {
      sendError(response, error);
    }
  });
  router.get('/scenes/:sceneConfigId', (request, response) => {
    try {
      response.json({ data: present(service.get(requireUserId(request), sceneConfigIdFrom(request))) });
    } catch (error) {
      sendError(response, error);
    }
  });
  router.put('/scenes/:sceneConfigId', async (request, response) => {
    try {
      const snapshot = await service.save(requireUserId(request), sceneConfigIdFrom(request), request.body, request.header('Idempotency-Key'));
      response.json({ data: present(snapshot) });
    } catch (error) {
      sendError(response, error);
    }
  });
  router.post('/scenes/:sceneConfigId/hand-off', async (request, response) => {
    try {
      const snapshot = await service.handOff(requireUserId(request), sceneConfigIdFrom(request), request.header('Idempotency-Key'));
      response.json({ data: present(snapshot) });
    } catch (error) {
      sendError(response, error);
    }
  });
  router.post('/scenes/:sceneConfigId/copy', (request, response) => {
    try {
      response.status(201).json({ data: present(service.copy(requireUserId(request), sceneConfigIdFrom(request), request.header('Idempotency-Key'))) });
    } catch (error) {
      sendError(response, error);
    }
  });
  return router;
}
