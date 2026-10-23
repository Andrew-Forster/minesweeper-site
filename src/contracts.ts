import { z } from 'zod';
import { rewardNames, standardDifficulties } from './board.js';

z.config({ jitless: true });

export const difficultySchema = z.enum(standardDifficulties);
export const nameSchema = z.string().trim().min(1).max(20)
  .regex(/^[\p{L}\p{N} _.-]+$/u, 'Use 1–20 letters, numbers, spaces, dots, dashes, or underscores.');
export const startSchema = z.object({ name: nameSchema, difficulty: difficultySchema }).strict();
const coordinates = { row: z.int().min(0).max(23), col: z.int().min(0).max(23) };
export const moveSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('reveal'), ...coordinates }).strict(),
  z.object({ type: z.literal('flag'), ...coordinates }).strict(),
  z.object({ type: z.literal('reward'), reward: z.enum(rewardNames), ...coordinates }).strict(),
]);
export const finishSchema = z.object({
  runId: z.uuid(), moves: z.array(moveSchema).min(1).max(2000),
}).strict();
export const runSchema = z.object({ runId: z.uuid(), seed: z.string(), startedAt: z.number() });
export const scoreSchema = z.object({
  name: z.string(), score: z.number(), elapsedMs: z.number(), completedAt: z.number(),
});
export const leaderboardSchema = z.object({ entries: z.array(scoreSchema) });
export const finishResponseSchema = z.object({ score: z.number(), elapsedMs: z.number() });
export type RankedDifficulty = z.infer<typeof difficultySchema>;
export type Move = z.infer<typeof moveSchema>;
export type RankedRun = z.infer<typeof runSchema>;
