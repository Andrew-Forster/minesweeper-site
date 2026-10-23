import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import seedrandom from 'seedrandom';
import { Board, presets } from '../src/board.js';
import { difficultySchema, finishSchema, startSchema } from '../src/contracts.js';
import { runLifetimeMs } from './store.js';
import type { ScoreStore } from './store.js';

export async function createApp(store: ScoreStore, publicOrigin: string) {
  const app = Fastify({ bodyLimit: 128 * 1024, trustProxy: (_address, hop) => hop === 0, requestTimeout: 10_000 });
  await app.register(rateLimit, { max: 60, timeWindow: '1 minute', cache: 5000 });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    if (request.method === 'POST' && request.headers.origin !== publicOrigin) {
      return reply.code(403).send({ error: 'Use the game website to submit results.' });
    }
  });
  app.get('/healthz', { config: { rateLimit: false } }, async () => ({ ok: true }));

  app.get('/api/leaderboard', async (request, reply) => {
    const query = request.query;
    const difficulty = difficultySchema.safeParse(
      typeof query === 'object' && query !== null && 'difficulty' in query ? query.difficulty : undefined);
    if (!difficulty.success) return reply.code(400).send({ error: 'Choose a standard difficulty.' });
    return { entries: store.leaderboard(difficulty.data) };
  });

  app.post('/api/runs', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const input = startSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: 'Choose a standard difficulty and a name of 1–20 letters or numbers.' });
    const run = store.start(input.data.name, input.data.difficulty);
    if (!run) return reply.code(503).send({ error: 'The leaderboard is busy. You can still play.' });
    return reply.code(201).send(run);
  });

  app.post('/api/results', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const input = finishSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: 'Invalid game result.' });
    const previous = store.saved(input.data.runId);
    if (previous) return { score: previous.score, elapsedMs: previous.elapsedMs };
    const run = store.run(input.data.runId);
    if (!run) return reply.code(404).send({ error: 'Game not found or already expired.' });
    const elapsedMs = Date.now() - run.startedAt;
    if (elapsedMs < 0 || elapsedMs > runLifetimeMs) return reply.code(410).send({ error: 'This game has expired.' });
    const settings = presets[run.difficulty];
    const board = new Board(settings.size, settings.mines, seedrandom(run.seed));
    for (const move of input.data.moves) {
      if (board.finished || !board.cell(move.row, move.col)) return reply.code(400).send({ error: 'Invalid move history.' });
      if (move.type === 'reveal') board.reveal(move.row, move.col);
      else if (move.type === 'flag') board.flag(move.row, move.col);
      else board.useReward(move.reward, move.row, move.col);
    }
    if (board.status !== 'won') return reply.code(400).send({ error: 'Only completed wins can enter the leaderboard.' });
    const score = board.baseScore - Math.floor(elapsedMs / 1000) * 10;
    store.finish(run.runId, score, elapsedMs);
    return reply.code(201).send({ score, elapsedMs });
  });

  app.setErrorHandler((error, _request, reply) => {
    const status = error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    reply.code(status).send({ error: status >= 500 ? 'The leaderboard is temporarily unavailable.' : 'Invalid request.' });
  });
  app.addHook('onClose', async () => store.close());
  return app;
}
