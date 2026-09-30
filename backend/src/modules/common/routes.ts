import { Router } from 'express';
import { z } from 'zod';
import { requireUserId } from '../../shared/http.ts';
import type { UserService } from './users.ts';

const ageMode = z.enum(['adult', 'child']);
const anonymousSchema = z.object({ age_mode: ageMode.default('adult') });
const pinSchema = z.string().regex(/^\d{4}$/, 'PIN 必须是 4 位数字');
const updateSchema = z.object({
  age_mode: ageMode.optional(),
  pin: pinSchema.optional(),
  non_medical_accepted: z.boolean().optional(),
}).strict();
const verifySchema = z.object({ pin: pinSchema });

export function createCommonRouter(users: UserService): Router {
  const router = Router();
  router.post('/users/anonymous', (request, response) => {
    const input = anonymousSchema.parse(request.body ?? {});
    response.status(201).json({ data: users.createAnonymous(input.age_mode) });
  });
  router.get('/users/me', (request, response) => {
    response.json({ data: users.get(requireUserId(request)) });
  });
  router.patch('/users/me', (request, response) => {
    const userId = requireUserId(request);
    response.json({ data: users.update(userId, updateSchema.parse(request.body ?? {})) });
  });
  router.delete('/users/me/data', (request, response) => {
    response.json({ data: users.eraseAll(requireUserId(request)) });
  });
  router.post('/auth/pin/verify', (request, response) => {
    const userId = requireUserId(request);
    response.json({ data: users.verifyPin(userId, verifySchema.parse(request.body ?? {}).pin) });
  });
  return router;
}
