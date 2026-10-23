import { expect, test } from '@playwright/test';
import seedrandom from 'seedrandom';
import { Board } from '../../src/board';
import { runSchema } from '../../src/contracts';

test('starts, flags, and reveals locally with working assets', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const requests: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => console.error(`CSP violation: ${event.violatedDirective}`));
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
  page.on('request', request => {
    if ((['fetch', 'xhr'].includes(request.resourceType()) && !request.url().includes('/api/leaderboard'))
      || request.method() !== 'GET') requests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Easy', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const cells = page.locator('.cell');
  await expect(cells).toHaveCount(81);
  await cells.nth(80).click({ button: 'right' });
  await expect(cells.nth(80)).toHaveAttribute('data-flagged', 'true');
  await cells.nth(80).click({ button: 'right' });
  await expect(cells.nth(80)).toHaveAttribute('data-flagged', 'false');
  await cells.first().click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(cells.first()).not.toHaveAccessibleName(/covered/);
  await expect(page.locator('#timer')).not.toHaveText('00:00:00', { timeout: 2500 });
  await expect.poll(() => page.locator('.cell img').evaluateAll(images => images.every(image =>
    image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('game.png'), fullPage: true });
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});

test('saves a verified win under an optional name and displays it', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Leaderboard name').fill('Browser player');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const runResponse = page.waitForResponse(response => response.url().endsWith('/api/runs'));
  await page.locator('.cell').first().click();
  const run = runSchema.parse(await (await runResponse).json());
  const board = new Board(9, 10, seedrandom(run.seed));
  board.reveal(0, 0);
  const resultResponse = page.waitForResponse(response => response.url().endsWith('/api/results'));
  for (const cell of board.cells) {
    if (!cell.mine && !cell.revealed && !board.finished) {
      board.reveal(cell.row, cell.col);
      await page.locator('.cell').nth(cell.row * 9 + cell.col).click();
    }
  }
  expect((await resultResponse).status()).toBe(201);
  await expect(page.locator('#resultStatus')).toHaveText('Saved as Browser player.');
  await page.getByRole('button', { name: 'Adjust Difficulty' }).click();
  await expect(page.locator('#leaderboardRows')).toContainText('Browser player');
});

test('continues locally when the leaderboard cannot start a game', async ({ page }) => {
  await page.route('**/api/runs', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }));
  await page.goto('/');
  await page.getByLabel('Leaderboard name').fill('Guest');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.locator('.cell').first().click();
  await expect(page.locator('.cell').first()).not.toHaveAccessibleName(/covered/);
  await expect(page.locator('#notice')).toContainText('This game will not be ranked.');
});

test('supports custom difficulty and returns to the menu without a reload', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  const size = page.getByRole('slider', { name: /Board Size/ });
  await size.fill('24');
  const mines = page.getByRole('slider', { name: /Mine Count/ });
  await expect(mines).toHaveAttribute('max', '144');
  await mines.fill('144');
  await page.screenshot({ path: testInfo.outputPath('menu.png'), fullPage: true });
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.cell')).toHaveCount(576);
  const box = await page.locator('.board').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await page.getByRole('link', { name: 'Go Back' }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
});

test('ends a game and restarts with a fresh board', async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 12345;
    Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.locator('.cell').first().click();
  for (let index = 0; index < 81; index++) {
    if (await page.getByRole('dialog').isVisible()) break;
    const cell = page.locator('.cell').nth(index);
    if (await cell.isEnabled()) await cell.click();
  }
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.cell:enabled')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play Again?' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.cell:enabled')).toHaveCount(81);
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#timer')).toHaveText('00:00:00');
});
