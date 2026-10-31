// src/main/notion/client.ts — Notion API client singleton + rate limiter
import { Client } from '@notionhq/client';
import Bottleneck from 'bottleneck';
import log from 'electron-log';
import { getToken } from '../auth/keychain';
import { getConfig } from '../store/appConfig';
import { getRetryAfterMs, getStatusCode } from './errors';

const limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 334, // ~3 req/s with jitter headroom
    reservoir: 10,
    reservoirRefreshAmount: 10,
    reservoirRefreshInterval: 3500,
});

// Returning a number from 'failed' makes Bottleneck re-run the job after that many ms.
// Only rate-limit responses are retried here; other failures surface to the caller.
limiter.on('failed', (error, jobInfo) => {
    if (getStatusCode(error) !== 429 || jobInfo.retryCount >= 3) {
        return undefined;
    }
    const retryAfter = getRetryAfterMs(error);
    log.warn(`[notion-client] Rate limited, retrying in ${retryAfter}ms`);
    return retryAfter;
});

let clientInstance: Client | null = null;

export function createNotionClientWithToken(token: string): Client {
    return new Client({
        auth: token,
        notionVersion: '2022-06-28',
        timeoutMs: 30000,
    });
}

export async function getNotionClient(): Promise<Client> {
    const workspaceId = getConfig('activeWorkspace');
    if (!workspaceId) {
        throw new Error('No active workspace configured');
    }

    const token = await getToken(workspaceId);
    if (!token) {
        throw new Error('No authentication token found for active workspace');
    }

    if (!clientInstance) {
        clientInstance = createNotionClientWithToken(token);
    }

    return clientInstance;
}

export function resetClient(): void {
    clientInstance = null;
}

export async function notionRequest<T>(fn: () => Promise<T>): Promise<T> {
    return limiter.schedule(async () => {
        try {
            return await fn();
        } catch (error) {
            if (getStatusCode(error) === 401) {
                log.error('[notion-client] Authentication failed — token may be invalid');
                resetClient();
            }
            throw error;
        }
    });
}
