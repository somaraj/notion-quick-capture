// vite.config.ts — Renderer bundler with multi-entry for code splitting
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
    version: string;
};

// Content-Security-Policy injected as a <meta> tag. Packaged builds load pages over file://,
// where response headers can't be set, so the policy has to live in the HTML itself.
// The renderer never talks to the network directly — all Notion calls go through the main process.
function cspPlugin(): Plugin {
    let isDev = false;
    return {
        name: 'inject-csp',
        configResolved(config) {
            isDev = config.command === 'serve';
        },
        transformIndexHtml() {
            const policy = [
                "default-src 'self'",
                isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "font-src 'self' data:",
                isDev
                    ? "connect-src 'self' ws://localhost:5173 http://localhost:5173"
                    : "connect-src 'self'",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'none'",
            ].join('; ');
            return [
                {
                    tag: 'meta',
                    attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
                    injectTo: 'head-prepend',
                },
            ];
        },
    };
}

export default defineConfig({
    plugins: [
        vue(),
        cspPlugin(),
        // Multi-page support: serve settings.html before SPA fallback rewrites it to index.html
        {
            name: 'mpa-settings',
            configureServer(server) {
                server.middlewares.use((req, _res, next) => {
                    if (req.url === '/settings.html' || req.url?.startsWith('/settings.html?')) {
                        req.url = '/settings.html';
                    }
                    if (req.url === '/about.html' || req.url?.startsWith('/about.html?')) {
                        req.url = '/about.html';
                    }
                    next();
                });
            },
        },
    ],
    define: {
        __APP_VERSION__: JSON.stringify(version),
    },
    root: 'src/renderer',
    base: './',
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                capture: path.resolve(__dirname, 'src/renderer/index.html'),
                settings: path.resolve(__dirname, 'src/renderer/settings.html'),
                about: path.resolve(__dirname, 'src/renderer/about.html'),
            },
        },
        target: 'chrome120',
        minify: 'esbuild',
        // The capture panel bundles the Milkdown editor (~600 KB). It loads from disk into a
        // pre-warmed window, so the default 500 KB web warning does not apply here.
        chunkSizeWarningLimit: 800,
        sourcemap: false,
    },
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, 'src/shared'),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    },
});
