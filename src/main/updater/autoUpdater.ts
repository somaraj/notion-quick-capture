// src/main/updater/autoUpdater.ts — electron-updater background updates from GitHub Releases
import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { app, BrowserWindow, Notification, powerMonitor, shell } from 'electron';
import log from 'electron-log';
import { setUpdateReady } from '../tray/tray';
import { getConfig, setConfig } from '../store/appConfig';
import { conciseError, releaseNotesToText, releaseUrl, resolveUpdateMode } from './updateInfo';
import type { UpdateState } from '../../shared/types';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
// After waking from sleep, check again if the last check is older than this
const RESUME_RECHECK_MS = 60 * 60 * 1000;

// Squirrel.Mac refuses to install updates into unsigned apps. Flip this once macOS
// releases are signed and notarized (see docs/RELEASING.md).
const MAC_RELEASES_SIGNED = false;

let state: UpdateState = {
    mode: 'disabled',
    status: 'idle',
    currentVersion: app.getVersion(),
};

// Versions already announced with a notification this session
const notified = new Set<string>();

function setState(patch: Partial<UpdateState>): void {
    state = { ...state, ...patch };
    BrowserWindow.getAllWindows().forEach((win) => win.webContents.send('updates:state', state));
}

export function getUpdateState(): UpdateState {
    return state;
}

function versionPatch(info: UpdateInfo): Partial<UpdateState> {
    return {
        version: info.version,
        releaseNotes: releaseNotesToText(info.releaseNotes),
        releaseUrl: releaseUrl(info.version),
    };
}

function notify(version: string, body: string, onClick: () => void): void {
    if (notified.has(version) || !Notification.isSupported()) return;
    notified.add(version);
    const notification = new Notification({ title: 'Notion Quick Capture', body });
    notification.on('click', onClick);
    notification.show();
}

function applyUpdatePreferences(): void {
    // 'notify' builds can't install, so never download there
    autoUpdater.autoDownload = state.mode === 'auto' && getConfig('autoDownloadUpdates');
    autoUpdater.allowPrerelease = getConfig('updateChannel') === 'beta';
    autoUpdater.allowDowngrade = false;
}

/** Re-apply settings after the user changes them in Settings → Updates. */
export function onUpdateConfigChanged(key: string): void {
    if (state.mode === 'disabled') return;
    if (key !== 'autoDownloadUpdates' && key !== 'updateChannel') return;
    applyUpdatePreferences();
    if (key === 'updateChannel') {
        checkForUpdates();
    } else if (autoUpdater.autoDownload && state.status === 'available') {
        downloadUpdate();
    }
}

export function checkForUpdates(): void {
    if (state.mode === 'disabled') return;
    // A check is in flight or an update is already on its way
    if (['checking', 'downloading', 'ready'].includes(state.status)) return;
    // Failures are reported through the 'error' event
    autoUpdater.checkForUpdates().catch(() => undefined);
}

export function downloadUpdate(): void {
    if (state.mode !== 'auto' || state.status !== 'available') return;
    setState({ status: 'downloading', percent: 0 });
    autoUpdater.downloadUpdate().catch(() => undefined);
}

export function openReleasePage(): void {
    void shell.openExternal(state.releaseUrl ?? releaseUrl(state.currentVersion));
}

export function installUpdateNow(): void {
    if (state.status !== 'ready') return;
    log.info(`[updater] Restarting to install v${state.version}`);
    // Silent install + relaunch: without isSilent, the assisted NSIS installer would show its wizard.
    // The app's before-quit handler still runs, so pending drafts are flushed to disk.
    autoUpdater.quitAndInstall(true, true);
}

/** Tell the user once after an update has been installed. */
function announceCompletedUpdate(): void {
    const current = app.getVersion();
    const previous = getConfig('lastRunVersion');
    setConfig('lastRunVersion', current);
    if (!previous || previous === current || !Notification.isSupported()) return;

    const notification = new Notification({
        title: 'Notion Quick Capture updated',
        body: `Now running v${current}. Click to see what's new.`,
    });
    notification.on('click', () => void shell.openExternal(releaseUrl(current)));
    notification.show();
}

export function setupAutoUpdater(): void {
    const mode = resolveUpdateMode({
        platform: process.platform,
        isPackaged: app.isPackaged,
        appImage: !!process.env['APPIMAGE'],
        macReleasesSigned: MAC_RELEASES_SIGNED,
        forceDev: process.env['NQC_DEV_UPDATES'] === '1',
    });
    state = { ...state, mode };

    if (app.isPackaged) announceCompletedUpdate();

    if (mode === 'disabled') {
        log.info('[updater] Auto-update disabled for this build');
        return;
    }
    log.info(`[updater] Update mode: ${mode}`);

    // Development: read the feed from dev-app-update.yml (see docs/RELEASING.md)
    if (!app.isPackaged) autoUpdater.forceDevUpdateConfig = true;

    // electron-updater's own logger also reports errors; keep it for info only to avoid duplicates
    autoUpdater.logger = {
        info: log.info,
        warn: log.warn,
        error: () => undefined,
        debug: () => undefined,
    };
    autoUpdater.autoInstallOnAppQuit = mode === 'auto';
    applyUpdatePreferences();

    autoUpdater.on('checking-for-update', () => {
        setState({ status: 'checking', error: undefined });
    });

    autoUpdater.on('update-not-available', () => {
        setState({ status: 'up-to-date', lastChecked: Date.now() });
    });

    autoUpdater.on('update-available', (info) => {
        log.info(`[updater] Update available: ${info.version}`);
        const downloading = autoUpdater.autoDownload;
        setState({
            ...versionPatch(info),
            status: downloading ? 'downloading' : 'available',
            percent: downloading ? 0 : undefined,
            lastChecked: Date.now(),
        });
        if (!downloading) {
            const action = mode === 'auto' ? 'download' : 'get';
            notify(
                info.version,
                `Version ${info.version} is available. Click to ${action} it.`,
                () => (mode === 'auto' ? downloadUpdate() : openReleasePage()),
            );
        }
    });

    autoUpdater.on('download-progress', (progress) => {
        setState({ status: 'downloading', percent: Math.round(progress.percent) });
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info(`[updater] Update downloaded: ${info.version}`);
        setState({ ...versionPatch(info), status: 'ready', percent: 100 });
        setUpdateReady(info.version);
        notify(
            info.version,
            `Version ${info.version} is ready. It installs when you quit, or click to restart now.`,
            installUpdateNow,
        );
    });

    autoUpdater.on('error', (error) => {
        const message = conciseError(error);
        log.warn('[updater] Update failed:', message);
        // A failed download can be retried; a failed check just reports the error
        setState({
            status: state.status === 'downloading' && state.version ? 'available' : 'error',
            error: message,
            percent: undefined,
        });
    });

    checkForUpdates();
    setInterval(checkForUpdates, CHECK_INTERVAL_MS).unref?.();

    // A tray app can stay running for weeks across sleep/wake; catch up after resuming
    powerMonitor.on('resume', () => {
        const last = state.lastChecked ?? 0;
        if (Date.now() - last > RESUME_RECHECK_MS) checkForUpdates();
    });
}
