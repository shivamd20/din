import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        testTimeout: 120000, // 2 minutes for integration tests
        hookTimeout: 120000,
        teardownTimeout: 30000,
        include: ['tests/**/*.test.ts'],
        exclude: ['node_modules', 'dist', '**/*.spec.ts'],
        globalSetup: ['tests/setup.ts'],
        pool: 'threads',
        poolOptions: {
            threads: {
                singleThread: true, // Run tests sequentially to avoid port conflicts
            },
        },
    },
});

