import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board, presets, validSettings } from '../src/board';

beforeEach(() => {
  let seed = 12345;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

function started() {
  const board = new Board(9, 10);
  board.reveal(4, 4);
  return board;
}

describe('board rules', () => {
  it.each(Object.values(presets))('preserves preset $size/$mines and protects the first reveal', ({ size, mines }) => {
    const board = new Board(size, mines);
    board.reveal(0, 0);
    expect(board.cells.filter(cell => cell.mine)).toHaveLength(mines);
    expect(board.cell(0, 0)?.mine).toBe(false);
    expect(board.cell(0, 0)?.adjacent).toBe(0);
    expect(board.status).toBe('playing');
  });

  it('supports all custom sizes at both mine-count boundaries', () => {
    for (let size = 5; size <= 24; size++) {
      for (const mines of [5, Math.floor(size * size / 4)]) {
        const board = new Board(size, mines);
        board.reveal(Math.floor(size / 2), Math.floor(size / 2));
        expect(board.cells.filter(cell => cell.mine)).toHaveLength(mines);
        expect(board.status).not.toBe('lost');
      }
    }
  });

  it('rejects unsupported settings and ignores invalid coordinates', () => {
    for (const [size, mines] of [[0, 5], [25, 5], [9, 0], [9, 81], [5.5, 5], [9, NaN], [9, Infinity]]) {
      expect(validSettings(size!, mines!)).toBe(false);
      expect(() => new Board(size!, mines!)).toThrow(RangeError);
    }
    const board = new Board(9, 10);
    expect(board.reveal(-1, 0)).toBe(false);
    expect(board.flag(9, 0)).toBe(false);
    expect(board.reveal(0.5, 0)).toBe(false);
    expect(board.status).toBe('ready');
  });

  it('keeps flags through first-click placement and flood fill', () => {
    const board = new Board(9, 10);
    board.flag(4, 3);
    expect(board.startedAt).toBeNull();
    board.reveal(4, 4);
    expect(board.cell(4, 3)).toMatchObject({ flagged: true, revealed: false, mine: false });
    expect(board.reveal(4, 3)).toBe(false);
  });

  it('calculates adjacent mines correctly at edges and in the middle', () => {
    const board = started();
    for (const cell of board.cells) {
      const adjacent = board.cells.filter(other => other !== cell && other.mine
        && Math.abs(other.row - cell.row) <= 1 && Math.abs(other.col - cell.col) <= 1).length;
      expect(cell.adjacent).toBe(adjacent);
    }
  });

  it('collects each reward once, including rewards exposed by a flood', () => {
    const board = started();
    const reward = board.cells.find(cell => cell.reward && !cell.collected)!;
    const before = board.inventory.length;
    board.reveal(reward.row, reward.col);
    expect(board.inventory).toHaveLength(before + 1);
    board.reveal(reward.row, reward.col);
    expect(board.inventory).toHaveLength(before + 1);
  });

  it('loses on a mine, applies time once, and stops further actions', () => {
    const board = started();
    const mine = board.cells.find(cell => cell.mine)!;
    const points = board.score;
    vi.advanceTimersByTime(4000);
    board.reveal(mine.row, mine.col);
    expect(board.status).toBe('lost');
    expect(board.score).toBe(points - 40);
    vi.advanceTimersByTime(10000);
    expect(board.score).toBe(points - 40);
    expect(board.flag(0, 0)).toBe(false);
    expect(board.reveal(0, 0)).toBe(false);
  });

  it('wins when safe cells are revealed or all mines are correctly flagged', () => {
    const revealed = started();
    for (const cell of revealed.cells.filter(cell => !cell.mine)) revealed.reveal(cell.row, cell.col);
    expect(revealed.status).toBe('won');
    const flagged = started();
    for (const cell of flagged.cells.filter(cell => cell.mine)) flagged.flag(cell.row, cell.col);
    expect(flagged.status).toBe('won');
  });

  it('does not win with an incorrectly flagged safe cell', () => {
    const board = started();
    const safe = board.cells.find(cell => !cell.mine && !cell.revealed)!;
    board.flag(safe.row, safe.col);
    for (const mine of board.cells.filter(cell => cell.mine)) board.flag(mine.row, mine.col);
    expect(board.status).toBe('playing');
    board.flag(safe.row, safe.col);
    expect(board.status).toBe('won');
  });

  it('requires an owned reward and lets Detector reveal a mine without losing', () => {
    const board = started();
    board.inventory.length = 0;
    const mine = board.cells.find(cell => cell.mine)!;
    expect(board.useReward('Detector', mine.row, mine.col)).toBe(false);
    board.inventory.push('Detector');
    expect(board.useReward('Detector', mine.row, mine.col)).toBe(true);
    expect(mine.revealed).toBe(true);
    expect(board.status).toBe('playing');
    expect(board.inventory).toHaveLength(0);
  });

  it('finishes Scavenge without a loop when every mine is already marked', () => {
    const board = started();
    for (const mine of board.cells.filter(cell => cell.mine)) mine.flagged = true;
    board.inventory.push('Scavenge');
    expect(board.useReward('Scavenge', 0, 0)).toBe(false);
    expect(board.status).toBe('won');
  });

  it('Scavenge reveals one mine and Sweep opens all unflagged empty areas', () => {
    const board = started();
    board.inventory.push('Scavenge', 'Sweep');
    expect(board.useReward('Scavenge', 0, 0)).toBe(true);
    expect(board.cells.filter(cell => cell.mine && cell.revealed)).toHaveLength(1);
    board.useReward('Sweep', 0, 0);
    expect(board.cells.filter(cell => !cell.mine && cell.adjacent === 0).every(cell => cell.revealed)).toBe(true);
  });
});
