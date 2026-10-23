import { backup, DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const source = process.env.DATABASE_PATH ?? '/data/leaderboard.sqlite';
const destination = process.argv[2] ?? '/data/leaderboard-backup.sqlite';
if (resolve(source) === resolve(destination)) throw new Error('Backup must use a different path from the live database.');
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  console.log(`Backup written to ${destination}`);
} finally {
  db.close();
}
