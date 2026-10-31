// src/main/hotkey/globalShortcut.ts — Global hotkey registration with toggle behavior
import { globalShortcut, app } from 'electron';
import log from 'electron-log';
import { getConfig, setConfig } from '../store/appConfig';
import { toggleCaptureWindow } from '../windows/captureWindow';

let currentAccelerator: string | null = null;

function onHotkey(): void {
    toggleCaptureWindow();
}

/**
 * Register `accelerator` (or the configured hotkey) as the global shortcut.
 * The previous shortcut is only released once the new one is registered,
 * so a conflicting choice never leaves the user without a working hotkey.
 */
export function registerHotkey(accelerator?: string): boolean {
    const hotkey = accelerator ?? getConfig('globalHotkey');

    if (hotkey === currentAccelerator) return true;

    try {
        if (globalShortcut.isRegistered(hotkey)) {
            log.warn(`[hotkey] Accelerator already registered: ${hotkey}`);
            return false;
        }

        // register() returns false when another application owns the shortcut
        const success = globalShortcut.register(hotkey, onHotkey);
        if (!success) {
            log.error(`[hotkey] Failed to register hotkey (in use by another app?): ${hotkey}`);
            return false;
        }

        unregisterHotkey();
        currentAccelerator = hotkey;
        log.info(`[hotkey] Registered global hotkey: ${hotkey}`);
        return true;
    } catch (error) {
        // Invalid accelerator strings throw
        log.error(`[hotkey] Error registering hotkey ${hotkey}:`, error);
        return false;
    }
}

export function unregisterHotkey(): void {
    if (currentAccelerator) {
        try {
            globalShortcut.unregister(currentAccelerator);
            log.info(`[hotkey] Unregistered hotkey: ${currentAccelerator}`);
        } catch (error) {
            log.warn(`[hotkey] Error unregistering hotkey:`, error);
        }
        currentAccelerator = null;
    }
}

export function updateHotkey(newAccelerator: string): boolean {
    const success = registerHotkey(newAccelerator);
    if (success) {
        setConfig('globalHotkey', newAccelerator);
    }
    return success;
}

export function getCurrentHotkey(): string | null {
    return currentAccelerator;
}

app.on('will-quit', () => {
    // A second instance quits before 'ready', when globalShortcut can't be used yet
    if (!app.isReady()) return;
    globalShortcut.unregisterAll();
    log.info('[hotkey] All hotkeys unregistered');
});
