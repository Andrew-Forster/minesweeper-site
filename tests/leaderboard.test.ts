import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import seedrandom from 'seedrandom';
import { createApp } from '../server/app';
import { createStore, runLifetimeMs } from '../server/store';
import { Board, presets } from '../src/board';
import { runSchema } from '../src/contracts';
import type { Move } from '../src/contracts';

const origin = 'https://minesweeper.andrewjf.com';
let app: Awaited<ReturnType<typeof createApp>>;

beforeEach(async () => { app = await createApp(createStore(':memory:'), origin); });
afterEach(async () => { await app.close(); vi.restoreAllMocks(); });

async function start(name = 'Andrew') {
  const response = await app.inject({ method: 'POST', url: '/api/runs', headers: { origin }, payload: { name, difficulty: 'Easy' } });
  expect(response.statusCode).toBe(201);
  return runSchema.parse(response.json());
}

function winningHistory(seed: string) {
  const board = new Board(presets.Easy.size, presets.Easy.mines, seedrandom(seed));
  const moves: Move[] = [{ type: 'reveal', row: 0, col: 0 }];
  board.reveal(0, 0);
  for (const cell of board.cells) {
    if (!cell.mine && !cell.revealed && !board.finished) {
      board.reveal(cell.row, cell.col);
      moves.push({ type: 'reveal', row: cell.row, col: cell.col });
    }
  }
  expect(board.status).toBe('won');
  return { moves, baseScore: board.baseScore };
}

describe('anonymous leaderboard', () => {
  it('verifies a winning history and computes the score using server time', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const run = await start(' Andrew ');
    const history = winningHistory(run.seed);
    clock.mockReturnValue(now + 12_000);
    const result = await app.inject({ method: 'POST', url: '/api/results', headers: { origin }, payload: { runId: run.runId, moves: history.moves } });
    expect(result.statusCode).toBe(201);
    expect(result.json()).toEqual({ score: history.baseScore - 120, elapsedMs: 12_000 });
    const listing = await app.inject('/api/leaderboard?difficulty=Easy');
    expect(listing.json().entries).toEqual([{ name: 'Andrew', score: history.baseScore - 120, elapsedMs: 12_000, completedAt: now + 12_000 }]);
    expect(listing.headers['cache-control']).toBe('no-store');
  });

  it('records a retried submission only once', async () => {
    const run = await start();
    const { moves } = winningHistory(run.seed);
    const submit = () => app.inject({ method: 'POST', url: '/api/results', headers: { origin }, payload: { runId: run.runId, moves } });
    const [first, second] = await Promise.all([submit(), submit()]);
    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 201]);
    expect((await app.inject('/api/leaderboard?difficulty=Easy')).json().entries).toHaveLength(1);
  });

  it('rejects incomplete games and user-supplied score fields', async () => {
    const run = await start();
    const moves: Move[] = [{ type: 'flag', row: 0, col: 0 }];
    for (const payload of [{ runId: run.runId, moves }, { runId: run.runId, moves, score: 1 }]) {
      expect((await app.inject({ method: 'POST', url: '/api/results', headers: { origin }, payload })).statusCode).toBe(400);
    }
    expect((await app.inject('/api/leaderboard?difficulty=Easy')).json().entries).toHaveLength(0);
  });

  it('rejects an expired game', async () => {
    const run = await start();
    vi.spyOn(Date, 'now').mockReturnValue(run.startedAt + runLifetimeMs + 1);
    const { moves } = winningHistory(run.seed);
    expect((await app.inject({ method: 'POST', url: '/api/results', headers: { origin }, payload: { runId: run.runId, moves } })).statusCode).toBe(410);
  });

  it('validates names, difficulty, and origin without creating accounts', async () => {
    for (const name of ['', 'a'.repeat(21), 'bad/name']) {
      expect((await app.inject({ method: 'POST', url: '/api/runs', headers: { origin }, payload: { name, difficulty: 'Easy' } })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'POST', url: '/api/runs', headers: { origin }, payload: { name: 'Andrew', difficulty: 'Custom' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/runs', headers: { origin: 'https://example.org' }, payload: { name: 'Andrew', difficulty: 'Easy' } })).statusCode).toBe(403);
    const run = await start('Zoë');
    expect(run.seed).toHaveLength(32);
  });

  it('limits new games per visitor and returns a retry delay', async () => {
    for (let index = 0; index < 10; index++) await start();
    const response = await app.inject({ method: 'POST', url: '/api/runs', headers: { origin }, payload: { name: 'Andrew', difficulty: 'Easy' } });
    expect(response.statusCode).toBe(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('persists scores across restarts and retains only the best 100 per difficulty', () => {
    const directory = mkdtempSync(join(tmpdir(), 'minesweeper-score-test-'));
    try {
      const path = join(directory, 'scores.sqlite');
      let store = createStore(path);
      for (let score = 0; score < 105; score++) {
        const run = store.start(`Player ${score}`, 'Easy')!;
        store.finish(run.runId, score, 1000);
      }
      store.close();
      store = createStore(path);
      expect(store.leaderboard('Easy')).toHaveLength(10);
      expect(store.leaderboard('Easy')[0]?.score).toBe(104);
      expect(store.leaderboard('Hard')).toHaveLength(0);
      store.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
