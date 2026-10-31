// vitest.config.ts — Unit tests for pure (Electron-free) modules
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
    },
});
