-- blinky1200 global leaderboard — ranked by ORDER OF SOLVING, per series.

CREATE TABLE IF NOT EXISTS scores (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  series    TEXT    NOT NULL,               -- e.g. 'S1' (a game series / season)
  rank      INTEGER NOT NULL,               -- solve order within the series (1 = first ever)
  name      TEXT    NOT NULL,               -- 3-letter initials
  mode      TEXT,
  lang      TEXT,
  kind      TEXT    NOT NULL DEFAULT 'human',-- human | bot (self-disclosed) | squirrel (caught)
  ms        INTEGER,                        -- server-measured play time (stat only, not ranked)
  mistakes  INTEGER,
  founder   INTEGER NOT NULL DEFAULT 0,
  solved_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_series_rank ON scores(series, rank);

-- One row per run-in-progress; token is burned on finish so a run scores once.
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT    PRIMARY KEY,
  series     TEXT    NOT NULL,
  started_at INTEGER NOT NULL,              -- epoch ms, server clock
  used       INTEGER NOT NULL DEFAULT 0
);

-- Founding entries. Coin flip 2026-07-23: HUN #1, NAN #2 in Series S1.
INSERT INTO scores (series, rank, name, mode, lang, kind, ms, mistakes, founder, solved_at)
  SELECT 'S1', 1, 'HUN', 'speedrun', 'en', 'human', 117300, 2, 1, '2026-07-23 00:00:00'
  WHERE NOT EXISTS (SELECT 1 FROM scores WHERE series='S1' AND rank=1);
INSERT INTO scores (series, rank, name, mode, lang, kind, ms, mistakes, founder, solved_at)
  SELECT 'S1', 2, 'NAN', 'normal', 'en', 'human', 123000, 0, 1, '2026-07-23 00:00:00'
  WHERE NOT EXISTS (SELECT 1 FROM scores WHERE series='S1' AND rank=2);
