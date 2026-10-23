import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from './app.js';
import { createStore } from './store.js';

const databasePath = process.env.DATABASE_PATH ?? '/data/leaderboard.sqlite';
const origin = process.env.PUBLIC_ORIGIN ?? 'https://minesweeper.andrewjf.com';
mkdirSync(dirname(databasePath), { recursive: true });
const app = await createApp(createStore(databasePath), origin);
await app.listen({ host: '0.0.0.0', port: 3000 });
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => { void app.close(); });
}
