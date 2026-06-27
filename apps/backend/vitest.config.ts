import path from 'path';
import { defineConfig } from 'vitest/config';

// All suites share a single, freshly-migrated SQLite file. Tenants are created
// per-test (unique emails) so data is naturally isolated by `tenant_id`.
const TEST_DB = path.resolve(__dirname, 'data/test.sqlite');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    // A single SQLite file is shared across suites — force one worker and run
    // files serially so there is exactly one writer at a time.
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    sequence: { concurrent: false },
    hookTimeout: 30000,
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      SQLITE_PATH: TEST_DB,
      JWT_SECRET: 'test_secret',
      // Point the AI client at an unreachable host so any AI call fails fast
      // into its fallback path rather than hanging the test run.
      AI_SERVICE_URL: 'http://127.0.0.1:59999',
      AI_TIMEOUT: '500',
    },
  },
});
