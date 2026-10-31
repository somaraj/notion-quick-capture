// src/shared/types.ts — Complete shared type definitions for Notion Quick Capture

// ─── App Config ────────────────────────────────────────────────────────────────

export interface DestinationRef {
    id: string;
    type: 'page' | 'database';
    title: string;
    icon?: string;
}

export interface WorkspaceConfig {
    workspaceId: string;
    workspaceName: string;
    workspaceIcon?: string;
}

/** Pages of the settings window; also used as the URL hash to deep-link into one */
export type SettingsPage = 'general' | 'appearance' | 'shortcuts' | 'updates' | 'advanced';

export interface AppConfig {
    globalHotkey: string;
    defaultDestination: DestinationRef | null;
    launchAtLogin: boolean;
    panelPosition: 'top' | 'center' | 'bottom';
    panelWidth: number;
    panelHeight: number;
    theme: 'system' | 'light' | 'dark';
    bodyFontSize: number;
    schemaCacheTtl: number;
    offlineDrafts: boolean;
    confirmOnClose: boolean;
    activeWorkspace: string | null;
    activeWorkspaceName: string | null;
    recentDestinations: DestinationRef[];
    pinnedDestinations: DestinationRef[];
    /** Download updates in the background (installed on quit or via "Restart to install") */
    autoDownloadUpdates: boolean;
    /** 'beta' also offers GitHub releases marked as pre-release */
    updateChannel: 'stable' | 'beta';
    /** Version that last ran, to announce a completed update once (main process only) */
    lastRunVersion: string | null;
}

// ─── Notion Schema ─────────────────────────────────────────────────────────────

export type NotionPropertyType =
    | 'title'
    | 'rich_text'
    | 'number'
    | 'select'
    | 'multi_select'
    | 'date'
    | 'checkbox'
    | 'url'
    | 'email'
    | 'phone_number'
    | 'people'
    | 'relation'
    | 'status'
    | 'files'
    | 'formula'
    | 'rollup'
    | 'created_time'
    | 'created_by'
    | 'last_edited_time'
    | 'last_edited_by';

export interface SelectOption {
    id: string;
    name: string;
    color: string;
}

export interface StatusGroup {
    id: string;
    name: string;
    color: string;
    optionIds: string[];
}

export interface PropertyConfig {
    id: string;
    name: string;
    type: NotionPropertyType;
    required: boolean;
    options?: SelectOption[];
    statusGroups?: StatusGroup[];
    relationDatabaseId?: string;
    numberFormat?: string;
    formulaType?: string;
    rollupType?: string;
}

export interface DatabaseSchema {
    id: string;
    title: string;
    icon?: string;
    properties: PropertyConfig[];
}

// ─── Capture Payload ───────────────────────────────────────────────────────────

export type PropertyValue =
    | { type: 'title'; value: string }
    | { type: 'rich_text'; value: string }
    | { type: 'number'; value: number | null }
    | { type: 'select'; value: string | null }
    | { type: 'multi_select'; value: string[] }
    | { type: 'date'; start: string; end?: string; includeTime: boolean }
    | { type: 'checkbox'; value: boolean }
    | { type: 'url'; value: string }
    | { type: 'email'; value: string }
    | { type: 'phone_number'; value: string }
    | { type: 'people'; userIds: string[] }
    | { type: 'relation'; pageIds: string[] }
    | { type: 'status'; value: string }
    | { type: 'files'; urls: string[] };

export interface CapturePayload {
    destinationId: string;
    destinationType: 'page' | 'database';
    title: string;
    body: string;
    properties: Record<string, PropertyValue>;
}

export interface CaptureResult {
    status: 'success' | 'queued' | 'error';
    pageId?: string;
    pageUrl?: string;
    draftId?: string;
    error?: string;
}

// ─── Drafts ────────────────────────────────────────────────────────────────────

export interface Draft {
    id: string;
    payload: CapturePayload;
    createdAt: number;
    retryCount: number;
    lastError?: string;
}

// ─── Sync Status ───────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error';

// ─── Search Results ────────────────────────────────────────────────────────────

