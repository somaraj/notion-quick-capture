// src/renderer/composables/useSchema.ts — Schema fetch composable
import { useUiStore } from '../store/uiStore';

export function useSchema() {
    const store = useUiStore();

    async function fetchSchema(databaseId: string): Promise<void> {
        store.isSchemaLoading = true;

        try {
            const schema = await window.notionBridge.notion.getSchema(databaseId);
            store.setSchema(schema);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch schema';
            store.showError(message);
            store.setSchema(null);
        } finally {
            store.isSchemaLoading = false;
        }
    }

    function clearSchema(): void {
        store.setSchema(null);
    }

    return {
        fetchSchema,
        clearSchema,
    };
}
