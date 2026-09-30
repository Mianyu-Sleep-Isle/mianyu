import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export type AgeMode = 'adult' | 'child';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: unknown[] = [],
  ) {
    super(message);
  }
}

// Each module keeps its own domain error type; translators turn them into the
// shared `{ error: { code, message, requestId, details } }` envelope.
export type ErrorTranslator = (error: unknown) => ApiError | null;

// X-User-Id is the contract header; X-Mianyu-User-Id is kept for earlier module demos.
export function userIdFrom(request: Request): string | undefined {
  const value = request.header('X-User-Id') ?? request.header('X-Mianyu-User-Id');
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function requireUserId(request: Request): string {
  const userId = userIdFrom(request);
  if (!userId) throw new ApiError('IDENTITY_REQUIRED', '缺少本机匿名身份', 401);
  return userId;
}

export function ageModeFrom(request: Request): AgeMode {
  return (request.header('X-Age-Mode') ?? request.header('X-Mianyu-Age-Mode')) === 'child' ? 'child' : 'adult';
}

export function idempotencyKeyFrom(request: Request): string | undefined {
  const trimmed = request.header('Idempotency-Key')?.trim();
  return trimmed ? trimmed : undefined;
}

export function toApiError(error: unknown, translators: ErrorTranslator[] = []): ApiError | null {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) return new ApiError('INVALID_REQUEST', '请求字段不合法', 400, error.issues);
  for (const translate of translators) {
    const translated = translate(error);
    if (translated) return translated;
  }
  const bodyError = error as { type?: string; status?: number } | null;
  if (bodyError?.type === 'entity.parse.failed') return new ApiError('INVALID_JSON', '请求体不是合法 JSON', 400);
  if (bodyError?.type === 'entity.too.large') return new ApiError('PAYLOAD_TOO_LARGE', '请求体过大', 413);
  return null;
}

export function sendError(response: Response, error: unknown, translators: ErrorTranslator[] = [], scope = 'api'): void {
  const requestId = randomUUID();
  const apiError = toApiError(error, translators);
  if (apiError) {
    response.status(apiError.status).json({ error: { code: apiError.code, message: apiError.message, requestId, details: apiError.details } });
    return;
  }
  console.error(`[${scope}:${requestId}]`, error);
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', requestId, details: [] } });
}

export function createErrorHandler(translators: ErrorTranslator[]) {
  return (error: unknown, _request: Request, response: Response, _next: NextFunction): void => {
    sendError(response, error, translators);
  };
}

export function notFoundHandler(_request: Request, _response: Response, next: NextFunction): void {
  next(new ApiError('NOT_FOUND', '接口不存在', 404));
}
