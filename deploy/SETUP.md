Deploy this repository with the existing Dokploy installation and publish only Minesweeper through the station's existing Cloudflare Tunnel. The game stays in the browser; the small leaderboard API and its SQLite file stay inside Docker. No new paid service or application secret is required.

The files are prepared for `https://minesweeper.andrewjf.com`. The origin listens only on `127.0.0.1:3187`. The API accepts result submissions from that exact public origin. If the hostname changes, update `PUBLIC_ORIGIN` in `compose.yaml` as part of the same change.

1. Sign in to Dokploy using the station's private address, `http://100.111.203.68:3000`, over Tailscale. Create a Minesweeper project and a Docker Compose service. Select **Docker Compose**, not Docker Stack, because the configuration builds the images from source.

2. Select the **Git** provider and enter these values:

   - Repository: `https://github.com/Andrew-Forster/minesweeper-site.git`
   - Branch for testing this change: `feat/browser-game-hosting`
   - Compose path: `./compose.yaml`

   No repository token is required for this public repository. No environment secrets are required. Deploy and wait for both `web` and `leaderboard` to become healthy. Keep this as one Compose service so its database volume remains associated with future deployments. Do not run a separate copy of the stack on port 3187.

3. Check the origin on the station before publishing:

   ```sh
   curl --fail http://127.0.0.1:3187/healthz
   curl --fail 'http://127.0.0.1:3187/api/leaderboard?difficulty=Easy'
   ```

   Expected responses are `ok` and an object containing `entries`. If deployment fails, use the failed service's Dokploy logs. A port conflict means another process already owns 3187; identify it before changing or stopping anything.

4. Before publishing, verify the administration panel is not reachable from the internet through direct IPv4/IPv6 access or an unprotected public tunnel route. Existing host firewall/router rules were not verified during preparation because reading the firewall required elevated access. Keep administration private over Tailscale. Then, in the Cloudflare dashboard, open **Networking > Tunnels**, select the existing tunnel whose connector is this station's host-network `af-cloudflared` container, and add a published application route:

   - Hostname: `minesweeper.andrewjf.com`
   - Service type: HTTP
   - Service URL: `127.0.0.1:3187`
   - Path: leave blank

   Saving this route makes the game publicly reachable. Use the existing tunnel and preserve its other routes. Cloudflare provides public HTTPS; the last connection to the web container is local HTTP. Do not add router port forwarding or a public Docker port. Do not put the public game behind a Cloudflare Access login. Preserve Access protection for administration and other private services.

5. Open `https://minesweeper.andrewjf.com` in a browser. Start a game with no name, then try a named standard game. A completed win should show `Saved as ...` and appear in that difficulty's table if its score reaches the top 10. Custom games should say they are unranked. The API uses server elapsed time, so its final score can differ slightly from the browser's provisional score.

6. Check `https://minesweeper.andrewjf.com/healthz` externally and add that address to the existing uptime monitor. Do not treat a working public game as proof that administration is private.

For ordinary updates, deploy the same Compose service again. Leave the volume in place. After the task branch is merged, change Dokploy's branch to `main`. No merge is implied by these setup steps. The previous source is available in Git, but returning to the old account application would reintroduce the issues this change removes.

For backups, run this from the deployed Compose checkout, or use the same command in the leaderboard container's Dokploy terminal:

```sh
docker compose exec -T leaderboard node server-dist/server/backup.js /data/leaderboard-backup.sqlite
```

This uses SQLite's backup API so it is safe while the game is running. Copy that backup out of the container with `docker cp` to the station's backup location, then retain a copy on a separate device if score recovery after a disk failure matters. A backup left inside the same Docker volume is only a temporary copy. Schedule this through the existing backup tooling after the deployment's actual Compose project name and backup destination are known.

To restore, stop the leaderboard service, preserve the current database, and replace its SQLite database with a verified backup while the service is stopped. SQLite's WAL and SHM companion files belong to the old database and must not be reused with the replacement. Preserve ownership as UID/GID 1000, restart the service, and check its leaderboard before removing the preserved copy.

Dashboard references: [Dokploy Compose example](https://docs.dokploy.com/docs/core/docker-compose/example), [Dokploy Cloudflare Tunnel guide](https://docs.dokploy.com/docs/core/guides/cloudflare-tunnels), [Cloudflare Tunnel setup](https://developers.cloudflare.com/tunnel/get-started/).
