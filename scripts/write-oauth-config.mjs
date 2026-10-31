// scripts/write-oauth-config.mjs — Optionally embed Notion OAuth credentials into a build.
//
// Runs after the main-process compile. If NOTION_OAUTH_CLIENT_ID and NOTION_OAUTH_CLIENT_SECRET
// are set in the environment, writes dist-main/oauth-credentials.json so the packaged app offers
// "Sign in with Notion". Otherwise makes sure no credentials file exists (token sign-in only).
//
// WARNING: anything bundled into an app can be extracted by its users. Only embed credentials in
// private/internal builds. Public release builds (CI) never set these variables.
import fs from 'node:fs';
import path from 'node:path';

const outFile = path.resolve('dist-main', 'oauth-credentials.json');
const clientId = process.env.NOTION_OAUTH_CLIENT_ID?.trim();
const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET?.trim();

if (process.env.NQC_EMBED_OAUTH === '1' && clientId && clientSecret) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({ clientId, clientSecret }), { mode: 0o600 });
    console.warn('[oauth] Embedded OAuth credentials into this build — do not distribute it publicly.');
} else {
    fs.rmSync(outFile, { force: true });
}
