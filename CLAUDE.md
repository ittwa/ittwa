@AGENTS.md

# ITTWA Fantasy Football League Site

Dynasty fantasy football league site for the ITTWA league (est. 2014). 12 teams, 4 divisions, salary cap contracts with years.

## Tech Stack

- Framework: Next.js 16 (App Router) with React 19
- Styling: Tailwind CSS v4, shadcn/ui components, inline styles for data-driven UI
- Data: Sleeper API (rosters, matchups, drafts, transactions), Google Sheets (contracts/salaries)
- Fonts: Inter (body), Barlow Condensed (headings), JetBrains Mono (data/numbers)
- Deployment: Vercel

## Key Directories

- `src/app/` — App Router pages (server `page.tsx` + `*-client.tsx` pattern)
- `src/lib/` — Data layer and utilities
- `src/components/` — Shared components
- `src/types/` — TypeScript type definitions

## Data Architecture

Two data sources, joined by `player_id`:

1. **Sleeper API** — rosters, matchups, drafts, transactions, player metadata. Uses `force-dynamic` because data changes in real-time. Revalidate at 90s.
2. **Google Sheets** — contracts and cap hits only. Two tabs: Contracts and CapHits. Revalidate at 600s. Uses a public API key (server-side only, never expose to client).

**Join key:** `player_id` links Sleeper data to Google Sheets rows. Sheet player IDs can diverge from Sleeper IDs — handle mismatches gracefully (log, don't crash).

**Contract Status field:** If `Active`, show the player on rosters even if salary is $0. A $0/0-year active player is a mid-season waiver pickup who becomes a free agent after the season.

## Contract Value Formula

This is custom league logic. Always use this formula and include inline comments when implementing:

```
Years = 0:  $0       (mid-season pickup, no contract value)
1-year:     Salary × 1.0
2-year:     Salary × 1.4
3-year:     Salary × 1.7
4-year:     Salary × 1.9
5-year:     Salary × 2.0
```

Salary cap is $270. Cap floor is $220 (not counting cap penalties). Years cap is 60 total.

## Cap Hit / Penalty Rules

- Cut with years remaining: penalty = 50% of remaining contract value. Rounded to one decimal.
- Penalty can be lump sum or spread evenly over remaining years. Owner chooses before FA Auction.
- If a cut player is claimed on waivers the same week: no penalty to the cutter, claimer assumes contract.
- Retirement with years remaining: penalty = 25% of remaining contract (half the normal cut penalty).

## Franchise Tag

- Eligible: player rostered and under contract at end of previous season, whose contract just expired.
- Tag salary = higher of: average of top 5 salaries at position, or 120% of previous salary.
- Consecutive tags: Year 2 = 120% of tag salary. Year 3 = 144% of tag salary.

## Page Patterns

- Container: Layout provides `<main className="mx-auto max-w-7xl px-4 py-6">`
- Page header: `pb-6 border-b border-border mb-6` with gold bar + `font-heading` title
- Common patterns: quick stats cards, filter controls, owner avatars, badges

## Shared Constants and Utilities

- `lib/league-config.ts` — league-wide constants
- `lib/ui-utils.ts` — `getDivColors()`, `getDivColorsByOwner()`
- `lib/username-overrides.ts` — `USERNAME_OVERRIDES` map (Sleeper username → display name)
- `globals.css` — `.font-heading` (Barlow Condensed), `.font-code` (JetBrains Mono)

## Do Not Touch

These files are working and fragile. Do not refactor, reorganize, or "improve" them:

- `lib/sleeper.ts`
- `lib/data.ts`
- `lib/sheets.ts`
- `globals.css` theme variables and color values

## Gotchas

- `force-dynamic` is required on Sleeper API pages — do not remove it
- `font-heading` = Barlow Condensed (CSS var). `font-code` = JetBrains Mono (utility class, not the same as Tailwind's `font-mono`)
- Owner display names always go through `USERNAME_OVERRIDES`, never use raw Sleeper usernames in UI
- Division colors via `getDivColors()`/`getDivColorsByOwner()` — do not hardcode division color values
- Sleeper CDN images must use `next/image` (already in `next.config.ts` remotePatterns)
- Prefer Tailwind classes over inline styles. Only use inline styles for truly dynamic values (computed colors, percentages, conditionals)

## How I Work

- For large file changes, use a skeleton-first approach: write the structure, then fill sections with `str_replace`. Do not attempt to rewrite entire large files in a single response — this causes stream idle timeouts.
- Always run `npm run build` after changes to verify nothing is broken.
- Commit after each logical unit of work, not at the end of a big batch.
- When in doubt about whether a change is safe, leave a `// TODO` comment instead of guessing.
