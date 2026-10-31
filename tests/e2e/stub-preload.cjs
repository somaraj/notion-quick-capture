// tests/e2e/stub-preload.cjs — Fake `notionBridge` for UI smoke tests (no network, no token).
// The scenario is chosen with ?s=<name> on the page URL. Saved payloads are reported to the test
// runner through console messages prefixed with "E2E:".
const { contextBridge } = require('electron');

const scenario = new URLSearchParams(location.search).get('s') || 'page';

const pageDest = { id: 'p1', type: 'page', title: 'Inbox' };
const dbDest = { id: 'd1', type: 'database', title: 'Tasks', icon: '✅' };

const config = {
    theme: scenario === 'dark' ? 'dark' : scenario === 'system' ? 'system' : 'light',
    bodyFontSize: 14,
    globalHotkey: 'CommandOrControl+Shift+N',
    panelPosition: 'center',
    panelWidth: 600,
    launchAtLogin: true,
    confirmOnClose: true,
    schemaCacheTtl: 300000,
    autoDownloadUpdates: true,
    updateChannel: 'stable',
    offlineDrafts: true,
    defaultDestination: scenario === 'db' ? dbDest : scenario === 'none' ? null : pageDest,
    recentDestinations: [{ id: 'p9', type: 'page', title: 'Reading list' }],
    pinnedDestinations: [],
};

const schema = {
    id: 'd1',
    title: 'Tasks',
    properties: [
        { id: 'title', name: 'Name', type: 'title', required: false },
        { id: 'a', name: 'Status', type: 'status', required: false, options: [], statusGroups: [] },
        { id: 'b', name: 'Due', type: 'date', required: false },
        { id: 'c', name: 'Tags', type: 'multi_select', required: false, options: [] },
        { id: 'd', name: 'Priority', type: 'select', required: false, options: [] },
        { id: 'e', name: 'Notes', type: 'rich_text', required: false },
    ],
};

const searchResults = [
    { id: 'p1', type: 'page', title: 'Inbox' },
    { id: 'd1', type: 'database', title: 'Tasks', icon: '✅' },
];

const listeners = { captureReset: [], configChanged: [] };
const report = (kind, data) => console.info('E2E:' + JSON.stringify({ kind, data }));
const ok = (value) => () => Promise.resolve(value);
const noop = () => {};

contextBridge.exposeInMainWorld('notionBridge', {
    auth: {
        getCapabilities: ok({ oauthAvailable: false }),
        startOAuth: ok({ success: false, error: null }),
        saveToken: ok(false),
        getAuthStatus: ok(
            scenario === 'auth'
                ? { authenticated: false }
                : { authenticated: true, workspace: { workspaceId: 'w', workspaceName: 'Test' } },
        ),
        logout: ok(undefined),
    },
    notion: {
        search: ok(searchResults),
        getSchema: ok(schema),
        capture: (payload) => {
            report('capture', payload);
            return Promise.resolve({
                status: 'success',
                pageId: 'new',
                pageUrl: 'https://notion.so/new',
            });
        },
        getUsers: ok([]),
    },
    config: {
        get: (key) => Promise.resolve(config[key]),
        set: (key, value) => {
            config[key] = value;
            return Promise.resolve();
        },
    },
    hotkey: { update: ok(true) },
    drafts: {
        list: ok([]),
        retry: ok({ status: 'error' }),
        delete: ok(undefined),
        syncNow: ok(undefined),
        count: ok(0),
    },
    window: {
        close: () => {
            report('close', null);
            return Promise.resolve();
        },
        openSettings: ok(undefined),
        openExternal: ok(undefined),
        openAbout: ok(undefined),
        setCaptureSize: ok(undefined),
    },
    updates: {
        getState: ok({ mode: 'auto', status: 'up-to-date', currentVersion: '1.0.0' }),
        check: ok(undefined),
        download: ok(undefined),
        install: ok(undefined),
        openReleasePage: ok(undefined),
    },
    on: {
        draftCountChanged: noop,
        syncStatus: noop,
        configChanged: (cb) => listeners.configChanged.push(cb),
        captureReset: (cb) => listeners.captureReset.push(cb),
        authChanged: noop,
        updateState: noop,
    },
});

// Test-only hooks
contextBridge.exposeInMainWorld('e2e', {
    /** Simulate the main process showing the panel again (after it was hidden). */
    showPanel: () => listeners.captureReset.forEach((cb) => cb()),
    /** Simulate a change made in the settings window. */
    changeConfig: (key, value) => listeners.configChanged.forEach((cb) => cb(key, value)),
});
