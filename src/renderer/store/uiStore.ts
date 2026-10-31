// src/renderer/store/uiStore.ts — Pinia UI store
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { isValidUrl, isValidEmail, isValidDate } from '../lib/validators';
import type {
    SearchResult,
    DatabaseSchema,
    DestinationRef,
    CaptureResult,
    PropertyValue,
    Draft,
    SyncStatus,
    AuthStatus,
} from '../../shared/types';

export const useUiStore = defineStore('ui', () => {
    // ── Auth State ──
    const authStatus = ref<AuthStatus>({ authenticated: false });
    const isAuthLoading = ref(true);

    // ── Destination State ──
    const selectedDestination = ref<DestinationRef | null>(null);
    const searchResults = ref<SearchResult[]>([]);
    const isSearching = ref(false);
    const recentDestinations = ref<DestinationRef[]>([]);
    const pinnedDestinations = ref<DestinationRef[]>([]);

    // ── Schema State ──
    const currentSchema = ref<DatabaseSchema | null>(null);
    const isSchemaLoading = ref(false);

    // ── Capture State ──
    const title = ref('');
    const body = ref('');
    const properties = ref<Record<string, PropertyValue>>({});
    const isCapturing = ref(false);
    const captureResult = ref<CaptureResult | null>(null);
    const showSuccessToast = ref(false);
    const errorMessage = ref<string | null>(null);

    // ── Drafts State ──
    const drafts = ref<Draft[]>([]);
    const draftCount = ref(0);
    const syncStatus = ref<SyncStatus>('idle');

    // ── UI State ──
    const activeView = ref<'capture' | 'auth'>('capture');

    // ── Computed ──
    const isDatabase = computed(() => selectedDestination.value?.type === 'database');
    const hasRequiredFields = computed(() => {
        if (!currentSchema.value) return true;
        return currentSchema.value.properties
            .filter((p) => p.required)
            .every((p) => {
                const val = properties.value[p.name];
                if (!val) return false;
                if (val.type === 'title' || val.type === 'rich_text') {
                    return val.value.trim().length > 0;
                }
                return true;
            });
    });

    const validationErrors = computed<Record<string, string>>(() => {
        const errors: Record<string, string> = {};
        for (const [name, val] of Object.entries(properties.value)) {
            if (!val) continue;
            switch (val.type) {
                case 'url':
                    if (val.value && !isValidUrl(val.value)) {
                        errors[name] = 'Please enter a valid URL';
                    }
                    break;
                case 'email':
                    if (val.value && !isValidEmail(val.value)) {
                        errors[name] = 'Please enter a valid email';
                    }
                    break;
                case 'date':
                    if (val.start && !isValidDate(val.start)) {
                        errors[name] = 'Please enter a valid date';
                    }
                    if (val.end && !isValidDate(val.end)) {
                        errors[name] = 'Please enter a valid end date';
                    }
                    break;
            }
        }
        return errors;
    });

    const hasValidationErrors = computed(() => {
        return Object.keys(validationErrors.value).length > 0;
    });

    const canSubmit = computed(() => {
        if (!selectedDestination.value) return false;
        if (isCapturing.value) return false;
        if (isDatabase.value && !hasRequiredFields.value) return false;
        if (hasValidationErrors.value) return false;
        return title.value.trim().length > 0 || body.value.trim().length > 0;
    });

    // ── Actions ──
    function setDestination(dest: DestinationRef | null): void {
        selectedDestination.value = dest;
        if (!dest) {
            currentSchema.value = null;
            properties.value = {};
        }
    }

    function setSchema(schema: DatabaseSchema | null): void {
        currentSchema.value = schema;
        // Initialize properties with defaults
        if (schema) {
            const initial: Record<string, PropertyValue> = {};
            for (const prop of schema.properties) {
                switch (prop.type) {
                    case 'title':
                        initial[prop.name] = { type: 'title', value: '' };
                        break;
                    case 'rich_text':
                        initial[prop.name] = { type: 'rich_text', value: '' };
                        break;
                    case 'number':
                        initial[prop.name] = { type: 'number', value: null };
                        break;
                    case 'select':
                        initial[prop.name] = { type: 'select', value: null };
                        break;
                    case 'multi_select':
                        initial[prop.name] = { type: 'multi_select', value: [] };
                        break;
                    case 'date':
                        initial[prop.name] = { type: 'date', start: '', includeTime: false };
                        break;
                    case 'checkbox':
                        initial[prop.name] = { type: 'checkbox', value: false };
                        break;
                    case 'url':
                        initial[prop.name] = { type: 'url', value: '' };
                        break;
                    case 'email':
                        initial[prop.name] = { type: 'email', value: '' };
                        break;
                    case 'phone_number':
                        initial[prop.name] = { type: 'phone_number', value: '' };
                        break;
                    case 'people':
                        initial[prop.name] = { type: 'people', userIds: [] };
                        break;
                    case 'relation':
                        initial[prop.name] = { type: 'relation', pageIds: [] };
                        break;
                    case 'status':
                        initial[prop.name] = { type: 'status', value: '' };
                        break;
                    case 'files':
                        initial[prop.name] = { type: 'files', urls: [] };
                        break;
                }
            }
            properties.value = initial;
        }
    }

    function updateProperty(name: string, value: PropertyValue): void {
        properties.value[name] = value;
    }

    function resetCapture(): void {
        title.value = '';
        body.value = '';
        properties.value = {};
        captureResult.value = null;
        errorMessage.value = null;
        showSuccessToast.value = false;

        // Re-initialize properties if schema exists
        if (currentSchema.value) {
            setSchema(currentSchema.value);
        }
    }

    function showSuccess(result: CaptureResult): void {
        captureResult.value = result;
        showSuccessToast.value = true;
        setTimeout(() => {
            showSuccessToast.value = false;
        }, 1500);
    }

    function showError(message: string): void {
        errorMessage.value = message;
    }

    function clearError(): void {
        errorMessage.value = null;
    }

    return {
        // State
        authStatus,
        isAuthLoading,
        selectedDestination,
        searchResults,
        isSearching,
        recentDestinations,
        pinnedDestinations,
        currentSchema,
        isSchemaLoading,
        title,
        body,
        properties,
        isCapturing,
        captureResult,
        showSuccessToast,
        errorMessage,
        drafts,
        draftCount,
        syncStatus,
        activeView,
        // Computed
        isDatabase,
        hasRequiredFields,
        validationErrors,
        hasValidationErrors,
        canSubmit,
        // Actions
        setDestination,
        setSchema,
        updateProperty,
        resetCapture,
        showSuccess,
        showError,
        clearError,
    };
});
