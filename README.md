# ITTWA — I Thought This Was America

The official site for the ITTWA contract dynasty fantasy football league, est. 2014. 12 teams across 4 divisions, competing under a salary cap with multi-year contracts, a rookie draft, and a free agent auction.

Built with Next.js 16, React 19, and Tailwind CSS v4. Live data from the Sleeper API and Google Sheets.

**Deployed on Vercel** — updates automatically on push to `main`.

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | League overview and quick links |
| Standings | `/standings` | Live standings with division records and tiebreakers |
| Power Rankings | `/power-rankings` | All-Play win % with Luck Index |
| Matchups | `/matchups` | Weekly head-to-head scores by week |
| Schedule | `/schedule` | Full season schedule grid |
| Teams | `/teams/[owner]` | Roster, salary cap breakdown, schedule, and depth chart |
| Player Profile | `/players/[playerId]` | Bio, stats, contract history, and depth chart position |
| Contracts | `/contracts` | Full contract database with salary and years |
| Cap Hits | `/cap-hits` | Dead cap penalties and cap hit projections |
| Free Agents | `/free-agents` | Expiring contracts and upcoming free agents |
| Trade Analyzer | `/trade-analyzer` | Contract-adjusted dynasty trade value analyzer |
| Tag Tracker | `/tags` | Franchise & 5th-year tag history, insights, and eligibility |
| Data Check | `/data-check` | Reconciles Contracts sheet rosters against live Sleeper rosters |
| Auction | `/auction` | Live free agent auction board — public, updates every few seconds |
| Auction Admin | `/auction/admin` | Commissioner-only console for running the auction (PIN-protected) |
| Records | `/records` | All-time league records and superlatives |
| Rivalry | `/rivalry` | 12×12 all-time head-to-head matrix |
| Drafts | `/drafts` | Rookie draft history with pick values and future pick matrix |
| Trades | `/trades` | Full trade log pulled from Sleeper |
| Constitution | `/constitution` | Full league rules reference |
| Rule Changes | `/rule-changes` | Proposal history with vote results and status |

## Data Sources

| Data | Source | Revalidation |
|------|--------|-------------|
| Rosters, matchups, trades, drafts | Sleeper API | 5 min – 24h depending on endpoint |
| Contracts, cap hits | Google Sheets (2 tabs) | 10 min |

The two sources are joined by `player_id`. The Google Sheet is the source of truth for contract data; Sleeper is the source of truth for everything else.

The Free Agent Auction (`/auction`, `/auction/admin`) is the one exception: its starting state is *derived* from the Sheet + Sleeper at setup time, but once the commissioner clicks "Start Auction" that state is snapshotted into a Postgres database (Neon), which becomes the single source of truth for the rest of the auction. The Sheet and Sleeper are never re-read mid-auction.

## League Structure

- **12 teams**, **4 divisions** (Concussion, Hey Arnold, Replacements, Dark Knight Rises)
- **Salary cap:** $270 · **Cap floor:** $220 · **Years cap:** 60 total
- **Roster size:** 22
- **FAAB budget:** $100
- **3-round rookie draft** with preset contract values (Round 1: $8–$14 × 4yr, Round 2: $2–$7 × 4yr)
- **Free agent auction** with contract value multipliers (1yr: 1.0×, 2yr: 1.4×, 3yr: 1.7×, 4yr: 1.9×, 5yr: 2.0×)
- **Payouts:** 1st $1,250 · 2nd $300 · 3rd $150 · Points Leader $100

## Setup

### 1. Google Sheets API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google Sheets API**
3. Create an API key and restrict it to Google Sheets API only
4. Make the league spreadsheet publicly viewable (Share → Anyone with the link → Viewer)

