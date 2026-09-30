import { Router } from 'express';
import { z } from 'zod';
import { ageModeFrom, requireUserId, userIdFrom } from '../../shared/http.ts';
import type { ContentCatalog } from './catalog.ts';

const listQuery = z.object({ category: z.string().trim().min(1).max(16), age_mode: z.enum(['adult', 'child']).optional() });
const favoriteBody = z.object({ favorite: z.boolean() });

export function createContentRouter(catalog: ContentCatalog): Router {
  const router = Router();
  router.get('/content', (request, response) => {
    const query = listQuery.parse(request.query);
    response.json({ data: catalog.list(query.category, userIdFrom(request)) });
  });
  router.get('/content/:assetId/playable', (request, response) => {
    const ageMode = request.query.age_mode === 'child' ? 'child' : ageModeFrom(request);
    response.json({ data: catalog.playable(String(request.params.assetId), ageMode) });
  });
  router.put('/content/:assetId/favorite', (request, response) => {
    const userId = requireUserId(request);
    response.json({ data: catalog.setFavorite(userId, String(request.params.assetId), favoriteBody.parse(request.body ?? {}).favorite) });
  });
  return router;
}
