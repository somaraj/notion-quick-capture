// src/main/ipc/handlers.ts — All ipcMain.handle() registrations with Zod validation
import { ipcMain, BrowserWindow, shell } from 'electron';
import { z } from 'zod';
import log from 'electron-log';
import { startOAuthFlow } from '../auth/oauth';
import { isOAuthAvailable } from '../auth/oauthConfig';
import { saveToken, getToken, deleteToken } from '../auth/keychain';
import { getConfig, setConfig } from '../store/appConfig';
import { searchNotion } from '../notion/search';
import { getDatabaseSchema, resetSchemaCache } from '../notion/schema';
import { captureToNotion } from '../notion/capture';
import {
    createNotionClientWithToken,
    getNotionClient,
    notionRequest,
    resetClient,
} from '../notion/client';
import { isRetryableError } from '../notion/errors';
import { saveDraft, listDrafts, getDraft, deleteDraft, getDraftCount } from '../drafts/draftStore';
import { emitDraftCount, startDraftRetryLoop, syncDrafts } from '../drafts/sync';
import { updateHotkey } from '../hotkey/globalShortcut';
import { updateTrayMenu } from '../tray/tray';
import { hideCaptureWindow, applyConfigToWindow, setCaptureSize } from '../windows/captureWindow';
import { showSettingsWindow } from '../windows/settingsWindow';
import { showAboutWindow } from '../windows/aboutWindow';
import {
    checkForUpdates,
    downloadUpdate,
    getUpdateState,
    installUpdateNow,
    onUpdateConfigChanged,
    openReleasePage,
} from '../updater/autoUpdater';
import type {
    AppConfig,
    AuthCapabilities,
    CapturePayload,
    CaptureResult,
    AuthStatus,
    SearchResult,
    NotionUser,
} from '../../shared/types';

// ─── Zod Schemas ───────────────────────────────────────────────────────────────

const MAX_TEXT = 200_000;
const MAX_LIST = 100;

const IdSchema = z.string().min(1).max(100);
const ShortText = z.string().max(2000);

const PropertyValueSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('title'), value: ShortText }),
    z.object({ type: z.literal('rich_text'), value: ShortText }),
    z.object({ type: z.literal('number'), value: z.number().finite().nullable() }),
    z.object({ type: z.literal('select'), value: z.string().max(100).nullable() }),
    z.object({
        type: z.literal('multi_select'),
        value: z.array(z.string().max(100)).max(MAX_LIST),
    }),
    z.object({
        type: z.literal('date'),
        start: z.string().max(40),
        end: z.string().max(40).optional(),
        includeTime: z.boolean(),
    }),
    z.object({ type: z.literal('checkbox'), value: z.boolean() }),
    z.object({ type: z.literal('url'), value: ShortText }),
    z.object({ type: z.literal('email'), value: z.string().max(200) }),
    z.object({ type: z.literal('phone_number'), value: z.string().max(200) }),
    z.object({ type: z.literal('people'), userIds: z.array(IdSchema).max(MAX_LIST) }),
    z.object({ type: z.literal('relation'), pageIds: z.array(IdSchema).max(MAX_LIST) }),
    z.object({ type: z.literal('status'), value: z.string().max(100) }),
    z.object({ type: z.literal('files'), urls: z.array(ShortText).max(MAX_LIST) }),
]);

const CapturePayloadSchema = z.object({
    destinationId: IdSchema,
    destinationType: z.enum(['page', 'database']),
    title: ShortText,
    body: z.string().max(MAX_TEXT),
    properties: z
        .record(z.string().max(200), PropertyValueSchema)
        .refine((props) => Object.keys(props).length <= 200, 'Too many properties'),
});

const DestinationRefSchema = z.object({
    id: IdSchema,
    type: z.enum(['page', 'database']),
    title: z.string().max(500),
    icon: z.string().max(100).optional(),
});

/** Settings the renderer may change, with the values each accepts. Everything else is main-process only. */
const WritableConfigSchemas = {
    defaultDestination: DestinationRefSchema.nullable(),
    launchAtLogin: z.boolean(),
    panelPosition: z.enum(['top', 'center', 'bottom']),
    panelWidth: z.number().int().min(400).max(800),
    theme: z.enum(['system', 'light', 'dark']),
    bodyFontSize: z.number().int().min(12).max(18),
    schemaCacheTtl: z
        .number()
        .int()
        .min(0)
        .max(24 * 60 * 60 * 1000),
    offlineDrafts: z.boolean(),
    confirmOnClose: z.boolean(),
    pinnedDestinations: z.array(DestinationRefSchema).max(20),
    recentDestinations: z.array(DestinationRefSchema).max(10),
    autoDownloadUpdates: z.boolean(),
    updateChannel: z.enum(['stable', 'beta']),
} satisfies Partial<Record<keyof AppConfig, z.ZodType>>;

type WritableConfigKey = keyof typeof WritableConfigSchemas;

