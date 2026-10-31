// src/renderer/lib/theme.ts — One theme implementation for every window (capture, settings, about)
//
// Applies the configured theme, follows the OS live when the theme is "system", and reacts to
// changes made in the settings window — so no window ever needs a restart to update.

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme = 'light';

export function applyTheme(theme: string): void {
    currentTheme = theme;
    const dark = theme === 'dark' || (theme === 'system' && darkQuery.matches);
    if (dark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

function applyFontSize(size: number): void {
    document.documentElement.style.setProperty('--body-font-size', `${size}px`);
}

// The OS switched between light and dark while the app is running
darkQuery.addEventListener('change', () => {
    if (currentTheme === 'system') applyTheme('system');
});

/** Apply the saved theme and font size now, and keep them in sync with later changes. */
export async function initAppearance(): Promise<void> {
    window.notionBridge.on.configChanged((key, value) => {
        if (key === 'theme') applyTheme(value as string);
        if (key === 'bodyFontSize') applyFontSize(value as number);
    });
    try {
        applyTheme(await window.notionBridge.config.get('theme'));
        applyFontSize(await window.notionBridge.config.get('bodyFontSize'));
    } catch {
        // Defaults from globals.css still apply
    }
}
