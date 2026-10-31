// src/main/notion/errors.ts — Classify Notion / network failures as retryable (queue as draft) or permanent
import { APIErrorCode, ClientErrorCode, isNotionClientError } from '@notionhq/client';

const RETRYABLE_API_CODES = new Set<string>([
    APIErrorCode.RateLimited,
    APIErrorCode.InternalServerError,
    APIErrorCode.ServiceUnavailable,
    APIErrorCode.ConflictError,
    ClientErrorCode.RequestTimeout,
]);

// Node / undici network failures that mean "offline or flaky connection"
const NETWORK_ERROR_CODES = new Set([
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENETUNREACH',
    'EHOSTUNREACH',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
]);

export function getStatusCode(error: unknown): number | undefined {
    if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: unknown }).status;
        return typeof status === 'number' ? status : undefined;
    }
    return undefined;
}

/** True when retrying the same request later could succeed (offline, rate limit, 5xx, timeout). */
export function isRetryableError(error: unknown): boolean {
    if (isNotionClientError(error)) {
        if (RETRYABLE_API_CODES.has(error.code)) return true;
        const status = getStatusCode(error);
        return status !== undefined && status >= 500;
    }

    // fetch() wraps network failures as TypeError('fetch failed') with the real error in `cause`
    let current: unknown = error;
    for (let depth = 0; current && depth < 5; depth++) {
        const code = (current as { code?: unknown }).code;
        if (typeof code === 'string' && NETWORK_ERROR_CODES.has(code)) return true;
        if (current instanceof TypeError && current.message === 'fetch failed') return true;
        current = (current as { cause?: unknown }).cause;
    }
    return false;
}

/** Retry-After (ms) for a 429 response, defaulting to 1s. */
export function getRetryAfterMs(error: unknown): number {
    const headers = (error as { headers?: unknown } | null)?.headers;
    let raw: string | null | undefined;
    if (headers && typeof (headers as Headers).get === 'function') {
        raw = (headers as Headers).get('retry-after');
    } else if (headers && typeof headers === 'object') {
        raw = (headers as Record<string, string | undefined>)['retry-after'];
    }
    const seconds = raw ? Number.parseFloat(raw) : NaN;
    return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 60_000) : 1000;
}

export function toErrorMessage(error: unknown): string {
    if (isNotionClientError(error)) {
        switch (error.code) {
            case APIErrorCode.Unauthorized:
                return 'Notion rejected the token. Reconnect your workspace in Settings.';
            case APIErrorCode.ObjectNotFound:
            case APIErrorCode.RestrictedResource:
                return 'Destination not found. Make sure the page or database is shared with your integration.';
            default:
                return error.message;
        }
    }
    return error instanceof Error ? error.message : 'Unknown error';
}
