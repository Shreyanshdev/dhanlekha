import path from 'path';
import fs from 'fs';

/**
 * Vitest global setup — runs once before any test file.
 *
 * Builds a pristine SQLite database at `data/test.sqlite`, runs all migrations
 * and the SaaS plan/feature seed against it (in-process, via the Vitest module
 * loader). Foreign-key enforcement is disabled for the bootstrap: a couple of
 * early migrations pre-populate `plan_features` before the parent `plans` /
 * `feature_flags` rows are inserted by the seed — the same effective behaviour
 * as the incrementally migrated dev database.
 *
 * The application's `db` singleton later opens the same file via the
 * SQLITE_PATH env set in vitest.config.ts, so tests and assertions share it.
 */
export default async function setup() {
  const TEST_DB = path.resolve(__dirname, '../data/test.sqlite');

  process.env.NODE_ENV = 'test';
  process.env.SQLITE_PATH = TEST_DB;

  for (const f of [TEST_DB, `${TEST_DB}-journal`, `${TEST_DB}-wal`, `${TEST_DB}-shm`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  const knex = (await import('knex')).default;
  const config = (await import('../src/config/knexfile')).default;
  const db = knex(config.development);

  try {
    await db.raw('PRAGMA foreign_keys = OFF');
    await db.migrate.latest();
    await db.seed.run();
  } finally {
    await db.destroy();
  }
}
