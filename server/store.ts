import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { difficultySchema, scoreSchema } from '../src/contracts.js';
import type { RankedDifficulty } from '../src/contracts.js';

export const runLifetimeMs = 60 * 60 * 1000;
const storedRunSchema = z.object({
  runId: z.string(), name: z.string(), difficulty: difficultySchema,
  seed: z.string(), startedAt: z.number(),
});

export function createStore(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, difficulty TEXT NOT NULL,
      seed TEXT NOT NULL, started_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scores (
      run_id TEXT PRIMARY KEY, name TEXT NOT NULL, difficulty TEXT NOT NULL,
      score INTEGER NOT NULL, elapsed_ms INTEGER NOT NULL, completed_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS score_rank ON scores(difficulty, score DESC, elapsed_ms, completed_at);
  `);

  function start(name: string, difficulty: RankedDifficulty) {
    const startedAt = Date.now();
    db.prepare('DELETE FROM runs WHERE started_at < ?').run(startedAt - runLifetimeMs);
    const count = z.object({ count: z.number() }).parse(db.prepare('SELECT COUNT(*) AS count FROM runs').get());
    if (count.count >= 1000) return null;
    const runId = randomUUID();
    const seed = randomBytes(16).toString('hex');
    db.prepare('INSERT INTO runs VALUES (?, ?, ?, ?, ?)').run(runId, name, difficulty, seed, startedAt);
    return { runId, seed, startedAt };
  }

  function run(runId: string) {
    const row = db.prepare('SELECT id AS runId, name, difficulty, seed, started_at AS startedAt FROM runs WHERE id = ?').get(runId);
    return row ? storedRunSchema.parse(row) : null;
  }

  function saved(runId: string) {
    const row = db.prepare('SELECT name, score, elapsed_ms AS elapsedMs, completed_at AS completedAt FROM scores WHERE run_id = ?').get(runId);
    return row ? scoreSchema.parse(row) : null;
  }

  function finish(runId: string, score: number, elapsedMs: number) {
    const current = run(runId);
    if (!current) throw new Error('Run no longer exists');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO scores VALUES (?, ?, ?, ?, ?, ?)')
        .run(runId, current.name, current.difficulty, score, elapsedMs, Date.now());
      db.prepare('DELETE FROM runs WHERE id = ?').run(runId);
      db.prepare(`DELETE FROM scores WHERE difficulty = ? AND run_id NOT IN (
        SELECT run_id FROM scores WHERE difficulty = ? ORDER BY score DESC, elapsed_ms, completed_at LIMIT 100
      )`).run(current.difficulty, current.difficulty);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function leaderboard(difficulty: RankedDifficulty) {
    return z.array(scoreSchema).parse(db.prepare(`
      SELECT name, score, elapsed_ms AS elapsedMs, completed_at AS completedAt
      FROM scores WHERE difficulty = ? ORDER BY score DESC, elapsed_ms, completed_at LIMIT 10
    `).all(difficulty));
  }

  return { start, run, saved, finish, leaderboard, close: () => db.close() };
}

export type ScoreStore = ReturnType<typeof createStore>;
