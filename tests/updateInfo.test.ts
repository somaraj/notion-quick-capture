import { describe, expect, it } from 'vitest';
import {
    conciseError,
    releaseNotesToText,
    releaseUrl,
    resolveUpdateMode,
    type UpdateEnvironment,
} from '../src/main/updater/updateInfo';

const env = (overrides: Partial<UpdateEnvironment>): UpdateEnvironment => ({
    platform: 'win32',
    isPackaged: true,
    appImage: false,
    macReleasesSigned: false,
    forceDev: false,
    ...overrides,
});

describe('resolveUpdateMode', () => {
    it('installs updates itself on Windows and Linux AppImage', () => {
        expect(resolveUpdateMode(env({}))).toBe('auto');
        expect(resolveUpdateMode(env({ platform: 'linux', appImage: true }))).toBe('auto');
    });

    it('only notifies where it cannot install (unsigned macOS, .deb)', () => {
        expect(resolveUpdateMode(env({ platform: 'darwin' }))).toBe('notify');
        expect(resolveUpdateMode(env({ platform: 'linux' }))).toBe('notify');
        expect(resolveUpdateMode(env({ platform: 'darwin', macReleasesSigned: true }))).toBe(
            'auto',
        );
    });

    it('is off in development unless forced', () => {
        expect(resolveUpdateMode(env({ isPackaged: false }))).toBe('disabled');
        expect(resolveUpdateMode(env({ isPackaged: false, forceDev: true }))).toBe('auto');
    });
});

describe('releaseNotesToText', () => {
    it('turns GitHub release HTML into plain text', () => {
        const html =
            '<h2>What&#39;s Changed</h2><ul><li>Faster <strong>search</strong></li><li>Fix &amp; polish</li></ul><p>Thanks!</p>';
        expect(releaseNotesToText(html)).toBe(
            "What's Changed\n\n• Faster search\n• Fix & polish\n\nThanks!",
        );
    });

    it('drops markup it does not understand, including scripts tags', () => {
        expect(releaseNotesToText('<script>alert(1)</script><p>ok</p>')).toBe('alert(1)ok');
    });

    it('labels notes per version when several releases were skipped', () => {
        const text = releaseNotesToText([
            { version: '1.2.0', note: '<p>B</p>' },
            { version: '1.1.0', note: null },
            { version: '1.0.1', note: '<p>A</p>' },
        ]);
        expect(text).toBe('v1.2.0\nB\n\nv1.0.1\nA');
    });

    it('returns undefined for empty notes and truncates very long ones', () => {
        expect(releaseNotesToText(null)).toBeUndefined();
        expect(releaseNotesToText('<p> </p>')).toBeUndefined();
        expect(releaseNotesToText('x'.repeat(5000))!.length).toBe(4001);
    });
});

describe('conciseError', () => {
    it('keeps one readable line', () => {
        expect(conciseError(new Error('HttpError: 404 \n"method: GET url: ..."'))).toBe(
            'No published release found',
        );
        expect(conciseError(new Error('net::ERR_INTERNET_DISCONNECTED'))).toMatch(/connection/);
        expect(conciseError(new Error('Something odd\nstack'))).toBe('Something odd');
    });
});

describe('releaseUrl', () => {
    it('points at the tagged GitHub release', () => {
        expect(releaseUrl('1.2.3')).toBe(
            'https://github.com/somaraj/notion-quick-capture/releases/tag/v1.2.3',
        );
    });
});
