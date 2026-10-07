import { Router, type Request } from 'express';
import { z } from 'zod';
import { ApiError, type AgeMode } from '../../shared/http.ts';
import type { AuthService } from './accounts.ts';

const ageMode = z.enum(['adult', 'child']);

const identifierSchema = z.object({
  username: z.string().min(3).max(32).optional(),
  phone: z.string().regex(/^1\d{10}$/).optional(),
}).refine(d => Boolean(d.username || d.phone), { message: '用户名和手机号至少填写一项' });

const passwordSchema = z.string().min(6).max(64);

const registerSchema = identifierSchema.extend({
  password: passwordSchema,
  age_mode: ageMode.default('adult'),
});

const loginSchema = identifierSchema.extend({
  password: z.string().min(1).max(64),
});

// Extract bearer token from Authorization header or X-Auth-Token
export function tokenFrom(request: Request): string | undefined {
  const authHeader = request.header('Authorization');
  if (authHeader && /^Bearer\s+(.+)$/i.test(authHeader)) return authHeader.replace(/^Bearer\s+/i, '').trim();
  const xToken = request.header('X-Auth-Token')?.trim();
  return xToken || undefined;
}

export function requireAuthToken(request: Request): string {
  const token = tokenFrom(request);
  if (!token) throw new ApiError('UNAUTHORIZED', '需要登录', 401);
  return token;
}

export function createAuthRouter(auth: AuthService): Router {
  const router = Router();

  // POST /auth/register — create account
  router.post('/auth/register', (request, response) => {
    const body = (request.body ?? {}) as { password?: string };
    const input = registerSchema.parse(request.body ?? {});
    const registerInput = { username: input.username ?? null, phone: input.phone ?? null, password: input.password, age_mode: input.age_mode };
    const profile = auth.register(registerInput);
    const loginInput = { username: profile.username, phone: profile.phone, password: body.password || '' };
    const tok = auth.login(loginInput);
    response.status(201).json({ data: { ...profile, token: tok.token, expires_at: tok.expires_at } });
  });

  // POST /auth/login — username or phone + password
  router.post('/auth/login', (request, response) => {
    const input = loginSchema.parse(request.body ?? {});
    const loginInput = { username: input.username ?? null, phone: input.phone ?? null, password: input.password };
    const tok = auth.login(loginInput);
    const profile = auth.getProfile(tok.token);
    response.json({ data: { ...profile, token: tok.token, expires_at: tok.expires_at } });
  });

  // GET /auth/me — current account profile (requires token)
  router.get('/auth/me', (request, response) => {
    const token = requireAuthToken(request);
    const profile = auth.getProfile(token);
    if (!profile) throw new ApiError('UNAUTHORIZED', '登录已过期，请重新登录', 401);
    response.json({ data: profile });
  });

  // POST /auth/logout
  router.post('/auth/logout', (request, response) => {
    const token = tokenFrom(request);
    if (token) auth.logout(token);
    response.json({ data: { ok: true } });
  });

  return router;
}
