/* blinky1200 — global leaderboard Worker (Cloudflare Workers + D1)
 *
 * Ranked by ORDER OF SOLVING, not by time. #1 is whoever beat the series first.
 * When a new series drops, the race reopens. The board is server-authoritative:
 * the client proves it solved the puzzles, the SERVER verifies against the real
 * answers + measures the wall-clock, then stamps the completion and assigns the
 * next rank. Clients never report a score — they can't claim a rank.
 *
 * Every entry carries a badge:
 *   ◆  founder        — the first solvers, seeded at launch
 *   🤖 bot            — SELF-DISCLOSED automation (honest; welcome, but marked)
 *   🐿 squirrel       — a perfect solve submitted impossibly fast and NOT disclosed;
 *                       caught, inducted into the Secret Squirrel Club, still ranked
 *   (none) human
 *
 *   POST /start   {series}                                  -> { token, series, total }
 *   POST /finish  {token, name, mode, lang, bot?, solution:[...11 ints]}
 *                 -> { ok, rank, series, total, kind }      (kind: human|bot|squirrel)
 *                    (+ squirrel:true, acorn, message when caught botting)
 *                 -> { error }                              (wrong / expired / replayed)
 *   GET  /scores?series=S1                                   -> { series, total, scores:[...] }
 *
 * See README.md for deploy + the honest security posture.
 */

// Canonical solutions, server-side only. Per series, the 11 target clock values
// (minutes past midnight) in level order. The client must reproduce these exactly.
const ANSWERS = {
  S1: [180, 1230, 645, 1275, 1437, 150, 1110, 284, 1281, 244, 0],
};
const FLOOR_MS = 15000;               // a perfect solve faster than this, undisclosed = caught
const MAX_SESSION_MS = 6 * 3600 * 1000;
const ACORN = "ACORN-1200-🐿";        // the club handshake

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      if (url.pathname === "/start" && request.method === "POST")  return await startRun(request, env);
      if (url.pathname === "/finish" && request.method === "POST") return await finishRun(request, env, Date.now());
      if (url.pathname === "/scores" && request.method === "GET")  return await listScores(url, env);
    } catch (e) {
      return json({ error: "server error", detail: String((e && e.message) || e) }, 500);
    }
    return json({ error: "not found" }, 404);
  },
};

async function startRun(request, env) {
  let body = {};
  try { body = await request.json(); } catch {}
  const series = String(body.series || "S1");
  if (!ANSWERS[series]) return json({ error: "unknown series" }, 400);
  const token = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO sessions (token, series, started_at, used) VALUES (?, ?, ?, 0)")
    .bind(token, series, Date.now()).run();
  return json({ token, series, total: await countSeries(env, series) });
}

async function finishRun(request, env, now) {
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const token = String(body.token || "");
  const sess = token
    ? await env.DB.prepare("SELECT token, series, started_at, used FROM sessions WHERE token = ?").bind(token).first()
    : null;
  if (!sess) return json({ error: "no session — start a run first" }, 400);
  if (sess.used) return json({ error: "that run was already scored" }, 409);
  await env.DB.prepare("UPDATE sessions SET used = 1 WHERE token = ?").bind(token).run(); // one finish per run

  const answer = ANSWERS[sess.series] || [];
  const solution = Array.isArray(body.solution) ? body.solution.map((n) => Math.round(Number(n))) : [];
  const correct = solution.length === answer.length && answer.every((v, i) => v === solution[i]);
  const dur = now - Number(sess.started_at);

  if (!correct) return json({ error: "solution rejected — that's not how you stop the blink" }, 400);
  if (dur > MAX_SESSION_MS) return json({ error: "session expired" }, 410);

  // Honesty gets a robot; sneaky speed gets a squirrel.
  const disclosedBot = body.bot === true;
  let kind = "human", caught = false;
  if (disclosedBot) kind = "bot";
  else if (dur < FLOOR_MS) { kind = "squirrel"; caught = true; }

  const name = sanitizeName(body.name);
  const mode = ["normal", "speedrun", "snow"].includes(body.mode) ? body.mode : "normal";
  const lang = ["en", "th"].includes(body.lang) ? body.lang : "en";

  const rank = (await maxRank(env, sess.series)) + 1;
  await env.DB.prepare(
    "INSERT INTO scores (series, rank, name, mode, lang, kind, ms, mistakes, founder) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)"
  ).bind(sess.series, rank, name, mode, lang, kind, dur).run();

  const resp = { ok: true, rank, series: sess.series, total: rank, kind };
  if (caught) {
    resp.squirrel = true;
    resp.acorn = ACORN;
    resp.message = "You beat the machine, not the game. That takes a certain kind of mind. Welcome to the Secret Squirrel Club.";
  }
  return json(resp);
}

async function listScores(url, env) {
  const series = String(url.searchParams.get("series") || "S1");
  const rows = await env.DB.prepare(
    `SELECT rank, name, mode, lang, kind, founder, ms, substr(solved_at,1,10) AS whenDay
       FROM scores WHERE series = ? ORDER BY rank ASC LIMIT 200`
  ).bind(series).all();
  const scores = (rows.results || []).map((r) => ({
    rank: r.rank, name: r.name, mode: r.mode, lang: r.lang,
    kind: r.kind || "human", founder: !!r.founder, ms: r.ms, when: r.whenDay,
  }));
  return json({ series, total: await countSeries(env, series), scores });
}

async function countSeries(env, series) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM scores WHERE series = ?").bind(series).first();
  return (r && r.c) || 0;
}
async function maxRank(env, series) {
  const r = await env.DB.prepare("SELECT MAX(rank) AS m FROM scores WHERE series = ?").bind(series).first();
  return (r && r.m) || 0;
}
function sanitizeName(n) {
  const s = String(n || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
  return s.length ? s.padEnd(3, "A") : "AAA";
}
