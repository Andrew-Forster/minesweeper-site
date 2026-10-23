export const presets = {
  Easy: { size: 9, mines: 10 },
  Medium: { size: 16, mines: 40 },
  Hard: { size: 24, mines: 99 },
} as const;

export type Difficulty = keyof typeof presets | 'Custom';
export const rewardNames = ['Detector', 'Scavenge', 'Sweep'] as const;
export const standardDifficulties = ['Easy', 'Medium', 'Hard'] as const;
export type Reward = typeof rewardNames[number];
export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';
export type Cell = {
  row: number;
  col: number;
  mine: boolean;
  flagged: boolean;
  revealed: boolean;
  adjacent: number;
  reward: Reward | null;
  collected: boolean;
};

export function validSettings(size: number, mines: number) {
  return Number.isInteger(size) && size >= 5 && size <= 24
    && Number.isInteger(mines) && mines >= 5 && mines <= Math.floor(size * size / 4);
}

function shuffled<T>(items: readonly T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    const current = result[index]!;
    result[index] = result[other]!;
    result[other] = current;
  }
  return result;
}

export class Board {
  readonly cells: Cell[];
  readonly inventory: Reward[] = [];
  status: GameStatus = 'ready';
  startedAt: number | null = null;
  endedAt: number | null = null;
  private points = 0;

  constructor(readonly size: number, readonly mines: number, private readonly random = Math.random) {
    if (!validSettings(size, mines)) throw new RangeError('Invalid board size or mine count.');
    this.cells = Array.from({ length: size * size }, (_, index) => ({
      row: Math.floor(index / size), col: index % size,
      mine: false, flagged: false, revealed: false, adjacent: 0,
      reward: null, collected: false,
    }));
  }

  get finished() { return this.status === 'won' || this.status === 'lost'; }

  get elapsedSeconds() {
    return this.startedAt === null ? 0
      : Math.max(0, Math.floor(((this.endedAt ?? Date.now()) - this.startedAt) / 1000));
  }

  get score() { return this.points - (this.finished ? this.elapsedSeconds * 10 : 0); }
  get baseScore() { return this.points; }

  cell(row: number, col: number) {
    if (!Number.isInteger(row) || !Number.isInteger(col)
      || row < 0 || row >= this.size || col < 0 || col >= this.size) return undefined;
    return this.cells[row * this.size + col];
  }

  private neighbors(cell: Cell) {
    const result: Cell[] = [];
    for (let row = cell.row - 1; row <= cell.row + 1; row++) {
      for (let col = cell.col - 1; col <= cell.col + 1; col++) {
        const neighbor = this.cell(row, col);
        if (neighbor && neighbor !== cell) result.push(neighbor);
      }
    }
    return result;
  }

  // Place mines after the first reveal so its surrounding area is always safe.
  private start(first: Cell) {
    const radius = this.size < 10 ? 1 : 2;
    const candidates = this.cells.filter(cell =>
      Math.abs(cell.row - first.row) > radius || Math.abs(cell.col - first.col) > radius);
    for (const cell of shuffled(candidates, this.random).slice(0, this.mines)) cell.mine = true;
    for (const cell of this.cells) {
      cell.adjacent = this.neighbors(cell).filter(neighbor => neighbor.mine).length;
    }
    const empty = this.cells.filter(cell => !cell.mine && cell.adjacent === 0);
    const rewards: Reward[] = ['Detector', 'Detector', 'Scavenge', 'Scavenge', 'Sweep'];
    for (const cell of shuffled(empty, this.random).slice(0, Math.floor(this.mines / this.size) + 2)) {
      cell.reward = rewards[Math.floor(this.random() * rewards.length)]!;
    }
    this.startedAt = Date.now();
    this.status = 'playing';
  }

  // A bounded queue avoids recursive stack growth and leaves flags untouched.
  private flood(first: Cell) {
    const pending = [first];
    while (pending.length) {
      const cell = pending.pop()!;
      if (cell.mine || cell.flagged || cell.revealed) continue;
      cell.revealed = true;
      this.points += cell.adjacent * 100;
      if (cell.adjacent === 0) pending.push(...this.neighbors(cell));
    }
  }

  reveal(row: number, col: number) {
    const cell = this.cell(row, col);
    if (!cell || cell.flagged || this.finished) return false;
    if (this.status === 'ready') this.start(cell);
    if (cell.reward && !cell.collected) {
      this.inventory.push(cell.reward);
      cell.collected = true;
    } else if (cell.revealed) return false;

    if (cell.mine) {
      cell.revealed = true;
      this.finish('lost');
    } else {
      this.flood(cell);
      this.checkWin();
    }
    return true;
  }

  flag(row: number, col: number) {
    const cell = this.cell(row, col);
    if (!cell || cell.revealed || this.finished) return false;
    cell.flagged = !cell.flagged;
    if (this.status === 'playing') this.checkWin();
    return true;
  }

  useReward(reward: Reward, row: number, col: number) {
    const cell = this.cell(row, col);
    const index = this.inventory.indexOf(reward);
    if (!cell || index < 0 || this.status !== 'playing') return false;
    this.inventory.splice(index, 1);
    let affected = false;
    if (reward === 'Detector' && !cell.revealed) {
      cell.flagged = false;
      cell.revealed = true;
      if (!cell.mine) this.points += cell.adjacent * 100;
      affected = true;
    } else if (reward === 'Scavenge') {
      const candidates = this.cells.filter(item => item.mine && !item.revealed && !item.flagged);
      const mine = candidates[Math.floor(this.random() * candidates.length)];
      if (mine) {
        mine.revealed = true;
        affected = true;
      }
    } else if (reward === 'Sweep') {
      for (const empty of this.cells) {
        if (!empty.mine && !empty.revealed && !empty.flagged && empty.adjacent === 0) {
          this.flood(empty);
          affected = true;
        }
      }
    }
    this.checkWin();
    return affected;
  }

  private checkWin() {
    const safeRevealed = this.cells.every(cell => cell.mine || cell.revealed);
    const minesFound = this.cells.every(cell => cell.mine ? cell.flagged || cell.revealed : !cell.flagged);
    if (safeRevealed || minesFound) this.finish('won');
  }

  private finish(status: 'won' | 'lost') {
    this.status = status;
    this.endedAt = Date.now();
  }
}
