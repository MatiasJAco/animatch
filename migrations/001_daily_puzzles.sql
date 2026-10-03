-- The only table this app creates. The catalog is owned elsewhere and is never altered here.
CREATE TABLE IF NOT EXISTS daily_puzzles (
  game        TEXT        NOT NULL,
  puzzle_date DATE        NOT NULL,
  payload     JSONB       NOT NULL,
  solution    JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game, puzzle_date)
);