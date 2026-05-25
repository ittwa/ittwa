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
| Drafts | `/drafts` | Rookie draft history with pick values and future pick matrix |
| Trades | `/trades` | Full trade log pulled from Sleeper |
| Rivalry | `/rivalry` | 12×12 all-time head-to-head matrix |
| Records | `/records` | All-time league records and superlatives |
| Rule Changes | `/rule-changes` | Proposal history with vote results and status |
| Constitution | `/constitution` | Full league rules reference |

## Data Sources

| Data | Source | Revalidation |
|------|--------|-------------|
| Rosters, matchups, trades, drafts | Sleeper API | 90s – 24h depending on endpoint |
| Contracts, cap hits | Google Sheets (2 tabs) | 10 min |

The two sources are joined by `player_id`. The Google Sheet is the source of truth for contract data; Sleeper is the source of truth for everything else.

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
```

> `GOOGLE_API_KEY` is server-side only — do **not** use the `NEXT_PUBLIC_` prefix.

### 3. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Deploy

Push to GitHub and import in [Vercel](https://vercel.com). Add the three environment variables above under Project Settings → Environment Variables.

## Tech Stack

- **Next.js 16** (App Router) with **React 19** and **TypeScript 5**
- **Tailwind CSS v4** with custom dark theme and **shadcn/ui** components
- **Sleeper API** — rosters, matchups, trades, drafts, player metadata
- **Google Sheets API v4** — contracts and cap hits (server-side only)
- **Fonts:** Inter (body), Barlow Condensed (headings), JetBrains Mono (data tables)
