import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
    globalIgnores([
        '**/*.test.js',
        '**/*.spec.js',
        'node_modules/**',
        'dist/**',
        '**/scripts/**',
        '**/dist/**',
        '**/target/**',
    ]),
    {
        files: ['**/*.js', '**/*.jsx'],
        ignores: ['jest.config.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                process: 'readonly',
            },
        },
    },
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
    },
]);
