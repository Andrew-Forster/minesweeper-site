import type { Board } from './board';
import { playSound } from './audio';

export function animateGameOver(board: Board, grid: HTMLElement, complete: () => void) {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const images: HTMLImageElement[] = [];
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    complete();
    return () => {};
  }
  const mines = board.cells.filter(cell => cell.mine);
  const type = board.status === 'won' ? 'Defuse' : 'Explode';
  playSound(type);
  for (const [index, cell] of mines.entries()) {
    timers.push(setTimeout(() => {
      const button = grid.children.item(cell.row * board.size + cell.col);
      if (!button) return;
      const image = document.createElement('img');
      image.className = 'gameOverImg';
      image.alt = '';
      image.src = `/Assets/Images/Game/${type}.gif`;
      button.append(image);
      images.push(image);
      timers.push(setTimeout(() => image.remove(), 700));
    }, index * 3000 / Math.max(1, mines.length - 1)));
  }
  timers.push(setTimeout(complete, 3800));
  return () => {
    for (const timer of timers) clearTimeout(timer);
    for (const image of images) image.remove();
  };
}
