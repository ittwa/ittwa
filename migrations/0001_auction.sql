-- Free Agent Auction schema.
-- Run via `npm run db:migrate` (see scripts/migrate-auction.mjs).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS auction (
  id SERIAL PRIMARY KEY,
  season TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'setup', -- setup | live | paused | complete
  nomination_order JSONB NOT NULL DEFAULT '[]',
  current_nominator_index INTEGER NOT NULL DEFAULT 0,
  -- One-off override of who is on the clock for the NEXT nomination only;
  -- cleared automatically after that pick is awarded.
  nominator_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auction_owner (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL REFERENCES auction(id) ON DELETE CASCADE,
  owner TEXT NOT NULL,
  cap_hit NUMERIC NOT NULL DEFAULT 0,
  cap_hit_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (auction_id, owner)
);

CREATE TABLE IF NOT EXISTS auction_result (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL REFERENCES auction(id) ON DELETE CASCADE,
  pick_number INTEGER NOT NULL,
  nominator TEXT NOT NULL,
  winner TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player TEXT NOT NULL,
  position TEXT NOT NULL,
  years INTEGER NOT NULL,
  salary NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auction_roster (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL REFERENCES auction(id) ON DELETE CASCADE,
  owner TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player TEXT NOT NULL,
  position TEXT NOT NULL,
  years INTEGER NOT NULL,
  salary NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT 'import', -- import | manual | auction
  -- Set only for source='auction' rows, so editing/deleting a result cascades
  -- to the roster row it created without fragile name/id matching.
  result_id INTEGER REFERENCES auction_result(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auction_pool (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL REFERENCES auction(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  player TEXT NOT NULL,
  position TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available', -- available | nominated | drafted
  rfa BOOLEAN NOT NULL DEFAULT FALSE,
  previous_owner TEXT,
  UNIQUE (auction_id, player_id)
);

CREATE TABLE IF NOT EXISTS auction_current (
  auction_id INTEGER PRIMARY KEY REFERENCES auction(id) ON DELETE CASCADE,
  player_id TEXT,
  player TEXT,
  position TEXT,
  rfa BOOLEAN NOT NULL DEFAULT FALSE,
  previous_owner TEXT,
  high_bid_salary NUMERIC,
  high_bid_years INTEGER,
  high_bidder TEXT,
  timer_ends_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auction_roster_auction ON auction_roster(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_pool_auction ON auction_pool(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_result_auction ON auction_result(auction_id, pick_number);
