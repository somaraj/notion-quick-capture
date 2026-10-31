// src/main/tray/tray.ts — System tray icon + context menu with draft badge
import { Tray, Menu, nativeImage, app, type MenuItemConstructorOptions } from 'electron';
import log from 'electron-log';
import { toggleCaptureWindow, showCaptureWindow } from '../windows/captureWindow';
import { showSettingsWindow } from '../windows/settingsWindow';
import { showAboutWindow } from '../windows/aboutWindow';
import { getConfig } from '../store/appConfig';
import { getAssetPath } from '../paths';

export interface TrayActions {
    syncDrafts: () => void;
    discardFailedDrafts: () => void;
    installUpdate: () => void;
    checkForUpdates: () => void;
}

let tray: Tray | null = null;
let actions: TrayActions | null = null;
let draftCount = 0;
let failedDraftCount = 0;
let updateReady: string | null = null;

function getTrayIcon(): Electron.NativeImage {
    // Small pre-rendered PNGs look sharper in the tray than a downscaled 512px icon
    const iconName = process.platform === 'win32' ? 'tray-icon-32.png' : 'tray-icon.png';

    try {
        let icon = nativeImage.createFromPath(getAssetPath(iconName));
        if (icon.isEmpty()) {
            icon = nativeImage.createFromPath(getAssetPath('icon.png'));
        }
        if (icon.isEmpty()) {
            log.warn('[tray] Icon file missing or empty');
            return icon;
        }
        const size = process.platform === 'darwin' ? 16 : process.platform === 'win32' ? 16 : 24;
        return icon.resize({ width: size, height: size, quality: 'best' });
    } catch (error) {
        log.warn('[tray] Failed to load icon:', error);
        return nativeImage.createEmpty();
    }
}

export function formatAccelerator(accelerator: string): string {
    const isMac = process.platform === 'darwin';
    return accelerator
        .split('+')
        .map((part) => {
            switch (part) {
                case 'CommandOrControl':
                case 'CmdOrCtrl':
                    return isMac ? '⌘' : 'Ctrl';
                case 'Shift':
                    return isMac ? '⇧' : 'Shift';
                case 'Alt':
                    return isMac ? '⌥' : 'Alt';
                default:
                    return part;
            }
        })
        .join(isMac ? '' : '+');
}

function buildContextMenu(): Menu {
    const template: MenuItemConstructorOptions[] = [
        {
            label: `Open Capture (${formatAccelerator(getConfig('globalHotkey'))})`,
            click: () => showCaptureWindow(),
        },
    ];

    if (draftCount > 0) {
        template.push(
            { type: 'separator' },
            {
                label: `Sync ${draftCount} pending capture${draftCount === 1 ? '' : 's'} now`,
                click: () => actions?.syncDrafts(),
            },
        );
        if (failedDraftCount > 0) {
            template.push({
                label: `Discard ${failedDraftCount} failed capture${failedDraftCount === 1 ? '' : 's'}…`,
                click: () => actions?.discardFailedDrafts(),
            });
        }
    }

    if (updateReady) {
        template.push(
            { type: 'separator' },
            {
                label: `Restart to install v${updateReady}`,
                click: () => actions?.installUpdate(),
            },
        );
    }

    template.push(
        { type: 'separator' },
        { label: 'Settings', click: () => showSettingsWindow() },
        ...(updateReady
            ? []
            : [{ label: 'Check for Updates…', click: () => actions?.checkForUpdates() }]),
        { label: 'About', click: () => showAboutWindow() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
    );

    return Menu.buildFromTemplate(template);
}

export function setTrayActions(trayActions: TrayActions): void {
    actions = trayActions;
}

export function createTray(): Tray {
    const icon = getTrayIcon();

    tray = new Tray(icon);
    tray.setToolTip('Notion Quick Capture');
    tray.setContextMenu(buildContextMenu());

    // Left-click toggles capture panel (macOS opens the menu on click instead)
    tray.on('click', () => {
        toggleCaptureWindow();
    });

    log.info('[tray] System tray created');
    return tray;
}

export function updateTrayMenu(): void {
    if (!tray) return;
    tray.setContextMenu(buildContextMenu());
}

export function updateTrayBadge(count: number, failedCount = 0): void {
    draftCount = count;
    failedDraftCount = failedCount;
    if (!tray) return;

    if (process.platform === 'darwin') {
        app.dock?.setBadge(count > 0 ? String(count) : '');
    }

    const tooltip =
        count > 0
            ? `Notion Quick Capture (${count} pending capture${count === 1 ? '' : 's'})`
            : 'Notion Quick Capture';
    tray.setToolTip(tooltip);

    updateTrayMenu();
}

export function setUpdateReady(version: string): void {
    updateReady = version;
    updateTrayMenu();
}

export function getTray(): Tray | null {
    return tray;
}