const READABLE_CONFIG_KEYS = new Set<keyof AppConfig>([
    'globalHotkey',
    'defaultDestination',
    'launchAtLogin',
    'panelPosition',
    'panelWidth',
    'theme',
    'bodyFontSize',
    'schemaCacheTtl',
    'offlineDrafts',
    'confirmOnClose',
    'recentDestinations',
    'pinnedDestinations',
    'autoDownloadUpdates',
    'updateChannel',
]);

const SearchQuerySchema = z.string().max(500);
const DraftIdSchema = z.uuid();
const TokenSchema = z.string().trim().min(1).max(500);
const AccountSchema = z.string().min(1).max(200);
const AcceleratorSchema = z.string().min(1).max(100);
const ExternalUrlSchema = z
    .string()
    .max(2048)
    .refine((value) => {
        try {
            return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol);
        } catch {
            return false;
        }
    });

// ─── Helpers ───────────────────────────────────────────────────────────────────

function broadcast(channel: string, ...args: unknown[]): void {
    BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(channel, ...args);
    });
}

function setActiveWorkspace(workspaceId: string | null, workspaceName: string | null): void {
    setConfig('activeWorkspace', workspaceId);
    setConfig('activeWorkspaceName', workspaceName);
    resetClient();
    resetSchemaCache();
    broadcast('auth:changed');
}

// ─── Handler Registration ──────────────────────────────────────────────────────

