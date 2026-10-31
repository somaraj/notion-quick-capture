// electron-builder.config.cjs — Packaging configuration
// Docs: https://www.electron.build/configuration

/** @type {import('electron-builder').Configuration} */
const config = {
    appId: 'io.github.somaraj.notion-quick-capture',
    productName: 'Notion Quick Capture',
    copyright: 'Copyright © 2026 Somaraj',
    asar: true,
    directories: {
        buildResources: 'build',
        output: 'dist-electron',
    },
    files: [
        'dist/**',
        'dist-main/**',
        'dist-preload/**',
        '!**/*.map',
        'package.json',
    ],
    // Icons loaded at runtime (tray + window icons) — see src/main/paths.ts
    extraResources: [
        { from: 'build/icon.png', to: 'build/icon.png' },
        { from: 'build', to: 'build', filter: ['tray-icon*.png'] },
    ],
    // No spaces: GitHub renames assets containing spaces, which breaks latest.yml for auto-update
    artifactName: '${name}-${version}-${os}-${arch}.${ext}',
    mac: {
        category: 'public.app-category.productivity',
        icon: 'build/icon.png',
        hardenedRuntime: true,
        gatekeeperAssess: false,
        entitlements: 'build/entitlements.mac.plist',
        entitlementsInherit: 'build/entitlements.mac.plist',
        // Background (tray) app: no Dock icon
        extendInfo: {
            LSUIElement: true,
        },
        target: [
            { target: 'dmg', arch: ['x64', 'arm64'] },
            { target: 'zip', arch: ['x64', 'arm64'] },
        ],
    },
    dmg: {
        artifactName: '${name}-${version}-mac-${arch}.${ext}',
    },
    win: {
        icon: 'build/icon.png',
        // x64 only: Windows on ARM runs it under emulation, and one installer keeps auto-update simple
        target: [{ target: 'nsis', arch: ['x64'] }],
    },
    nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: false,
        createStartMenuShortcut: true,
        deleteAppDataOnUninstall: false,
        artifactName: '${name}-setup-${version}.${ext}',
    },
    linux: {
        icon: 'build/icon.png',
        category: 'Utility',
        synopsis: 'Capture notes to Notion from anywhere with a global shortcut',
        target: [
            { target: 'AppImage', arch: ['x64'] },
            { target: 'deb', arch: ['x64'] },
        ],
        maintainer: 'Somaraj',
    },
    deb: {
        // Needed for safeStorage to encrypt tokens with the desktop keyring
        depends: ['libsecret-1-0'],
    },
    publish: {
        provider: 'github',
        owner: 'somaraj',
        repo: 'notion-quick-capture',
        releaseType: 'draft',
    },
};

module.exports = config;