### 2. Environment Variables

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SLEEPER_LEAGUE_ID=1351401929883807744
NEXT_PUBLIC_GOOGLE_SHEETS_ID=17kspYjtSNtiBuUxbdWYkHbP8Y5K7qs0nJ-D1VA-Wpwo
GOOGLE_API_KEY=your_google_api_key_here
NEON_DATABASE_URL=your_neon_postgres_connection_string
AUCTION_ADMIN_PIN=a_pin_only_the_commissioner_knows
```

> `GOOGLE_API_KEY` is server-side only — do **not** use the `NEXT_PUBLIC_` prefix. Same goes for `NEON_DATABASE_URL` and `AUCTION_ADMIN_PIN`.

### 3. Free Agent Auction database (one-time, non-developer friendly)

The auction feature needs a Postgres database (already provisioned via the Vercel Marketplace as **Neon**) and a commissioner PIN. Nothing else — no accounts, no extra services.

1. **Get the connection string.** In Vercel: Project → Storage → your Neon database → copy the connection string (this project's Neon integration exposes it as `NEON_DATABASE_URL`). Paste it into `.env.local` as `NEON_DATABASE_URL` for local work — Vercel already injects it automatically in deployed environments once the database is connected to the project.
2. **Pick a PIN.** Any string works — set it as `AUCTION_ADMIN_PIN` in `.env.local`. This is the only thing that gates `/auction/admin`; owners visiting `/auction` need nothing.
3. **Run the migration** (creates the auction tables — safe to re-run, it won't touch existing data):
   ```bash
   npm run db:migrate
   ```
4. **Set the same two variables in Vercel** (Project Settings → Environment Variables) for **all three environments** — Production, Preview, and Development — then redeploy. `NEON_DATABASE_URL` is usually already there if the Neon integration is connected; you only need to add `AUCTION_ADMIN_PIN` yourself.
5. **(Optional) Seed mock data** to see every screen state locally without touching real league data:
   ```bash
   npm run db:seed:auction
   ```
   This wipes any existing auction and creates a fake one "mid-flight" — some picks already awarded, a player currently on the block with a bid in progress. Visit `/auction` and `/auction/admin` (PIN from your `.env.local`) to see it. Run the migration again afterward if you want a clean slate (see the Runbook below for the in-app reset button instead).

### 4. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Run Tests

```bash
npm test
```

Vitest unit tests cover pure data-layer logic (Luck Index, head-to-head records, tag eligibility, weekly recaps, sheet/roster reconciliation, and the auction's derivation + bid-rules engine in `lib/auction.test.ts`).

### 6. Deploy

Push to GitHub and import in [Vercel](https://vercel.com). Add the environment variables above under Project Settings → Environment Variables (all three environments for `AUCTION_ADMIN_PIN` — see step 3 above).

## Auction Night Runbook

The exact click-path for running the live Free Agent Auction, end to end.

### Before the call

1. Go to `/auction/admin` and enter the PIN.
2. **Setup → Season.** Confirm the season selector shows the right year, then click **Derive Auction State**. This pulls current rosters, cap hits, and the free agent pool straight from the Sheet and Sleeper — nothing is saved yet.
3. **Review screen — double-check before starting, this is the important part:**
   - Read every warning banner at the top (mismatched player IDs, mid-season-pickup rows, missing sheet data for the season).
   - **Recent cuts:** expand each owner's roster and confirm anyone cut since the last sheet update isn't still listed. Use "Move to FA pool" to fix it on the spot.
   - **Franchise tags:** confirm tagged players show the correct salary (top-5 positional average or 120%/144% of a repeat tag) and are sitting on the right owner's roster.
   - **Trades:** confirm any offseason trades already reflect the new owner. If a contract is on the wrong roster, remove it and use "+ Add missing contract" under the correct owner.
   - **Cap hits:** if an owner's dead money looks wrong (a cut penalty not yet on the sheet, etc.), type the correct number directly into their Cap Hit box — it's marked "edited" so you can see what you changed.
   - If something looks off and you're not sure why, click **Reload from Sheet** to re-derive from scratch and start the review again (this discards any edits made on this screen).
4. **Nomination order.** Drag owners into the order they'll nominate in (or use the arrow buttons). This can be edited later per-pick via "Override nominator" if someone's away from the call.
5. Click **Start Auction**. From this point the database is the source of truth — the review screen is gone, and the Sheet/Sleeper are no longer read.

### During the call

6. Share the `/auction` link with all 12 owners — no login needed, it refreshes itself every few seconds.
7. **Nominate:** search the free agent pool and click a player, or use "Write-in" for someone missing from the derived pool (rare, but covers a name mismatch or a very deep sleeper). "Override nominator" is a one-time swap for this pick only — it doesn't change the rotation.
8. **Track bidding (optional):** if you want the "Bid to Beat" table on the public board to update as bidding happens, expand "Track Bidding" and enter the current salary/years/bidder as the room calls it out. You can skip this entirely and go straight to Award if the room is moving fast.
9. **Award:** pick the winner, final salary, and final years, then click **Award**. If the deal busts that owner's max bid, max years, or cash, you'll see a warning — it's informational only, the award still goes through. This is the commissioner's call, not the app's.
10. Made a mistake? **Undo Last** reverses the most recent award and rewinds the nomination order by one. Any older pick can be fixed with the **Edit** or **Delete** links in the Recent Results list.
11. **Pause/Resume** if the call needs a break — the public board shows "Paused" clearly. A confirm-guarded **Reset** is available for practice runs only; it deletes everything for the current auction.

### After the call

12. Click **Mark Complete** — the public `/auction` board becomes the permanent final record for the season.
13. Click **Export CSV**. Check "Player ID" first if you want a `Player ID` column included (makes it much faster to paste results into the Contracts tab, which is keyed on `player_id`). The file downloads as `ittwa-fa-auction-{season}.csv` in the exact old Drafted Players format: `ID, Nominator, Owner, Player, Position, Years, Salary`.
14. Manually enter the CSV results into the Google Sheet's Contracts tab for next season — the auction does not write back to the Sheet automatically (by design, see Out of Scope).

## Tech Stack

- **Next.js 16** (App Router) with **React 19** and **TypeScript 5**
- **Tailwind CSS v4** with custom dark theme and **shadcn/ui** components
- **Sleeper API** — rosters, matchups, trades, drafts, player metadata
- **Google Sheets API v4** — contracts and cap hits (server-side only)
- **Neon Postgres** (`@neondatabase/serverless`) — auction state once the auction is live
- **SWR** — polling for the live auction board and admin console
- **Fonts:** Inter (body), Barlow Condensed (headings), JetBrains Mono (data tables)
