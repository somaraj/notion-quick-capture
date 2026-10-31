// src/renderer/composables/useNotion.ts — Notion search + capture composable
import { ref } from 'vue';
import { useUiStore } from '../store/uiStore';
import type { CapturePayload, CaptureResult, SearchResult } from '../../shared/types';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function useNotion() {
    const store = useUiStore();
    const searchError = ref<string | null>(null);

    async function search(query: string): Promise<void> {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(async () => {
            if (!query.trim()) {
                store.searchResults = [];
                store.isSearching = false;
                return;
            }

            store.isSearching = true;
            searchError.value = null;

            try {
                const results: SearchResult[] = await window.notionBridge.notion.search(query);
                store.searchResults = results;
            } catch (error) {
                searchError.value = error instanceof Error ? error.message : 'Search failed';
                store.searchResults = [];
            } finally {
                store.isSearching = false;
            }
        }, 300);
    }

    async function capture(): Promise<CaptureResult> {
        store.isCapturing = true;
        store.clearError();

        const dest = store.selectedDestination;
        if (!dest) {
            store.isCapturing = false;
            return { status: 'error', error: 'No destination selected' };
        }

        const payload: CapturePayload = {
            destinationId: dest.id,
            destinationType: dest.type,
            title: store.title,
            body: store.body,
            properties: { ...store.properties },
        };

        // Deep-unwrap Vue reactive proxies — IPC structured clone can't serialize them
        const plainPayload: CapturePayload = JSON.parse(JSON.stringify(payload));

        try {
            const result = await window.notionBridge.notion.capture(plainPayload);
            if (result.status === 'error') {
                store.showError(result.error ?? 'Capture failed');
            } else {
                // 'success', or 'queued' (offline — it syncs automatically later)
                store.showSuccess(result);
            }
            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Capture failed';
            store.showError(message);
            return { status: 'error', error: message };
        } finally {
            store.isCapturing = false;
        }
    }

    async function getUsers() {
        try {
            return await window.notionBridge.notion.getUsers();
        } catch {
            return [];
        }
    }

    return {
        search,
        capture,
        getUsers,
        searchError,
    };
}