export function registerIpcHandlers(): void {
    // ── Auth ──
    ipcMain.handle('auth:getCapabilities', (): AuthCapabilities => {
        return { oauthAvailable: isOAuthAvailable() };
    });

    ipcMain.handle('auth:startOAuth', async () => {
        try {
            const workspace = await startOAuthFlow();
            if (workspace) {
                setActiveWorkspace(workspace.workspaceId, workspace.workspaceName);
                return { success: true, error: null };
            }
            return { success: false, error: 'OAuth flow was cancelled or timed out' };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'OAuth failed';
            log.error('[ipc] OAuth failed:', message);
            return { success: false, error: message };
        }
    });

    ipcMain.handle('auth:saveToken', async (_, rawToken: unknown) => {
        try {
            const token = TokenSchema.parse(rawToken);

            // Validates the token and identifies the integration's workspace in one call
            const me = (await createNotionClientWithToken(token).users.me({})) as unknown as {
                id: string;
                bot?: { workspace_name?: string | null };
            };

            await saveToken(me.id, token);
            setActiveWorkspace(me.id, me.bot?.workspace_name || 'Notion Workspace');
            return true;
        } catch (error) {
            // Never log the token itself
            log.error('[ipc] Save token failed:', error instanceof Error ? error.message : error);
            return false;
        }
    });

    ipcMain.handle('auth:getAuthStatus', async (): Promise<AuthStatus> => {
        try {
            const workspaceId = getConfig('activeWorkspace');
            if (!workspaceId) {
                return { authenticated: false };
            }

            const token = await getToken(workspaceId);
            if (!token) {
                return { authenticated: false };
            }

            return {
                authenticated: true,
                workspace: {
                    workspaceId,
                    workspaceName: getConfig('activeWorkspaceName') ?? 'Notion Workspace',
                },
            };
        } catch (error) {
            log.error('[ipc] Auth status check failed:', error);
            return { authenticated: false };
        }
    });

    ipcMain.handle('auth:logout', async (_, rawAccount: unknown) => {
        try {
            const account = AccountSchema.parse(rawAccount);
            await deleteToken(account);
            if (getConfig('activeWorkspace') === account) {
                setActiveWorkspace(null, null);
            }
        } catch (error) {
            log.error('[ipc] Logout failed:', error);
        }
    });

    // ── Notion Data ──
    ipcMain.handle('notion:search', async (_, rawQuery: unknown): Promise<SearchResult[]> => {
        try {
            const query = SearchQuerySchema.parse(rawQuery);
            return await searchNotion(query);
        } catch (error) {
            log.error('[ipc] Search failed:', error);
            return [];
        }
    });

    ipcMain.handle('notion:getSchema', async (_, rawDatabaseId: unknown) => {
        try {
            const databaseId = IdSchema.parse(rawDatabaseId);
            return await getDatabaseSchema(databaseId);
        } catch (error) {
            log.error('[ipc] Get schema failed:', error);
            throw new Error('Failed to fetch database schema');
        }
    });

    ipcMain.handle('notion:capture', async (_, rawPayload: unknown): Promise<CaptureResult> => {
        const parsed = CapturePayloadSchema.safeParse(rawPayload);
        if (!parsed.success) {
            log.warn('[ipc] Rejected invalid capture payload:', parsed.error.issues);
            return { status: 'error', error: 'Invalid capture data' };
        }
        const payload = parsed.data as CapturePayload;

        try {
            const { retryable, ...result } = await captureToNotion(payload);

            // Only transient failures (offline, rate limit, Notion outage) are queued —
            // permanent ones (bad token, missing database, validation) are shown to the user.
            if (result.status === 'error' && retryable && getConfig('offlineDrafts')) {
                const draftId = saveDraft(payload, result.error);
                emitDraftCount();
                return { status: 'queued', draftId };
            }

            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            log.error('[ipc] Capture failed:', message);

            if (isRetryableError(error) && getConfig('offlineDrafts')) {
                const draftId = saveDraft(payload, message);
                emitDraftCount();
                return { status: 'queued', draftId };
            }
            return { status: 'error', error: message };
        }
    });

    ipcMain.handle('notion:getUsers', async (): Promise<NotionUser[]> => {
        try {
            const client = await getNotionClient();
            const response = await notionRequest(() => client.users.list({}));
            const users = response.results as unknown as Array<{
                id: string;
                type: string;
                name: string | null;
                avatar_url: string | null;
                person?: { email: string };
            }>;
            return users
                .filter((u) => u.type === 'person')
                .map((u) => ({
                    id: u.id,
                    name: u.name ?? 'Unknown',
                    avatarUrl: u.avatar_url ?? undefined,
                    email: u.person?.email,
                }));
        } catch (error) {
            log.error('[ipc] Get users failed:', error);
            return [];
        }
    });

    // ── Config ──
    ipcMain.handle('config:get', (_, rawKey: unknown) => {
        const key = z.string().parse(rawKey) as keyof AppConfig;
        if (!READABLE_CONFIG_KEYS.has(key)) {
            throw new Error(`Unknown config key: ${String(key)}`);
        }
        return getConfig(key);
    });

    ipcMain.handle('config:set', (_, rawKey: unknown, rawValue: unknown) => {
        const key = z.string().parse(rawKey);
        if (!(key in WritableConfigSchemas)) {
            throw new Error(`Config key is not writable: ${key}`);
        }
        const value = WritableConfigSchemas[key as WritableConfigKey].parse(rawValue);
        setConfig(key as WritableConfigKey, value as AppConfig[WritableConfigKey]);

        if (key === 'schemaCacheTtl') resetSchemaCache();

        // Broadcast config change to all windows so they can react immediately
        broadcast('config:changed', key, value);

        // Apply native window changes (panel width, position, login item)
        applyConfigToWindow(key, value);
        onUpdateConfigChanged(key);
    });

    // ── Hotkey ──
    ipcMain.handle('hotkey:update', (_, rawAccelerator: unknown) => {
        const accelerator = AcceleratorSchema.parse(rawAccelerator);
        const ok = updateHotkey(accelerator);
        if (ok) {
            updateTrayMenu();
            broadcast('config:changed', 'globalHotkey', accelerator);
        }
        return ok;
    });

    // ── Drafts ──
    ipcMain.handle('drafts:list', () => {
        return listDrafts();
    });

    ipcMain.handle('drafts:retry', async (_, rawId: unknown): Promise<CaptureResult> => {
        try {
            const id = DraftIdSchema.parse(rawId);
            const draft = getDraft(id);
            if (!draft) {
                return { status: 'error', error: 'Draft not found' };
            }

            const { retryable: _retryable, ...result } = await captureToNotion(draft.payload);
            if (result.status === 'success') {
                deleteDraft(id);
                emitDraftCount();
            }
            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { status: 'error', error: message };
        }
    });

    ipcMain.handle('drafts:syncNow', () => syncDrafts(true));

    ipcMain.handle('drafts:count', () => getDraftCount());

    ipcMain.handle('drafts:delete', (_, rawId: unknown) => {
        const id = DraftIdSchema.parse(rawId);
        deleteDraft(id);
        emitDraftCount();
    });

    // ── Window ──
    ipcMain.handle('window:close', () => {
        hideCaptureWindow();
    });

    ipcMain.handle('window:openSettings', () => {
        hideCaptureWindow();
        showSettingsWindow();
    });

    ipcMain.handle('window:openExternal', async (_, rawUrl: unknown) => {
        const parsed = ExternalUrlSchema.safeParse(rawUrl);
        if (!parsed.success) {
            log.warn('[ipc] Blocked openExternal for disallowed URL');
            return;
        }
        await shell.openExternal(parsed.data);
    });

    ipcMain.handle(
        'window:setCaptureSize',
        (_, rawWidth: unknown, rawHeight: unknown, rawPersist: unknown) => {
            const width = z.number().finite().parse(rawWidth);
            const height = z.number().finite().parse(rawHeight);
            setCaptureSize(width, height, z.boolean().parse(rawPersist));
        },
    );

    ipcMain.handle('window:openAbout', () => {
        showAboutWindow();
    });

    // ── Updates ──
    ipcMain.handle('updates:getState', () => getUpdateState());
    ipcMain.handle('updates:check', () => checkForUpdates());
    ipcMain.handle('updates:download', () => downloadUpdate());
    ipcMain.handle('updates:install', () => installUpdateNow());
    ipcMain.handle('updates:openReleasePage', () => openReleasePage());

    startDraftRetryLoop();

    log.info('[ipc] All handlers registered');
}
