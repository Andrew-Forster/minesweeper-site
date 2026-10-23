import './styles/site.css';
import './styles/game.css';
import './styles/browser.css';
import { Board, presets, validSettings } from './board';
import type { Difficulty, Reward } from './board';
import { playSound } from './audio';
import { renderBoard, renderRewards } from './render';
import { animateGameOver } from './game-over';
import seedrandom from 'seedrandom';
import { element } from './dom';
import { loadLeaderboard, saveRankedResult, startRankedRun } from './leaderboard';
import { nameSchema } from './contracts';
import type { Move, RankedRun } from './contracts';

const menu = element('#menuScreen', HTMLElement);
const game = element('#gameScreen', HTMLElement);
const form = element('#startForm', HTMLFormElement);
const grid = element('.board', HTMLElement);
const modal = element('#gameModal', HTMLElement);
const boardSize = element('#boardSize', HTMLInputElement);
const mineCount = element('#mineCount', HTMLInputElement);
const notice = element('#notice', HTMLElement);
const timer = element('#timer', HTMLElement);
const playAgain = element('#playAgain', HTMLButtonElement);
const custom = element('.custom-container', HTMLElement);
const playerName = element('#playerName', HTMLInputElement);
const resultStatus = element('#resultStatus', HTMLElement);
let difficulty: Difficulty = 'Easy';
let board: Board | null = null;
let usingReward: Reward | null = null;
let timerId: ReturnType<typeof setInterval> | undefined;
let noticeId: ReturnType<typeof setTimeout> | undefined;
let cancelAnimation = () => {};
let rankedRun: RankedRun | null = null;
let moves: Move[] = [];
let name = '';
let starting = false;

function record(move: Move) {
  if (moves.length < 2000) moves.push(move);
  else {
    rankedRun = null;
    resultStatus.textContent = 'This game exceeded the leaderboard move limit.';
  }
}

async function saveScore(current: Board, run: RankedRun) {
  resultStatus.textContent = 'Saving score…';
  try {
    const result = await saveRankedResult(run, moves);
    if (board !== current) return;
    element('#score', HTMLElement).textContent = String(result.score);
    element('#gamePoints', HTMLElement).textContent = `Score: ${result.score}`;
    resultStatus.textContent = `Saved as ${name}.`;
    void loadLeaderboard(difficulty);
  } catch {
    if (board === current) resultStatus.textContent = 'Your score could not be saved. You can still play again.';
  }
}

function notify(message: string, persistent = false) {
  clearTimeout(noticeId);
  notice.textContent = message;
  notice.hidden = false;
  if (!persistent) noticeId = setTimeout(() => { notice.hidden = true; }, 3500);
}

