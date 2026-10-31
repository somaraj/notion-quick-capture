// src/main/windows/captureWindow.ts — Pre-warmed hidden capture window
import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import log from 'electron-log';
import { PRELOAD_PATH, RENDERER_DIST } from '../paths';
import { getConfig, setConfig } from '../store/appConfig';

let captureWin: BrowserWindow | null = null;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

// Size limits for the capture panel (the config schema allows the same range)
const MIN_WIDTH = 420;
const MAX_WIDTH = 800;
const MIN_HEIGHT = 360;
const MAX_HEIGHT = 1200;
// Keep the panel clear of the screen edges / taskbar
const SCREEN_MARGIN = 32;

function clamp(value: number, min: number, max: number): number {
    return Math.round(Math.min(Math.max(value, min), max));
}

/** Clamp a requested panel size to the limits and to the display the panel is shown on. */
function fitToScreen(width: number, height: number): { width: number; height: number } {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;
    return {
        width: clamp(width, MIN_WIDTH, Math.min(MAX_WIDTH, screenWidth - SCREEN_MARGIN)),
        height: clamp(height, MIN_HEIGHT, Math.min(MAX_HEIGHT, screenHeight - SCREEN_MARGIN)),
    };
}

function getWindowPosition(win: BrowserWindow): { x: number; y: number } {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;
    const { x: screenX, y: screenY } = display.workArea;
    const size = win.getSize();
    const winWidth = size[0] ?? 600;
    const winHeight = size[1] ?? 600;

    const x = Math.round(screenX + (screenWidth - winWidth) / 2);

    const panelPosition = getConfig('panelPosition');
    let y: number;

    switch (panelPosition) {
        case 'top':
            y = screenY + 64;
            break;
        case 'center':
            y = Math.round(screenY + (screenHeight - winHeight) / 2);
            break;
        case 'bottom':
            y = screenY + screenHeight - winHeight - 64;
            break;
        default:
            y = screenY + 64;
    }

    // Never start above the top of the work area (tall panels on small screens)
    return { x, y: Math.max(y, screenY + SCREEN_MARGIN / 2) };
}

export function createCaptureWindow(): BrowserWindow {
    const { width, height } = fitToScreen(getConfig('panelWidth'), getConfig('panelHeight'));

    captureWin = new BrowserWindow({
        width,
        height,
        show: false,
        frame: false,
        transparent: true,
        // Transparent windows can't use native resizing reliably; the panel has its own resize grip
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        hasShadow: true,
        vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
        visualEffectState: 'active',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: PRELOAD_PATH,
            webSecurity: true,
            allowRunningInsecureContent: false,
            experimentalFeatures: false,
        },
    });

    // Let the panel appear over full-screen apps and on every Space
    if (process.platform === 'darwin') {
        captureWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }

    // Navigation lock
    captureWin.webContents.on('will-navigate', (e) => e.preventDefault());
    captureWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // Load renderer
    if (VITE_DEV_SERVER_URL) {
        captureWin.loadURL(VITE_DEV_SERVER_URL);
    } else {
        captureWin.loadFile(path.join(RENDERER_DIST, 'index.html'));
    }

    captureWin.on('blur', () => {
        if (captureWin && captureWin.isVisible()) {
            const confirmOnClose = getConfig('confirmOnClose');
            if (!confirmOnClose) {
                hideCaptureWindow();
            }
        }
    });

    captureWin.on('closed', () => {
        captureWin = null;
    });

    log.info('[captureWindow] Pre-warmed capture window created');
    return captureWin;
}

/**
 * Resize the panel from its resize grip. Called continuously while dragging (persist=false)
 * and once at the end (persist=true) to remember the size for next time.
 */
export function setCaptureSize(width: number, height: number, persist: boolean): void {
    if (!captureWin) return;
    const size = fitToScreen(width, height);
    captureWin.setSize(size.width, size.height);
    if (persist) {
        setConfig('panelWidth', size.width);
        setConfig('panelHeight', size.height);
    }
}

export function applyConfigToWindow(key: string, value: unknown): void {
    if (key === 'panelWidth') {
        if (!captureWin) return;
        const [, height] = captureWin.getSize();
        const size = fitToScreen(value as number, height ?? getConfig('panelHeight'));
        captureWin.setSize(size.width, size.height);
        if (captureWin.isVisible()) {
            const { x, y } = getWindowPosition(captureWin);
            captureWin.setPosition(x, y);
        }
    } else if (key === 'panelPosition') {
        if (!captureWin) return;
        if (captureWin.isVisible()) {
            const { x, y } = getWindowPosition(captureWin);
            captureWin.setPosition(x, y);
        }
    } else if (key === 'launchAtLogin') {
        applyLaunchAtLogin(value as boolean);
    }
}

/** Register/unregister start at login. Skipped in development so the dev Electron binary isn't registered. */
export function applyLaunchAtLogin(enabled: boolean): void {
    if (!app.isPackaged) return;
    // Linux has no setLoginItemSettings support; users add the AppImage to their autostart manually
    if (process.platform !== 'darwin' && process.platform !== 'win32') return;
    app.setLoginItemSettings({ openAtLogin: enabled });
    log.info(`[captureWindow] Launch at login set to: ${enabled}`);
}

export function showCaptureWindow(): void {
    if (!captureWin) {
        createCaptureWindow();
    }

    if (!captureWin) return;

    // Tell the renderer the panel is being shown (it restores an unsaved note or starts fresh)
    captureWin.webContents.send('capture:reset');

    // Re-fit the saved size to the display under the cursor (it may be smaller than the last one)
    const size = fitToScreen(getConfig('panelWidth'), getConfig('panelHeight'));
    captureWin.setSize(size.width, size.height);

    const { x, y } = getWindowPosition(captureWin);
    captureWin.setPosition(x, y);
    captureWin.show();

    // A tray-only (dock-hidden) macOS app must activate itself to take keyboard focus
    if (process.platform === 'darwin') {
        app.focus({ steal: true });
    }
    captureWin.focus();
}

export function hideCaptureWindow(): void {
    if (!captureWin) return;
    captureWin.hide();

    // On macOS, hand focus back to the previously active app unless another window of ours is open
    if (process.platform === 'darwin') {
        const otherVisible = BrowserWindow.getAllWindows().some(
            (w) => w !== captureWin && w.isVisible(),
        );
        if (!otherVisible) app.hide();
    }
}

export function toggleCaptureWindow(): void {
    if (!captureWin) {
        showCaptureWindow();
        return;
    }

    if (captureWin.isVisible()) {
        if (captureWin.isFocused()) {
            hideCaptureWindow();
        } else {
            captureWin.focus();
        }
    } else {
        showCaptureWindow();
    }
}

export function getCaptureWindow(): BrowserWindow | null {
    return captureWin;
}
