// eslint.config.mjs — ESLint flat config (TypeScript + Vue 3)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default tseslint.config(
    {
        ignores: ['dist/**', 'dist-main/**', 'dist-preload/**', 'dist-electron/**', 'node_modules/**'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    {
        files: ['**/*.vue'],
        languageOptions: {
            parserOptions: { parser: tseslint.parser },
        },
    },
    {
        // TypeScript already reports undefined names (and understands declare'd globals)
        files: ['**/*.ts', '**/*.vue'],
        rules: { 'no-undef': 'off' },
    },
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.node },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/ban-ts-comment': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
            ],
            'vue/multi-word-component-names': 'off',
            // Formatting is Prettier's job
            'vue/max-attributes-per-line': 'off',
            'vue/singleline-html-element-content-newline': 'off',
            'vue/html-self-closing': 'off',
            'vue/html-indent': 'off',
            'vue/html-closing-bracket-newline': 'off',
            'vue/multiline-html-element-content-newline': 'off',
            'vue/attributes-order': 'off',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
        },
    },
    {
        files: ['scripts/**/*.mjs', '*.config.*'],
        rules: { 'no-console': 'off' },
    },
    {
        // CommonJS files run directly by Node/Electron (UI smoke tests)
        files: ['**/*.cjs'],
        languageOptions: { sourceType: 'commonjs' },
        rules: { '@typescript-eslint/no-require-imports': 'off', 'no-console': 'off' },
    },
);
