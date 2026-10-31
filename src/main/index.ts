// src/main/index.ts — Electron main process entry point
import { app, dialog, Notification } from 'electron';
import log from 'electron-log';
import {
    createCaptureWindow,
    showCaptureWindow,
    applyLaunchAtLogin,
} from './windows/captureWindow';
import { showSettingsWindow } from './windows/settingsWindow';
import { createTray, setTrayActions } from './tray/tray';
import { registerHotkey } from './hotkey/globalShortcut';
import { registerIpcHandlers } from './ipc/handlers';
import { setupAutoUpdater, installUpdateNow, checkForUpdates } from './updater/autoUpdater';
import { getConfig } from './store/appConfig';
import {
    closeDraftStore,
    deleteExhaustedDrafts,
    getExhaustedDraftCount,
    initDraftStore,
} from './drafts/draftStore';
import { emitDraftCount, stopDraftRetryLoop, syncDrafts } from './drafts/sync';
import { formatAccelerator } from './tray/tray';

// Must match `appId` in electron-builder.config.cjs (Windows uses it for notifications)
const APP_ID = 'io.github.somaraj.notion-quick-capture';

log.initialize();
log.errorHandler.startCatching();

// ─── Single Instance Lock ──────────────────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // If user tries to open another instance, show capture window
        showCaptureWindow();
    });
}

// ─── App Setup ─────────────────────────────────────────────────────────────────

async function discardFailedDrafts(): Promise<void> {
    const count = getExhaustedDraftCount();
    if (count === 0) return;
    const { response } = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Discard', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        message: `Discard ${count} capture${count === 1 ? '' : 's'} that could not be saved?`,
        detail: 'These notes failed repeatedly (for example, the destination was deleted or is no longer shared). This cannot be undone.',
    });
    if (response === 0) {
        const removed = deleteExhaustedDrafts();
        log.info(`[main] Discarded ${removed} failed drafts`);
        emitDraftCount();
    }
}

app.on('ready', async () => {
    log.info(`[main] App ready (v${app.getVersion()}) — initializing...`);

    if (process.platform === 'win32') {
        app.setAppUserModelId(APP_ID);
    }

    // Hide dock icon on macOS (tray-resident app)
    if (process.platform === 'darwin') {
        app.dock?.hide();
    }

    // Initialize draft store (sql.js needs async WASM init)
    try {
        await initDraftStore();
    } catch (error) {
        log.error('[main] Failed to initialize draft store:', error);
    }

    registerIpcHandlers();

    // Create pre-warmed capture window (hidden)
    createCaptureWindow();

    setTrayActions({
        syncDrafts: () => void syncDrafts(true),
        discardFailedDrafts: () => void discardFailedDrafts(),
        installUpdate: installUpdateNow,
        checkForUpdates: () => {
            // Show the result where the user can see it
            showSettingsWindow('updates');
            checkForUpdates();
        },
    });
    createTray();

    // Register global hotkey
    if (!registerHotkey()) {
        const hotkey = formatAccelerator(getConfig('globalHotkey'));
        log.warn(`[main] Failed to register hotkey ${hotkey}`);
        if (Notification.isSupported()) {
            const notification = new Notification({
                title: 'Notion Quick Capture',
                body: `The shortcut ${hotkey} is used by another app. Click to choose a different one.`,
            });
            notification.on('click', () => showSettingsWindow('shortcuts'));
            notification.show();
        }
    }

    setupAutoUpdater();

    applyLaunchAtLogin(getConfig('launchAtLogin'));

    // Show pending draft count and try to flush the queue right away
    emitDraftCount();
    void syncDrafts();

    log.info('[main] Initialization complete');
});

// ─── App Lifecycle ─────────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
    // Keep running in the tray when all windows are closed
});

app.on('activate', () => {
    // macOS: clicking the app in Finder/Launchpad while running shows the capture panel
    showCaptureWindow();
});

app.on('before-quit', () => {
    log.info('[main] App quitting...');
    stopDraftRetryLoop();
    closeDraftStore();
});

// ─── Security: lock down every web contents ────────────────────────────────────

app.on('web-contents-created', (_, contents) => {
    contents.on('will-attach-webview', (event) => {
        event.preventDefault();
        log.warn('[main] Blocked webview creation');
    });
    contents.on('will-navigate', (event) => event.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
