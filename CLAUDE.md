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
- `src/lib/` — Data layer and utilities. `sleeper.ts` and `data.ts` fetch from Sleeper API; `sheets.ts` fetches from Google Sheets; `config.ts` has league constants; `ui-utils.ts` has shared color/style utilities.
- `src/components/` — Shared components: `section-label.tsx`, `owner-avatar.tsx`, `player-avatar.tsx`, `trade-card.tsx`, nav, theme provider, shadcn/ui.
- `src/types/` — TypeScript type definitions for Sleeper API and contracts.

## Shared Constants and Utilities

- **League config** (`src/lib/config.ts`): `SALARY_CAP`, `YEARS_CAP`, `DIVISIONS`, `OWNER_DIVISION`, `USERNAME_OVERRIDES`, `SEASON_LEAGUE_IDS`, `NFL_TEAMS`, `ROOKIE_PICK_CONTRACTS`, `REVALIDATE`.
- **UI utilities** (`src/lib/ui-utils.ts`): `ACCENT`, `GOLD`, `WIN_COLOR`, `LOSS_COLOR`, division color maps (`DIVISION_COLORS`, `getDivColors`, `getDivColorsByOwner`), position color helpers, salary bar colors.
- **CSS utilities** (`src/app/globals.css`): `font-heading` (Barlow Condensed via `--font-heading`), `.font-code` (JetBrains Mono).
- **Shared components**: `SectionLabel` (gold-bar section headers), `OwnerLink`/`PlayerLink` (navigation), `PlayerAvatar`/`SleeperAvatarImage` (avatars via next/image).

## Gotchas

- **`force-dynamic` is required** on all `page.tsx` files. Removing it causes build failures because Sleeper API returns 403 during static prerendering.
- **Do not refactor the data layer** (`lib/sleeper.ts`, `lib/data.ts`, `lib/sheets.ts`). Changes there risk breaking API integration.
- **`font-heading` vs `font-code`**: `className="font-heading"` uses Barlow Condensed (mapped to CSS var `--font-heading`). `className="font-code"` uses JetBrains Mono (custom utility class). Do NOT use `className="font-mono"` — the CSS `--font-mono` variable does not include JetBrains Mono.
- **Owner names**: All owner display names go through `USERNAME_OVERRIDES` in config.ts. Use `getDisplayName()` from sleeper.ts to convert Sleeper usernames.
- **Division colors**: Use `getDivColors(division)` or `getDivColorsByOwner(owner)` from ui-utils.ts. Returns `{ text, bg, border }`.
- **Sleeper CDN images**: `sleepercdn.com` is configured in `next.config.ts` remotePatterns. Use `next/image` for all Sleeper-hosted images.
