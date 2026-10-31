// src/main/auth/oauthConfig.ts — Resolve optional Notion OAuth credentials
//
// Official release builds ship WITHOUT OAuth credentials: users connect by pasting their own
// internal integration token, which is encrypted with the OS keychain (see keychain.ts).
//
// OAuth is enabled only when credentials are supplied by whoever builds/runs the app:
//   1. NOTION_OAUTH_CLIENT_ID / NOTION_OAUTH_CLIENT_SECRET environment variables
//      (in development these are read from the project's .env file), or
//   2. dist-main/oauth-credentials.json, written by scripts/write-oauth-config.mjs when those
//      variables are set together with NQC_EMBED_OAUTH=1 at build time. Anything embedded in a
//      binary can be extracted, so only do this for private builds — never for public releases.
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';

export interface OAuthCredentials {
    clientId: string;
    clientSecret: string;
}

let cached: OAuthCredentials | null | undefined;

function loadDevEnv(): void {
    if (app.isPackaged) return;
    try {
        // dotenv is a devDependency, so it only exists in development checkouts
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
    } catch {
        // No dotenv / no .env — fine
    }
}

function fromEnv(): OAuthCredentials | null {
    const clientId = process.env['NOTION_OAUTH_CLIENT_ID']?.trim();
    const clientSecret = process.env['NOTION_OAUTH_CLIENT_SECRET']?.trim();
    return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function fromBuildFile(): OAuthCredentials | null {
    const file = path.resolve(__dirname, '../../oauth-credentials.json');
    try {
        if (!fs.existsSync(file)) return null;
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<OAuthCredentials>;
        if (typeof parsed.clientId === 'string' && typeof parsed.clientSecret === 'string') {
            return { clientId: parsed.clientId, clientSecret: parsed.clientSecret };
        }
    } catch (error) {
        log.warn('[oauth] Ignoring unreadable oauth-credentials.json:', error);
    }
    return null;
}

export function getOAuthCredentials(): OAuthCredentials | null {
    if (cached === undefined) {
        loadDevEnv();
        cached = fromEnv() ?? fromBuildFile();
        log.info(`[oauth] OAuth ${cached ? 'enabled' : 'disabled (token sign-in only)'}`);
    }
    return cached;
}

export function isOAuthAvailable(): boolean {
    return getOAuthCredentials() !== null;
}
