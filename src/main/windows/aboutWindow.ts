// src/main/windows/aboutWindow.ts — About BrowserWindow
import { BrowserWindow } from 'electron';
import path from 'path';
import log from 'electron-log';
import { getAssetPath, PRELOAD_PATH, RENDERER_DIST } from '../paths';

let aboutWin: BrowserWindow | null = null;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

export function showAboutWindow(): void {
    if (aboutWin) {
        aboutWin.focus();
        return;
    }

    aboutWin = new BrowserWindow({
        width: 440,
        height: 580,
        show: false,
        title: 'About — Notion Quick Capture',
        icon: getAssetPath('icon.png'),
        resizable: false,
        minimizable: false,
        maximizable: false,
        autoHideMenuBar: true,
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

    // Remove menu entirely
    aboutWin.setMenu(null);

    // Navigation lock
    aboutWin.webContents.on('will-navigate', (e) => e.preventDefault());
    aboutWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // Load about page
    if (VITE_DEV_SERVER_URL) {
        const base = VITE_DEV_SERVER_URL.trim().replace(/\/+$/, '');
        aboutWin.loadURL(`${base}/about.html`);
    } else {
        aboutWin.loadFile(path.join(RENDERER_DIST, 'about.html'));
    }

    aboutWin.once('ready-to-show', () => {
        aboutWin?.show();
    });

    aboutWin.webContents.on(
        'did-fail-load',
        (_event, errorCode, errorDescription, validatedURL) => {
            log.error(
                `[aboutWindow] Failed to load: ${validatedURL} - ${errorCode} ${errorDescription}`,
            );
        },
    );

    aboutWin.on('closed', () => {
        aboutWin = null;
    });

    log.info('[aboutWindow] About window created');
}
