import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { createServer } from 'node:net';

const image = process.argv[2];
const apiImage = process.argv[3];
assert(image && apiImage, 'Usage: node scripts/check-container.mjs WEB_IMAGE API_IMAGE');
const name = `minesweeper-check-${process.pid}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 30_000 }).trim();
const request = (url, options = {}) => fetch(url, { ...options, headers: { Connection: 'close', ...options.headers } });
let container;
let network;
let edge;
let api;
let volume;

const reservation = createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;

try {
  network = docker('network', 'create', '--internal', name);
  edge = docker('network', 'create', `${name}-edge`);
  volume = docker('volume', 'create', name);
  api = docker('run', '-d', '--name', `${name}-api`, '--network', network, '--network-alias', 'leaderboard',
    '--read-only', '--user', '1000:1000', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges:true', '--memory', '128m', '--cpus', '0.5', '--pids-limit', '64',
    '--mount', `type=volume,source=${volume},target=/data`, '--env', `PUBLIC_ORIGIN=${base}`, apiImage);
  container = docker('create', '--name', name, '--network', edge,
    '--read-only', '--user', '101:101', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
    '--memory', '128m', '--cpus', '0.5', '--pids-limit', '64',
    '--publish', `127.0.0.1:${port}:8080`, image);
  docker('network', 'connect', network, container);
  docker('start', container);
  const address = docker('port', container, '8080/tcp');
  assert.match(address, /^127\.0\.0\.1:\d+$/);
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await request(`${base}/api/leaderboard?difficulty=Easy`, { signal: AbortSignal.timeout(1000) });
      ready = response.ok;
      if (ready) break;
    } catch {}
    await setTimeout(100);
  }
  assert(ready, 'Container must become healthy');

  const response = await request(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  const html = await response.text();
  assert.match(html, /Minesweeper/);
  const script = html.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1];
  assert(script, 'Built JavaScript is present');
  assert.equal((await request(base + script)).status, 200);
  assert.equal((await request(`${base}/missing-file`)).status, 404);
  assert.equal((await request(base, { method: 'POST' })).status, 405);
  const config = JSON.parse(docker('inspect', container))[0];
  assert.equal(config.Config.User, '101:101');
  assert.equal(config.HostConfig.ReadonlyRootfs, true);
  assert.equal(config.HostConfig.Privileged, false);
  assert.equal(config.HostConfig.Memory, 128 * 1024 * 1024);
  assert.equal(config.Mounts.length, 0);
  const apiConfig = JSON.parse(docker('inspect', api))[0];
  assert.equal(apiConfig.Config.User, '1000:1000');
  assert.equal(apiConfig.HostConfig.ReadonlyRootfs, true);
  assert.equal(Object.keys(apiConfig.HostConfig.PortBindings ?? {}).length, 0);
  assert.equal(apiConfig.Mounts.length, 1);
  assert.equal(Object.keys(apiConfig.NetworkSettings.Networks).length, 1);
  assert.equal(JSON.parse(docker('network', 'inspect', network))[0].Internal, true);

  execFileSync('corepack', ['pnpm', 'test:browser'], {
    env: { ...process.env, PLAYWRIGHT_BASE_URL: base },
    stdio: 'inherit', timeout: 120_000,
  });
  const saved = await (await request(`${base}/api/leaderboard?difficulty=Easy`)).json();
  assert(saved.entries.length > 0, 'Browser wins must be persisted');
  docker('exec', api, 'node', 'server-dist/server/backup.js');
  const backupCount = docker('exec', api, 'node', '--input-type=module', '-e',
    "import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync('/data/leaderboard-backup.sqlite',{readOnly:true}); console.log(db.prepare('SELECT COUNT(*) AS count FROM scores').get().count); db.close();");
  assert.equal(Number(backupCount), saved.entries.length);
  docker('restart', api);
  for (let attempt = 0; attempt < 50; attempt++) {
    const response = await request(`${base}/api/leaderboard?difficulty=Easy`);
    if (response.ok) {
      assert.deepEqual((await response.json()).entries, saved.entries);
      break;
    }
    assert(attempt < 49, 'API must recover after restart');
    await setTimeout(200);
  }

  const responses = [];
  for (let batch = 0; batch < 8; batch++) {
    responses.push(...await Promise.all(Array.from({ length: 32 }, () =>
      request(base, { method: 'HEAD', signal: AbortSignal.timeout(5000) }))));
  }
  const limited = responses.filter(item => item.status === 429).length;
  assert(limited > 0, 'A bounded local burst should exercise the request ceiling');
  assert(responses.every(item => item.status === 200 || item.status === 429));
  assert.equal((await request(`${base}/healthz`)).status, 200);
  console.log(`PASS: static assets, headers, method restrictions, container isolation, health check; ${limited}/256 burst requests received 429.`);
} catch (error) {
  if (container) console.error(docker('logs', '--tail', '8', container));
  if (api) console.error(docker('logs', '--tail', '8', api));
  throw error;
} finally {
  if (container) docker('rm', '-f', container);
  if (api) docker('rm', '-f', api);
  if (volume) docker('volume', 'rm', volume);
  if (network) docker('network', 'rm', network);
  if (edge) docker('network', 'rm', edge);
}