export interface SearchResult {
    id: string;
    type: 'page' | 'database';
    title: string;
    icon?: string;
    parentTitle?: string;
}

// ─── User Info ─────────────────────────────────────────────────────────────────

export interface NotionUser {
    id: string;
    name: string;
    avatarUrl?: string;
    email?: string;
}

export interface AuthStatus {
    authenticated: boolean;
    workspace?: WorkspaceConfig;
}

// ─── Bridge (preload → renderer) ───────────────────────────────────────────────

export interface AuthCapabilities {
    /** OAuth is only available in builds that were given client credentials. */
    oauthAvailable: boolean;
}

export interface OAuthResult {
    success: boolean;
    error: string | null;
}

// ─── Updates ───────────────────────────────────────────────────────────────────

/**
 * How this build updates itself:
 * - auto: downloads and installs from GitHub Releases (Windows, Linux AppImage, signed macOS)
 * - notify: checks only, and links to the release page for a manual download (unsigned macOS, .deb)
 * - disabled: development builds
 */
export type UpdateMode = 'auto' | 'notify' | 'disabled';

export type UpdateStatus =
    'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error';

export interface UpdateState {
    mode: UpdateMode;
    status: UpdateStatus;
    currentVersion: string;
    /** The newer version, once one is found */
    version?: string;
    /** Plain-text release notes for `version` */
    releaseNotes?: string;
    releaseUrl?: string;
    /** Download progress, 0–100 */
    percent?: number;
    error?: string;
    /** Epoch ms of the last completed check */
    lastChecked?: number;
}

export interface NotionBridge {
    auth: {
        getCapabilities: () => Promise<AuthCapabilities>;
        startOAuth: () => Promise<OAuthResult>;
        saveToken: (token: string) => Promise<boolean>;
        getAuthStatus: () => Promise<AuthStatus>;
        logout: (account: string) => Promise<void>;
    };
    notion: {
        search: (query: string) => Promise<SearchResult[]>;
        getSchema: (databaseId: string) => Promise<DatabaseSchema>;
        capture: (payload: CapturePayload) => Promise<CaptureResult>;
        getUsers: () => Promise<NotionUser[]>;
    };
    config: {
        get: <K extends keyof AppConfig>(key: K) => Promise<AppConfig[K]>;
        set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => Promise<void>;
    };
    hotkey: {
        /** Registers the new global shortcut and persists it; false if it could not be registered. */
        update: (accelerator: string) => Promise<boolean>;
    };
    drafts: {
        list: () => Promise<Draft[]>;
        retry: (id: string) => Promise<CaptureResult>;
        delete: (id: string) => Promise<void>;
        /** Retry every queued capture now (including ones that failed repeatedly). */
        syncNow: () => Promise<void>;
        count: () => Promise<number>;
    };
    window: {
        close: () => Promise<void>;
        openSettings: () => Promise<void>;
        openExternal: (url: string) => Promise<void>;
        openAbout: () => Promise<void>;
        /** Resize the capture panel (clamped by the main process); persist=true saves it as the default size. */
        setCaptureSize: (width: number, height: number, persist: boolean) => Promise<void>;
    };
    updates: {
        getState: () => Promise<UpdateState>;
        /** Check now; resolves once the check has started (progress arrives via on.updateState). */
        check: () => Promise<void>;
        /** Start downloading an available update (when automatic downloads are off). */
        download: () => Promise<void>;
        /** Quit, install the downloaded update and relaunch. */
        install: () => Promise<void>;
        openReleasePage: () => Promise<void>;
    };
    on: {
        draftCountChanged: (cb: (count: number) => void) => void;
        syncStatus: (cb: (status: SyncStatus) => void) => void;
        configChanged: (cb: (key: string, value: unknown) => void) => void;
        captureReset: (cb: () => void) => void;
        authChanged: (cb: () => void) => void;
        updateState: (cb: (state: UpdateState) => void) => void;
    };
}

// ─── Global Window Augmentation ────────────────────────────────────────────────

declare global {
    interface Window {
        notionBridge: NotionBridge;
    }
}
