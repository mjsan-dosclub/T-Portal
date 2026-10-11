#!/usr/bin/env node
// Local Postgres for dev + tests (DECISIONS ENV-1). Keeps running until Ctrl+C.
// Creates databases dos_dev and dos_test on 127.0.0.1:54329. Data lives in ./.pgdata (git-ignored).
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

const DIR = './.pgdata';
const pg = new EmbeddedPostgres({
  databaseDir: DIR,
  port: 54329,
  user: 'dos',
  password: 'dos-local-only',
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
});

if (!existsSync(`${DIR}/PG_VERSION`)) await pg.initialise();
await pg.start();
for (const name of ['dos_dev', 'dos_test']) {
  try { await pg.createDatabase(name); } catch { /* already exists */ }
}
console.log('Postgres ready on 127.0.0.1:54329 (dos_dev, dos_test). Ctrl+C to stop.');

const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
