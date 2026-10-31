// src/main/paths.ts — Resolve bundled file locations in dev and packaged builds
import { app } from 'electron';
import path from 'path';

// Compiled files live in dist-main/main/**, so the app root is two levels above this file
const APP_ROOT = path.join(__dirname, '../..');

/** Images in build/ (icons). Packaged builds copy them to <resources>/build via extraResources. */
export function getAssetPath(fileName: string): string {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'build', fileName)
        : path.join(APP_ROOT, 'build', fileName);
}

export const PRELOAD_PATH = path.join(APP_ROOT, 'dist-preload/preload/index.js');
export const RENDERER_DIST = path.join(APP_ROOT, 'dist');
