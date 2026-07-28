# blinky1200 — global leaderboard (Cloudflare Worker + D1)

A shared, **server-authoritative** leaderboard, ranked by **who solved the series first**
— not by how long it took. #1 is whoever beat it first; when a new series drops, the
race reopens. The client never reports a score: it *proves* it solved the puzzles, the
**server verifies** against the real answers, measures the wall-clock, and assigns the
rank. The game works without this too (it falls back to a local board).

## How it stays honest (no self-reported scores)

1. Start a run → `POST /start` returns a one-time `token` and stamps the server clock.
2. Play. The client accumulates the 11 solved clock values.
3. Finish → `POST /finish` with the token + the solution. The server checks the solution
   against the canonical answers, checks the token hasn't been used, and stamps completion.
4. Rank = the next number in solve order for that series.

Every entry is badged:

| badge | meaning |
|-------|---------|
| ◆ | founder — the first solvers, seeded at launch |
| 🤖 | **self-disclosed bot** — honest automation (`bot:true`); welcome, but marked |
| 🐿 | **Secret Squirrel Club** — a perfect solve submitted impossibly fast (< 15s) and *not* disclosed. Caught, inducted, and still ranked. Cheaters get a wink, not a wall. |
| — | human |

## Deploy (one time)

From this `worker/` folder:

```bash
npx wrangler login
npx wrangler d1 create blinky1200          # paste the printed database_id into wrangler.toml
npx wrangler d1 execute blinky1200 --remote --file=./schema.sql
npx wrangler deploy                        # prints https://blinky1200-leaderboard.<subdomain>.workers.dev
```

Then open `../index.html`, and set the URL near the top of the `<script>`:

```js
const LEADERBOARD_URL = "https://blinky1200-leaderboard.<subdomain>.workers.dev";
const SERIES = "S1";
```

## API

- `POST /start`  `{series}` → `{ token, series, total }`
- `POST /finish` `{token, name, mode, lang, bot?, solution:[...11 ints]}`
  → `{ ok, rank, series, total, kind }` (`kind`: `human|bot|squirrel`; `squirrel` adds `acorn`, `message`)
  → `{ error }` on wrong/expired/replayed
- `GET  /scores?series=S1` → `{ series, total, scores:[{rank,name,mode,lang,kind,founder,when,ms}] }`

## Starting a new series (reopen the race)

1. Add the new series' 11 answers to `ANSWERS` in `src/worker.js` (e.g. `S2: [...]`).
2. Bump `const SERIES = "S2";` in `index.html` and ship the new levels.
3. `wrangler deploy`. The board for `S2` starts empty — first solver takes #1.

## Honest caveats

- Scores are still ultimately **client-proven**, so the answers live in the client and a
  determined person could script a solve. That's by design here: the fast-perfect-solve
  trap routes undisclosed automation into the 🐿 Secret Squirrel Club rather than trying
  (and failing) to be uncrackable. Truly bot-proof would need the whole game server-side.
- **No rate limiting** beyond Cloudflare's defaults. At ~2–3k plays/month that's plenty;
  if it blows up, add a Turnstile check or a KV throttle on `/finish`.
- CORS is `*` so it works from `file://` and anywhere it's hosted.

## Inspect / reset

```bash
npx wrangler d1 execute blinky1200 --remote --command="SELECT rank,name,kind,founder FROM scores WHERE series='S1' ORDER BY rank LIMIT 20"
npx wrangler d1 execute blinky1200 --remote --command="DELETE FROM scores WHERE founder=0"   # wipe non-founders
```
