// src/main/drafts/sync.ts — Background retry of queued (offline) captures
import { BrowserWindow, net } from 'electron';
import log from 'electron-log';
import { captureToNotion } from '../notion/capture';
import { getConfig } from '../store/appConfig';
import { updateTrayBadge } from '../tray/tray';
import {
    deleteDraft,
    getDraftCount,
    getExhaustedDraftCount,
    getPendingDrafts,
    incrementRetryCount,
    setLastError,
} from './draftStore';

const RETRY_INTERVAL_MS = 30_000;

let retryTimer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<void> | null = null;

/** Push the current draft count to every window and the tray. */
export function emitDraftCount(): void {
    const count = getDraftCount();
    BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('drafts:countChanged', count);
    });
    updateTrayBadge(count, getExhaustedDraftCount());
}

async function runSync(includeExhausted: boolean): Promise<void> {
    if (!getConfig('activeWorkspace')) return;
    if (!net.isOnline()) return;

    const pending = getPendingDrafts(includeExhausted);
    if (pending.length === 0) return;

    log.info(`[sync] Retrying ${pending.length} pending drafts`);

    for (const draft of pending) {
        const result = await captureToNotion(draft.payload);
        if (result.status === 'success') {
            deleteDraft(draft.id);
            log.info(`[sync] Draft ${draft.id} synced successfully`);
        } else if (result.retryable) {
            // Offline / rate-limited / Notion outage: keep trying without using up retries
            setLastError(draft.id, result.error ?? 'Temporary failure');
            break;
        } else {
            incrementRetryCount(draft.id, result.error ?? 'Unknown error');
        }
    }

    emitDraftCount();
}

/** Retry queued drafts now. Concurrent calls share one run. */
export function syncDrafts(includeExhausted = false): Promise<void> {
    if (!inFlight) {
        inFlight = runSync(includeExhausted)
            .catch((error) => log.error('[sync] Draft sync failed:', error))
            .finally(() => {
                inFlight = null;
            });
    }
    return inFlight;
}

export function startDraftRetryLoop(): void {
    if (retryTimer) return;
    retryTimer = setInterval(() => void syncDrafts(), RETRY_INTERVAL_MS);
}

export function stopDraftRetryLoop(): void {
    if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
    }
}
