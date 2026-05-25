@AGENTS.md

# ITTWA Fantasy Football League Site

Dynasty fantasy football league site for the ITTWA league (est. 2014). 12 teams, 4 divisions, salary cap contracts with years.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19
- **Styling**: Tailwind CSS v4, shadcn/ui components, inline styles for data-driven UI
- **Data**: Sleeper API (rosters, matchups, drafts, transactions), Google Sheets (contracts/salaries)
- **Fonts**: Inter (body), Barlow Condensed (headings), JetBrains Mono (data/numbers)
- **Deployment**: Vercel

## Key Directories

- `src/app/` — App Router pages. Each route has a server `page.tsx` (data fetching) and a `*-client.tsx` (interactive UI).
- `src/lib/` — Data layer and utilities. `sleeper.ts` and `data.ts` fetch from Sleeper API; `sheets.ts` fetches from Google Sheets; `config.ts` has league constants; `ui-utils.ts` has shared color/style utilities; `rule-changes.ts` has rule proposal history data.
- `src/components/` — Shared components: `section-label.tsx`, `owner-avatar.tsx`, `player-avatar.tsx`, `trade-card.tsx`, nav, theme provider, shadcn/ui.
- `src/types/` — TypeScript type definitions for Sleeper API and contracts.

## Page Patterns

All pages follow a consistent structure:

- **Container**: Layout provides `<main className="mx-auto max-w-7xl px-4 py-6">`. Pages render directly inside — do NOT add custom max-width or padding wrappers.
- **Page header**: `<div className="pb-6 border-b border-border mb-6">` with gold bar (`w-1 h-7 bg-[#E8B84B] rounded-sm`) + `font-heading text-4xl font-black tracking-[0.04em] uppercase` title + `text-[13px] text-muted-foreground ml-4` subtitle.
- **Quick stats in header**: `flex gap-5` with `font-heading text-[30px] font-extrabold leading-none` values + `text-[10px] text-muted-foreground font-semibold tracking-[0.06em] uppercase` labels.
- **Cards**: `bg-card border border-border rounded-[10px]` with `px-4 py-3.5` padding.
- **Badges**: `rounded-[5px] px-2 py-0.5 text-[11px] font-bold tracking-wide` with dynamic color background/border.
- **Filter controls**: Match the trades page `FilterSelect` pattern — `appearance-none pr-7 pl-3 py-1.5 text-[13px] rounded-lg` with gold active state.
- **Owner avatars**: Fetch via `getLeagueUsers()` server-side, pass `ownerAvatars` prop, wrap client with `OwnerAvatarsProvider`. Use `useOwnerAvatar(name)` + `SleeperAvatarImage` for rendering.

## Shared Constants and Utilities

- **League config** (`src/lib/config.ts`): `SALARY_CAP`, `YEARS_CAP`, `DIVISIONS`, `OWNER_DIVISION`, `USERNAME_OVERRIDES`, `SEASON_LEAGUE_IDS`, `NFL_TEAMS`, `ROOKIE_PICK_CONTRACTS`, `REVALIDATE`.
- **UI utilities** (`src/lib/ui-utils.ts`): `ACCENT`, `GOLD`, `WIN_COLOR`, `LOSS_COLOR`, division color maps (`DIVISION_COLORS`, `getDivColors`, `getDivColorsByOwner`), position color helpers, salary bar colors.
- **CSS utilities** (`src/app/globals.css`): `font-heading` (Barlow Condensed via `--font-heading`), `.font-code` (JetBrains Mono).
- **Shared components**: `SectionLabel` (gold-bar section headers), `OwnerLink`/`PlayerLink` (navigation), `PlayerAvatar`/`SleeperAvatarImage` (avatars via next/image).

## Gotchas

- **`force-dynamic` is required** on all `page.tsx` files that fetch from Sleeper API. Removing it causes build failures because Sleeper API returns 403 during static prerendering. Static pages (like `/constitution`) that only use client-side data are fine without it.
- **Do not refactor the data layer** (`lib/sleeper.ts`, `lib/data.ts`, `lib/sheets.ts`). Changes there risk breaking API integration.
- **`font-heading` vs `font-code`**: `className="font-heading"` uses Barlow Condensed (mapped to CSS var `--font-heading`). `className="font-code"` uses JetBrains Mono (custom utility class). Do NOT use `className="font-mono"` — the CSS `--font-mono` variable does not include JetBrains Mono.
- **Owner names**: All owner display names go through `USERNAME_OVERRIDES` in config.ts. Use `getDisplayName()` from sleeper.ts to convert Sleeper usernames.
- **Division colors**: Use `getDivColors(division)` or `getDivColorsByOwner(owner)` from ui-utils.ts. Returns `{ text, bg, border }`.
- **Sleeper CDN images**: `sleepercdn.com` is configured in `next.config.ts` remotePatterns. Use `next/image` for all Sleeper-hosted images.
- **Sheet player IDs may diverge from Sleeper IDs**: The Google Sheet `playerId` column can have stale values. Player page lookups fall back to name matching when ID match fails. Do not assume Sheet IDs and Sleeper IDs are always in sync.
- **Prefer Tailwind classes over inline styles**: Match existing pages — use `bg-card`, `border-border`, `text-muted-foreground`, etc. Only use inline `style` for dynamic/computed values (colors from data, conditional backgrounds).
