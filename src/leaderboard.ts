import { finishResponseSchema, leaderboardSchema, runSchema } from './contracts';
import type { Move, RankedDifficulty, RankedRun } from './contracts';
import type { Difficulty } from './board';
import { element } from './dom';

let latestRequest = 0;

async function request(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
    credentials: 'omit',
  });
  if (!response.ok) throw new Error(response.status === 429
    ? 'Too many requests. Try again in a minute.' : 'The leaderboard is unavailable.');
  return response.json();
}

export async function loadLeaderboard(difficulty: Difficulty) {
  const requestId = ++latestRequest;
  const body = element('#leaderboardRows', HTMLTableSectionElement);
  const status = element('#leaderboardStatus', HTMLElement);
  element('#leaderboardDifficulty', HTMLElement).textContent = difficulty;
  element('#leaderboard table', HTMLTableElement).hidden = difficulty === 'Custom';
  element('.leaderboard-note', HTMLElement).hidden = difficulty === 'Custom';
  body.replaceChildren();
  if (difficulty === 'Custom') {
    status.textContent = 'Custom boards are not ranked.';
    return;
  }
  status.textContent = 'Loading scores…';
  try {
    const data = leaderboardSchema.parse(await request(`/api/leaderboard?difficulty=${difficulty}`));
    if (requestId !== latestRequest) return;
    status.textContent = data.entries.length ? '' : 'No scores yet. Be the first.';
    for (const [index, score] of data.entries.entries()) {
      const row = document.createElement('tr');
      for (const value of [index + 1, score.name, score.score]) {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        row.append(cell);
      }
      body.append(row);
    }
  } catch {
    if (requestId === latestRequest) status.textContent = 'Scores are unavailable. You can still play.';
  }
}

export async function startRankedRun(name: string, difficulty: RankedDifficulty) {
  return runSchema.parse(await request('/api/runs', { name, difficulty }));
}

export async function saveRankedResult(run: RankedRun, moves: Move[]) {
  return finishResponseSchema.parse(await request('/api/results', { runId: run.runId, moves }));
}
