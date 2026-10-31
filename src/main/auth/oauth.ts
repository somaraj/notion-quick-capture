// src/main/auth/oauth.ts — Notion OAuth 2.0 PKCE flow
import { shell } from 'electron';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { URL, URLSearchParams } from 'url';
import crypto from 'crypto';
import log from 'electron-log';
import { saveToken } from './keychain';
import { getOAuthCredentials } from './oauthConfig';

const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

const OAUTH_CALLBACK_PORT = 21549;

interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

interface TokenResponse {
    access_token: string;
    token_type: string;
    bot_id: string;
    workspace_id: string;
    workspace_name: string;
    workspace_icon: string | null;
    owner: {
        type: string;
        user: {
            id: string;
            name: string;
            avatar_url: string | null;
        };
    };
}

function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateState(): string {
    return crypto.randomBytes(16).toString('hex');
}

function getOAuthConfig(): OAuthConfig {
    const credentials = getOAuthCredentials();
    if (!credentials) {
        throw new Error(
            'OAuth is not enabled in this build. Paste an internal integration token instead ' +
                '(see the README for setup steps).',
        );
    }

    // Fixed redirect URI — must match what is configured in the Notion integration settings
    const redirectUri = `http://localhost:${OAUTH_CALLBACK_PORT}/callback`;

    return { ...credentials, redirectUri };
}

async function exchangeCodeForToken(
    code: string,
    codeVerifier: string,
    config: OAuthConfig,
    redirectUri: string,
): Promise<TokenResponse> {
    // Notion requires Basic auth (client_id:client_secret) for token exchange
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
    });

    const response = await fetch(NOTION_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${credentials}`,
        },
        body: body.toString(),
    });

    if (!response.ok) {
        const errorText = await response.text();
        log.error('[oauth] Token exchange failed:', errorText);
        throw new Error(`OAuth token exchange failed: ${response.status}`);
    }

    const tokenData = (await response.json()) as TokenResponse;
    return tokenData;
}

export interface OAuthWorkspace {
    workspaceId: string;
    workspaceName: string;
}

export async function startOAuthFlow(): Promise<OAuthWorkspace | null> {
    const config = getOAuthConfig();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    return new Promise<OAuthWorkspace | null>((resolve) => {
        let server: Server | null = null;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const cleanup = (): void => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (server) {
                server.close();
                server = null;
            }
        };

        server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
            try {
                const reqUrl = new URL(req.url ?? '/', `http://localhost`);
                if (reqUrl.pathname !== '/callback') {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                const receivedCode = reqUrl.searchParams.get('code');
                const receivedState = reqUrl.searchParams.get('state');
                const error = reqUrl.searchParams.get('error');

                if (error) {
                    log.error('[oauth] Auth error from Notion:', error);
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(
                        '<html><body><h1>Authentication Failed</h1><p>You can close this window.</p></body></html>',
                    );
                    cleanup();
                    resolve(null);
                    return;
                }

                if (!receivedCode || receivedState !== state) {
                    log.warn('[oauth] Invalid callback — missing code or state mismatch');
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    res.end('<html><body><h1>Invalid Request</h1></body></html>');
                    return;
                }

                const redirectUri = config.redirectUri;

                const tokenData = await exchangeCodeForToken(
                    receivedCode,
                    codeVerifier,
                    config,
                    redirectUri,
                );

                await saveToken(tokenData.workspace_id, tokenData.access_token);

                log.info(
                    `[oauth] Successfully authenticated workspace: ${tokenData.workspace_name}`,
                );

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(
                    '<html><body><h1>Authentication Successful!</h1><p>You can close this window and return to the app.</p></body></html>',
                );

                cleanup();
                resolve({
                    workspaceId: tokenData.workspace_id,
                    workspaceName: tokenData.workspace_name || 'Notion Workspace',
                });
            } catch (err) {
                log.error('[oauth] Error during callback processing:', err);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<html><body><h1>Error</h1><p>Something went wrong.</p></body></html>');
                cleanup();
                resolve(null);
            }
        });

        server.listen(OAUTH_CALLBACK_PORT, 'localhost', () => {
            const redirectUri = config.redirectUri;

            const authUrl = new URL(NOTION_AUTH_URL);
            authUrl.searchParams.set('client_id', config.clientId);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('owner', 'user');
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('state', state);
            authUrl.searchParams.set('code_challenge', codeChallenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');

            log.info('[oauth] Opening auth URL in system browser');
            shell.openExternal(authUrl.toString());

            // 5-minute timeout for auth flow
            timeoutId = setTimeout(
                () => {
                    log.warn('[oauth] Auth flow timed out');
                    cleanup();
                    resolve(null);
                },
                5 * 60 * 1000,
            );
        });

        server.on('error', (err) => {
            log.error('[oauth] Server error:', err);
            cleanup();
            resolve(null);
        });
    });
}
