import { describe, expect, it } from 'vitest';
import { APIErrorCode, APIResponseError, RequestTimeoutError } from '@notionhq/client';
import { getRetryAfterMs, isRetryableError } from '../src/main/notion/errors';

function apiError(status: number, code: APIErrorCode, headers: Record<string, string> = {}) {
    return new APIResponseError({
        code,
        status,
        message: code,
        headers: new Headers(headers),
        rawBodyText: '{}',
    } as ConstructorParameters<typeof APIResponseError>[0]);
}

describe('isRetryableError', () => {
    it('retries rate limits, server errors and timeouts', () => {
        expect(isRetryableError(apiError(429, APIErrorCode.RateLimited))).toBe(true);
        expect(isRetryableError(apiError(502, APIErrorCode.InternalServerError))).toBe(true);
        expect(isRetryableError(apiError(503, APIErrorCode.ServiceUnavailable))).toBe(true);
        expect(isRetryableError(new RequestTimeoutError())).toBe(true);
    });

    it('does not retry permanent client errors', () => {
        expect(isRetryableError(apiError(401, APIErrorCode.Unauthorized))).toBe(false);
        expect(isRetryableError(apiError(404, APIErrorCode.ObjectNotFound))).toBe(false);
        expect(isRetryableError(apiError(400, APIErrorCode.ValidationError))).toBe(false);
    });

    it('retries offline network failures from fetch', () => {
        const cause = Object.assign(new Error('getaddrinfo ENOTFOUND api.notion.com'), {
            code: 'ENOTFOUND',
        });
        expect(isRetryableError(new TypeError('fetch failed', { cause }))).toBe(true);
    });

    it('does not retry arbitrary errors', () => {
        expect(isRetryableError(new Error('boom'))).toBe(false);
        expect(isRetryableError(undefined)).toBe(false);
    });
});

describe('getRetryAfterMs', () => {
    it('reads Retry-After seconds and caps it', () => {
        expect(
            getRetryAfterMs(apiError(429, APIErrorCode.RateLimited, { 'retry-after': '2' })),
        ).toBe(2000);
        expect(
            getRetryAfterMs(apiError(429, APIErrorCode.RateLimited, { 'retry-after': '999' })),
        ).toBe(60000);
        expect(getRetryAfterMs(apiError(429, APIErrorCode.RateLimited))).toBe(1000);
    });
});
