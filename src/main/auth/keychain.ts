// src/main/auth/keychain.ts — Secure credential storage via Electron safeStorage + electron-store
// Uses Electron's built-in safeStorage API (encrypts using OS keychain under the hood)
// This avoids the deprecated 'keytar' native module and its node-gyp build issues.
import { safeStorage } from 'electron';
import Store from 'electron-store';
import log from 'electron-log';

interface EncryptedCredentials {
    [account: string]: string; // Base64-encoded encrypted tokens
}

const credStore = new Store<{ credentials: EncryptedCredentials }>({
    name: 'credentials',
    defaults: {
        credentials: {},
    },
    // Do not expose the encryption key — safeStorage handles it
});

let backendChecked = false;

function ensureSafeStorageAvailable(): void {
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('OS encryption is not available — cannot store credentials securely');
    }
    // On Linux without a running secret service (GNOME Keyring / KWallet), Electron falls back
    // to a hard-coded key. Still works, but warn so users know their token is weakly protected.
    if (!backendChecked && process.platform === 'linux') {
        backendChecked = true;
        const backend = safeStorage.getSelectedStorageBackend();
        if (backend === 'basic_text' || backend === 'unknown') {
            log.warn(
                `[keychain] No OS secret service found (backend: ${backend}). Tokens are only ` +
                    'obfuscated. Install/enable gnome-keyring or KWallet for proper encryption.',
            );
        }
    }
}

export async function saveToken(account: string, token: string): Promise<void> {
    try {
        ensureSafeStorageAvailable();
        const encrypted = safeStorage.encryptString(token);
        const base64 = encrypted.toString('base64');

        const credentials = credStore.get('credentials');
        credentials[account] = base64;
        credStore.set('credentials', credentials);

        log.info(`[keychain] Token saved for account: ${account}`);
    } catch (error) {
        log.error('[keychain] Failed to save token:', error);
        throw new Error('Failed to save credentials securely');
    }
}

export async function getToken(account: string): Promise<string | null> {
    try {
        ensureSafeStorageAvailable();
        const credentials = credStore.get('credentials');
        const base64 = credentials[account];

        if (!base64) return null;

        const encrypted = Buffer.from(base64, 'base64');
        const token = safeStorage.decryptString(encrypted);
        return token;
    } catch (error) {
        log.error('[keychain] Failed to retrieve token:', error);
        return null;
    }
}

export async function deleteToken(account: string): Promise<void> {
    try {
        const credentials = credStore.get('credentials');
        delete credentials[account];
        credStore.set('credentials', credentials);

        log.info(`[keychain] Token deleted for account: ${account}`);
    } catch (error) {
        log.error('[keychain] Failed to delete token:', error);
        throw new Error('Failed to delete credentials');
    }
}