function updateTimer() {
  const elapsed = board?.elapsedSeconds ?? 0;
  timer.textContent = [Math.floor(elapsed / 3600), Math.floor(elapsed / 60) % 60, elapsed % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}

function render() {
  if (!board) return;
  renderBoard(board, grid);
  element('#score', HTMLElement).textContent = String(board.score);
  renderRewards(board.finished ? [] : board.inventory, element('#rewardMenu', HTMLElement), reward => {
    usingReward = reward;
    notify(`Using ${reward}. Choose a covered cell.`, true);
    playSound('Button');
  });
  updateTimer();
  if (board.finished) {
    clearInterval(timerId);
    usingReward = null;
    notice.hidden = true;
    const won = board.status === 'won';
    element('#resultTitle', HTMLElement).textContent = won ? 'You win!' : 'You lost';
    element('#gamePoints', HTMLElement).textContent = `Score: ${board.score}`;
    if (board.status === 'won' && rankedRun) {
      const run = rankedRun;
      rankedRun = null;
      void saveScore(board, run);
    }
    cancelAnimation = animateGameOver(board, grid, () => {
      modal.hidden = false;
      modal.classList.add('active');
      playAgain.focus();
      playSound(won ? 'Win' : 'Lose');
    });
  }
}

function start(size: number, mines: number) {
  cancelAnimation();
  board = new Board(size, mines);
  rankedRun = null;
  moves = [];
  starting = false;
  resultStatus.textContent = '';
  usingReward = null;
  clearInterval(timerId);
  timerId = setInterval(updateTimer, 1000);
  menu.hidden = true;
  game.hidden = false;
  modal.hidden = true;
  modal.classList.remove('active');
  notice.hidden = true;
  render();
  grid.querySelector('button')?.focus();
}

function showMenu() {
  cancelAnimation();
  clearInterval(timerId);
  usingReward = null;
  board = null;
  rankedRun = null;
  starting = false;
  game.hidden = true;
  menu.hidden = false;
  modal.hidden = true;
  modal.classList.remove('active');
  notice.hidden = true;
  form.querySelector<HTMLButtonElement>('.selected')?.focus();
  void loadLeaderboard(difficulty);
}

document.querySelectorAll<HTMLButtonElement>('.difficulty-btn').forEach(button => {
  button.addEventListener('click', () => {
    const selected = button.dataset.difficulty;
    if (selected !== 'Easy' && selected !== 'Medium' && selected !== 'Hard' && selected !== 'Custom') return;
    difficulty = selected;
    document.querySelectorAll<HTMLButtonElement>('.difficulty-btn').forEach(option => {
      option.classList.toggle('selected', option === button);
      option.setAttribute('aria-pressed', String(option === button));
    });
    custom.hidden = selected !== 'Custom';
    custom.classList.toggle('active', selected === 'Custom');
    playerName.disabled = selected === 'Custom';
    element('.player-name', HTMLLabelElement).hidden = selected === 'Custom';
    void loadLeaderboard(selected);
    playSound('Button');
  });
});

boardSize.addEventListener('input', () => {
  const maximum = Math.floor(boardSize.valueAsNumber ** 2 / 4);
  mineCount.max = String(maximum);
  mineCount.value = String(Math.max(5, Math.floor(maximum / 2)));
  element('#boardSizeValue', HTMLElement).textContent = boardSize.value;
  element('#mineCountValue', HTMLElement).textContent = mineCount.value;
});
mineCount.addEventListener('input', () => {
  element('#mineCountValue', HTMLElement).textContent = mineCount.value;
});
mineCount.max = String(Math.floor(boardSize.valueAsNumber ** 2 / 4));

form.addEventListener('submit', event => {
  event.preventDefault();
  const settings = difficulty === 'Custom'
    ? { size: boardSize.valueAsNumber, mines: mineCount.valueAsNumber } : presets[difficulty];
  if (!validSettings(settings.size, settings.mines)) {
    notify('Choose a board from 5 to 24, with 5 mines up to a quarter of its cells.');
    return;
  }
  name = difficulty === 'Custom' ? '' : playerName.value.trim();
  if (name && !nameSchema.safeParse(name).success) {
    notify('Use 1–20 letters, numbers, spaces, dots, dashes, or underscores for your name.');
    playerName.focus();
    return;
  }
  playSound('Button');
  start(settings.size, settings.mines);
});

grid.addEventListener('click', async event => {
  if (!board || starting || board.finished || !(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>('.cell');
  if (!button || button.disabled) return;
  const row = Number(button.dataset.row);
  const col = Number(button.dataset.col);
  if (!usingReward && board.cell(row, col)?.flagged) return;
  if (board.status === 'ready' && name && difficulty !== 'Custom') {
    const current = board;
    starting = true;
    notify('Starting leaderboard game…', true);
    try {
      const run = await startRankedRun(name, difficulty);
      if (board !== current) return;
      rankedRun = run;
      board = new Board(current.size, current.mines, seedrandom(run.seed));
      for (const move of moves) if (move.type === 'flag') board.flag(move.row, move.col);
      notice.hidden = true;
    } catch {
      if (board !== current) return;
      name = '';
      notify('The leaderboard is unavailable. This game will not be ranked.');
    } finally {
      if (board === current || rankedRun) starting = false;
    }
  }
  if (!board) return;
  if (usingReward) {
    const reward = usingReward;
    usingReward = null;
    notify(board.useReward(reward, row, col) ? `Used ${reward}.` : `${reward} had no effect.`);
    record({ type: 'reward', reward, row, col });
    playSound('Reward');
  } else {
    const previousRewards = board.inventory.length;
    if (!board.reveal(row, col)) return;
    record({ type: 'reveal', row, col });
    playSound(board.inventory.length > previousRewards ? 'Reward' : 'Click');
  }
  render();
});

grid.addEventListener('contextmenu', event => {
  event.preventDefault();
  if (!board || starting || !(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>('.cell');
  if (!button || !board.flag(Number(button.dataset.row), Number(button.dataset.col))) return;
  record({ type: 'flag', row: Number(button.dataset.row), col: Number(button.dataset.col) });
  playSound('Flag');
  render();
});

playAgain.addEventListener('click', () => { if (board) start(board.size, board.mines); });
element('#adjustDifficulty', HTMLButtonElement).addEventListener('click', showMenu);
element('#goBack', HTMLAnchorElement).addEventListener('click', event => {
  event.preventDefault();
  showMenu();
});
element('#viewBoard', HTMLButtonElement).addEventListener('click', () => {
  modal.hidden = true;
  modal.classList.remove('active');
  element('#goBack', HTMLAnchorElement).focus();
});

modal.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const buttons = Array.from(modal.querySelectorAll('button'));
  const first = buttons[0];
  const last = buttons.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
});

void loadLeaderboard('Easy');
