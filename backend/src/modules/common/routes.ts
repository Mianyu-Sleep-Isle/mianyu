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
  // 兼容旧客户端：会传 pin_configured 等"只读"字段。allow unknown 字段而忽略它们。
}).passthrough();
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
    // 解析后只取白名单字段（age_mode / pin / non_medical_accepted）转发给 service；
    // 旧客户端传 pin_configured 等只读字段，passthrough 容忍它们但不会被使用。
    const parsed = updateSchema.parse(request.body ?? {});
    const input: { age_mode?: 'adult' | 'child'; pin?: string; non_medical_accepted?: boolean } = {
      ...(parsed.age_mode !== undefined ? { age_mode: parsed.age_mode } : {}),
      ...(parsed.pin !== undefined ? { pin: parsed.pin } : {}),
      ...(parsed.non_medical_accepted !== undefined ? { non_medical_accepted: parsed.non_medical_accepted } : {}),
    };
    response.json({ data: users.update(userId, input) });
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
