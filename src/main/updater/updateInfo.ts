// src/main/updater/updateInfo.ts — Pure helpers for the auto-updater (no Electron imports, unit-tested)
import type { UpdateMode } from '../../shared/types';

// Must match `publish` in electron-builder.config.cjs
export const RELEASES_URL = 'https://github.com/somaraj/notion-quick-capture/releases';

export function releaseUrl(version: string): string {
    return `${RELEASES_URL}/tag/v${version}`;
}

export interface UpdateEnvironment {
    platform: NodeJS.Platform;
    isPackaged: boolean;
    /** Set when running as an AppImage (the only Linux format that can replace itself) */
    appImage: boolean;
    macReleasesSigned: boolean;
    /** Development override: exercise the updater against dev-app-update.yml */
    forceDev: boolean;
}

/**
 * Whether this build can update itself:
 * - macOS requires a code-signed app (Squirrel.Mac refuses to install into unsigned apps)
 * - Linux only replaces AppImage builds; .deb users are pointed to the release page
 */
export function resolveUpdateMode(env: UpdateEnvironment): UpdateMode {
    if (!env.isPackaged) return env.forceDev ? 'auto' : 'disabled';
    if (env.platform === 'darwin') return env.macReleasesSigned ? 'auto' : 'notify';
    if (env.platform === 'linux') return env.appImage ? 'auto' : 'notify';
    return 'auto';
}

const ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
};

const MAX_NOTES = 4000;

function htmlToText(html: string): string {
    return html
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\s*li[^>]*>/gi, '\n• ')
        .replace(/<\/\s*(p|div|h[1-6]|ul|ol|pre|blockquote)\s*>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * GitHub release notes arrive as rendered HTML (or a list of notes when skipping versions).
 * Reduce them to plain text so the renderer never has to inject HTML.
 */
export function releaseNotesToText(
    notes: string | Array<{ version: string; note: string | null }> | null | undefined,
): string | undefined {
    if (!notes) return undefined;
    const text = Array.isArray(notes)
        ? notes
              .filter((n) => n.note)
              .map((n) => `v${n.version}\n${htmlToText(n.note!)}`)
              .join('\n\n')
        : htmlToText(notes);

    if (!text) return undefined;
    return text.length > MAX_NOTES ? `${text.slice(0, MAX_NOTES).trimEnd()}…` : text;
}

/** electron-updater errors can include whole HTTP responses; keep one readable line. */
export function conciseError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const firstLine = message.split('\n')[0]?.trim() || 'Update check failed';
    if (/\b404\b/.test(firstLine)) return 'No published release found';
    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ERR_INTERNET_DISCONNECTED|net::/i.test(firstLine)) {
        return 'Could not reach GitHub — check your connection';
    }
    return firstLine.length > 160 ? `${firstLine.slice(0, 160)}…` : firstLine;
}
