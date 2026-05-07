import { z } from 'zod';
import {
  type BacktestRequest,
  type BacktestResponse,
  BacktestResponseSchema,
  type HealthResponse,
  HealthResponseSchema,
} from '@/lib/types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.length > 0
    ? process.env.NEXT_PUBLIC_API_URL
    : '/api';

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.cause = cause;
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'ValidationError';
  }
}

export class DataUnavailableError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'DataUnavailableError';
  }
}

export class ServerError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'ServerError';
  }
}

export class NetworkError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'NetworkError';
  }
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

function flattenDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: unknown) => {
        if (d && typeof d === 'object' && 'msg' in d && 'loc' in d) {
          const obj = d as { msg: unknown; loc: unknown };
          const loc = Array.isArray(obj.loc) ? obj.loc.join('.') : String(obj.loc);
          return `${loc}: ${obj.msg}`;
        }
        return JSON.stringify(d);
      })
      .join('; ');
  }
  return JSON.stringify(detail);
}

async function apiFetch<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodSchema<T>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch (e) {
    throw new NetworkError(
      'Could not reach the API. Is the backend running on :8000?',
      e,
    );
  }

  if (res.status === 422) {
    const body = await res.json().catch(() => null);
    throw new ValidationError(
      flattenDetail(body?.detail ?? 'Validation error'),
      body,
    );
  }
  if (res.status === 400) {
    const body = await res.json().catch(() => null);
    throw new DataUnavailableError(
      typeof body?.detail === 'string' ? body.detail : 'Bad request',
      body,
    );
  }
  if (res.status >= 500) {
    throw new ServerError(`Server error ${res.status} on ${path}`);
  }
  if (!res.ok) {
    throw new ApiError(`API error ${res.status} ${res.statusText}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    throw new ApiError('Response was not valid JSON', e);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(
      `Response shape mismatch: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
      parsed.error,
    );
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export function getHealth(): Promise<HealthResponse> {
  return apiFetch('/health', { method: 'GET' }, HealthResponseSchema);
}

export function runBacktest(req: BacktestRequest): Promise<BacktestResponse> {
  return apiFetch(
    '/backtest',
    { method: 'POST', body: JSON.stringify(req) },
    BacktestResponseSchema,
  );
}
