# ITTWA — I Thought This Was America

A modern web application for the ITTWA contract dynasty fantasy football league, founded in 2014. Built with Next.js, Tailwind CSS, and live data from the Sleeper API and Google Sheets.

## Features

- **Live Standings** with full tiebreaker logic
- **Power Rankings** using All-Play methodology with Luck Index
- **Contract Database** with salary cap tracking
- **Team Pages** with rosters, schedules, and cap summaries
- **Head-to-Head Rivalry Tracker** with full 12x12 matrix
- **Draft History** with rookie contract values
- **Trade Log** from Sleeper
- **League Constitution** with full rules reference

## Setup

### 1. Get a Google API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the **Google Sheets API** under APIs & Services > Library
4. Create an API key under APIs & Services > Credentials
5. Restrict the key to the Google Sheets API only

### 2. Make the Google Sheet Public

The league's contract spreadsheet must be publicly viewable:

1. Open the Google Sheet
2. Click Share > General Access > "Anyone with the link" > Viewer

### 3. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your values:

```
NEXT_PUBLIC_SLEEPER_LEAGUE_ID=1215789390190624768
NEXT_PUBLIC_GOOGLE_SHEETS_ID=17kspYjtSNtiBuUxbdWYkHbP8Y5K7qs0nJ-D1VA-Wpwo
GOOGLE_API_KEY=your_google_api_key_here
```

> **Important:** `GOOGLE_API_KEY` must NOT use the `NEXT_PUBLIC_` prefix — it is server-side only and should never be exposed to the browser.

### 4. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy to Vercel

1. Push your repo to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add environment variables under Project Settings > Environment Variables:
   - `NEXT_PUBLIC_SLEEPER_LEAGUE_ID`
   - `NEXT_PUBLIC_GOOGLE_SHEETS_ID`
   - `GOOGLE_API_KEY`
4. Deploy

## Tech Stack

- **Next.js** (App Router) with TypeScript
- **Tailwind CSS** with custom dark theme
- **Sleeper API** — scores, rosters, matchups, trades, drafts
- **Google Sheets API v4** — contracts and cap hits (server-side only)

## Data Sources

| Data | Source | Cache |
|------|--------|-------|
| NFL Players | Sleeper API | 24 hours |
| Rosters / League | Sleeper API | 1 hour |
| Matchups / Scores | Sleeper API | 5 minutes |
| Contracts / Cap Hits | Google Sheets | 10 minutes |
