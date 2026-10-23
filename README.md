Minesweeper runs in the browser. An optional name enters completed wins into a shared leaderboard. There are no accounts, passwords, cookies, or analytics. Leaving the name blank works without the leaderboard service.

The original artwork, sounds, difficulty choices, scoring, Detector, Scavenge, and Sweep rewards are reused. The old ASP.NET application, account database, checked-in build output, and Azure deployment workflows have been removed. Their source remains in Git history.

The browser uses TypeScript and Vite with the existing HTML/CSS interface. Nginx serves the built files. A separate Fastify service uses SQLite for the leaderboard. Both services run without root privileges. The API is attached only to an internal Docker network. Nginx joins that network and a dedicated bridge so it can publish a port bound to this station's loopback address. Neither service joins the shared Dokploy application network.

To check a checkout with Node 22.12 or later:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm build
corepack pnpm exec playwright install chromium
docker build --target leaderboard -t minesweeper-api:check .
docker build -t minesweeper:check .
node scripts/check-container.mjs minesweeper:check minesweeper-api:check
```

The last command creates temporary containers, a private network, and a database volume, runs desktop/mobile browser checks and deployment checks, then removes its resources. It checks saved scores after an API restart. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can point to an already installed Chromium executable when needed by the workstation.

`corepack pnpm dev` serves the browser UI locally. For the complete application, use the Compose deployment in [deploy/SETUP.md](deploy/SETUP.md). A UI-only preview has no leaderboard API; play remains available, and the leaderboard displays its unavailable message.

Leaderboard behavior:

- A name is optional, public, 1–20 characters, and not an identity claim. Different people can use the same name.
- Easy, Medium, and Hard each show their top 10 wins by score, with shorter completion time breaking ties. Custom boards are unranked.
- On the first reveal, a named game requests a random board seed. Moves stay in the browser until a win. The API replays the bounded move history with the same engine and calculates points and elapsed-time penalties itself.
- A run lasts at most an hour, permits at most 2,000 moves, and can produce only one saved result. Retrying a saved result returns that result without adding a duplicate.
- The API permits 10 new runs and 5 result submissions per minute per visitor, and 60 requests per minute by default. Nginx additionally caps API traffic across the site at 5 requests/second with a burst of 10, and static traffic at 60 requests/second with a burst of 120.
- Only the best 100 results per standard difficulty are retained. Pending runs are capped at 1,000 and expired runs are cleared when a new run starts. Move histories and IP addresses are not stored in SQLite. Nginx access logs can contain IP addresses and rotate at 5 MB, retaining two files.
- This is a casual leaderboard. Replay validation rejects arbitrary claimed scores and unfinished games, but a player controls their browser and can inspect a board or automate a solution. It is not suitable for prizes or trusted competitive rankings.

The database lives in the `scores` Docker volume. `docker compose down` preserves it; `docker compose down -v` deletes it. Do not use the latter for updates.

The public setup depends on the existing Cloudflare Tunnel running in host-network mode on this station. The origin port must remain loopback-only. Nginx forwards Cloudflare's visitor address to the API for rate limiting; that trust depends on Cloudflare being the only public route to this service. Never expose the API container or the origin port directly to the internet.

The runtime image pins Node and Nginx image digests. Refresh those digests and the package lockfile for security updates, then run the checks above before redeploying. Node 22's built-in SQLite API is marked experimental; its use is limited to the database adapter and backup command and covered by persistence tests.
