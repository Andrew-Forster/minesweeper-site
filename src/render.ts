import type { Board, Cell, Reward } from './board';

const tiles = '/Assets/Images/Game/';

function cellImage(cell: Cell, finished: boolean) {
  if (cell.flagged && !finished) return 'Flag.png';
  if (!cell.revealed && !finished) return 'Tile.png';
  if (cell.mine) return 'Mine.png';
  if (cell.adjacent > 0) return `Num ${cell.adjacent}.png`;
  if (cell.reward && !cell.collected) return 'Reward.png';
  return 'Tile Revealed.png';
}

export function renderBoard(board: Board, container: HTMLElement) {
  if (container.childElementCount !== board.cells.length) {
    container.replaceChildren(...board.cells.map(cell => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      button.dataset.row = String(cell.row);
      button.dataset.col = String(cell.col);
      const image = document.createElement('img');
      image.alt = '';
      image.draggable = false;
      button.append(image);
      return button;
    }));
  }
  container.className = `board board-size-${board.size}`;
  for (const [index, button] of Array.from(container.querySelectorAll('button')).entries()) {
    const cell = board.cells[index]!;
    const filename = cellImage(cell, board.finished);
    const image = button.querySelector('img')!;
    if (image.getAttribute('src') !== tiles + filename) image.src = tiles + filename;
    button.dataset.flagged = String(cell.flagged);
    button.disabled = board.finished || (cell.revealed && !(cell.reward && !cell.collected));
    const description = cell.flagged && !board.finished ? 'flagged'
      : !cell.revealed && !board.finished ? 'covered'
      : cell.mine ? 'mine'
      : cell.reward && !cell.collected ? 'reward'
      : cell.adjacent ? `${cell.adjacent} adjacent mines` : 'empty';
    button.setAttribute('aria-label', `Row ${cell.row + 1}, column ${cell.col + 1}: ${description}`);
  }
}

export function renderRewards(rewards: readonly Reward[], container: HTMLElement, select: (reward: Reward) => void) {
  container.replaceChildren();
  if (!rewards.length) return;
  const label = document.createElement('p');
  label.className = 'w-100';
  label.textContent = 'Use a reward:';
  container.append(label);
  for (const reward of rewards) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tag btn-img w-100';
    const image = document.createElement('img');
    image.src = '/Assets/Images/Buttons/BtnYellow.png';
    image.alt = '';
    const text = document.createElement('span');
    text.textContent = reward;
    button.append(image, text);
    button.addEventListener('click', () => select(reward));
    container.append(button);
  }
}
