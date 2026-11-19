import { TursoDatabase } from './turso-client.ts';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl) {
    console.log('[Migration] Target: Turso Database (' + tursoUrl.split('@').pop() + ')');
    const turso = new TursoDatabase({ url: tursoUrl, authToken: tursoToken });
    const ping = await turso.ping();
    if (!ping.ok) {
      console.error('[Migration] Failed to connect to Turso:', ping.error);
      process.exit(1);
    }
    console.log(`[Migration] Connected to Turso (latency: ${ping.latencyMs}ms)`);
    const result = await turso.runMigrations();
    console.log(`[Migration] Completed: ${result.applied} migration(s) applied.`);
  } else {
    console.log('[Migration] Target: Local SQLite Database');
    const defaultPath = join(__dirname, '../../../../data/abiruchi.db');
    const resolvedPath = process.env.DATABASE_FILE || defaultPath;
    const dir = dirname(resolvedPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const db = new DatabaseSync(resolvedPath);
    console.log(`[Migration] Connected to local SQLite: ${resolvedPath}`);
    // Local SQLite is initialized via store.initTables
    console.log('[Migration] Local SQLite database verified.');
  }
}

run().catch((err) => {
  console.error('[Migration] Fatal error:', err);
  process.exit(1);
});
