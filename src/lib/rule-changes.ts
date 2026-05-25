export type RuleStatus = 'Passed' | 'Denied' | 'Pending';

export type RuleChange = {
  season: number;
  rule: string;
  description: string;
  proposedBy: string;
  result: RuleStatus;
  implementedSeason?: number | null;
};

export const ruleChanges: RuleChange[] = [
  // --- 2024 ---
  { season: 2024, rule: "Franchise Tag Free Agents", description: "Add the ability to franchise tag free agents", proposedBy: "Hogan", result: "Pending", implementedSeason: null },

  // --- 2023 ---
  { season: 2023, rule: "Lower Rookie Draft Pick Time", description: "Reduce the pick timer in the rookie draft to 6 hours", proposedBy: "Everyone", result: "Passed", implementedSeason: 2023 },

  // --- 2022 ---
  { season: 2022, rule: "Push Back Trade Deadline", description: "Move the trade deadline from Week 10 to Week 11", proposedBy: "Durkin", result: "Passed", implementedSeason: 2022 },
  { season: 2022, rule: "Change Sacko to IHOP Challenge", description: "Change the Sacko punishment to a variation of the IHOP challenge", proposedBy: "—", result: "Passed", implementedSeason: 2022 },
  { season: 2022, rule: "Increase Buy-In to $200", description: "Raise annual dues from $150 to $200", proposedBy: "Cummings", result: "Passed", implementedSeason: 2022 },
  { season: 2022, rule: "Update Payouts", description: "Change payouts to 1300/600/300/200 (max PF)", proposedBy: "Cummings", result: "Passed", implementedSeason: 2022 },
  { season: 2022, rule: "Higher 3rd Place Payout", description: "Increase the 3rd place payout", proposedBy: "Cummings", result: "Passed", implementedSeason: 2022 },
  { season: 2022, rule: "Last Wildcard is Most Points", description: "Award the last wildcard playoff spot to the team with the most regular season points", proposedBy: "Tiger", result: "Denied", implementedSeason: null },
  { season: 2022, rule: "Pay Out Highest Weekly Score", description: "Add a payout for the highest single-week score", proposedBy: "Cummings", result: "Denied", implementedSeason: null },
  { season: 2022, rule: "Pay Out End-of-Year Superlatives", description: "Add payouts for end-of-year superlative awards", proposedBy: "Cummings", result: "Denied", implementedSeason: null },
  { season: 2022, rule: "Get Rid of Cap Years", description: "Remove the years cap from the salary system", proposedBy: "Peterson", result: "Denied", implementedSeason: null },
  { season: 2022, rule: "Best Ball Format", description: "Switch to a best ball format", proposedBy: "Tiger", result: "Denied", implementedSeason: null },
  { season: 2022, rule: "Allow Trading Cap Hits", description: "Allow owners to trade cap hit penalties to other teams", proposedBy: "Chapman", result: "Denied", implementedSeason: null },
  { season: 2022, rule: "Move Waivers to Wednesday", description: "Move waiver processing from Thursday to Wednesday", proposedBy: "Durkin", result: "Denied", implementedSeason: null },
  { season: 2022, rule: "Bring Kickers Back", description: "Add kickers back to the roster", proposedBy: "Katz, Liam", result: "Denied", implementedSeason: null },
  { season: 2022, rule: "Increase IR Spots", description: "Add more IR spots to team rosters", proposedBy: "Katz", result: "Denied", implementedSeason: null },
  { season: 2022, rule: "Expand Playoffs to 7 Teams", description: "Expand playoffs to 7 teams so only the top seed gets a bye", proposedBy: "Peterson", result: "Denied", implementedSeason: null },
  { season: 2022, rule: "Push Back Trade Deadline (Hogan)", description: "Move the trade deadline to a later week", proposedBy: "Hogan", result: "Denied", implementedSeason: null },
  { season: 2022, rule: "Don't Lock Playoff Rosters", description: "Remove the roster lock for teams in the playoffs", proposedBy: "Hogan", result: "Denied", implementedSeason: null },

  // --- 2021 ---
  { season: 2021, rule: "Move from GroupMe to Discord", description: "Switch the league's communication platform from GroupMe to Discord", proposedBy: "Tiger", result: "Passed", implementedSeason: 2021 },
  { season: 2021, rule: "Bid Up Yourself Post-Auction", description: "Allow an owner to change their winning auction bid to a higher contract value after winning", proposedBy: "Chapman", result: "Passed", implementedSeason: 2021 },
  { season: 2021, rule: "Remove Trade Stamp Requirement", description: "Remove the requirement for owners to \"stamp\" (confirm) trades", proposedBy: "Tiger", result: "Passed", implementedSeason: 2021 },
  { season: 2021, rule: "Change Cut Deadline", description: "Move the cut deadline to the week before the FA auction", proposedBy: "Jorge", result: "Passed", implementedSeason: 2021 },
  { season: 2021, rule: "Allow Post-Lock Drops", description: "Allow owners to drop players after rosters lock (no additions allowed)", proposedBy: "Durkin", result: "Passed", implementedSeason: 2021 },
  { season: 2021, rule: "Disallow One-Way Expiring Trades", description: "Prohibit one-way trades involving players on expiring contracts", proposedBy: "Tiger", result: "Passed", implementedSeason: 2021 },
  { season: 2021, rule: "Add Third Rookie Draft Round", description: "Add a 3rd round to the rookie draft with 3-year $1 contracts, not guaranteed until the auction draft", proposedBy: "Durkin", result: "Passed", implementedSeason: 2021 },
  { season: 2021, rule: "Jail, War, or Death Clause", description: "If a player goes to jail, war, or dies, their contract is voided and can be cut with retiree cap hit rules", proposedBy: "Durkin", result: "Passed", implementedSeason: 2021 },
  { season: 2021, rule: "Trade Cap Hits", description: "Allow trading of cap hit penalties between teams", proposedBy: "Chapman", result: "Pending", implementedSeason: null },

  // --- 2020 ---
  { season: 2020, rule: "Schedule Change", description: "Update the schedule to reflect the NFL's 17-game season", proposedBy: "Durkin", result: "Passed", implementedSeason: 2021 },
  { season: 2020, rule: "Ownership of Team", description: "Owners cannot sell their team to a new potential member; the league owns the rights to the team", proposedBy: "Clancy", result: "Passed", implementedSeason: 2021 },
  { season: 2020, rule: "Contracts for Waiver Pickups", description: "Remove the assumption of existing contracts for waiver wire pickups in the same week they were dropped", proposedBy: "Clancy", result: "Passed", implementedSeason: 2021 },
  { season: 2020, rule: "Increase Safety Scoring", description: "Make safeties worth 4 points instead of 2", proposedBy: "Peterson", result: "Passed", implementedSeason: 2021 },
  { season: 2020, rule: "Sacko Punishment", description: "Sacko must take 1 shot of beer every auction selection or 3 shots of water", proposedBy: "Durkin", result: "Passed", implementedSeason: 2021 },
  { season: 2020, rule: "Award Shitty League Trophy", description: "Award the winner with a cheap, shitty league trophy", proposedBy: "—", result: "Passed", implementedSeason: 2021 },
  { season: 2020, rule: "Add Fifth Year Player Options", description: "Add 5th year player options on first round rookie picks", proposedBy: "Peterson", result: "Passed", implementedSeason: 2021 },
  { season: 2020, rule: "Allow Only Injured Players on IR", description: "Only injured players (not suspended or holdout) are eligible for IR", proposedBy: "Clancy", result: "Passed", implementedSeason: 2021 },
  { season: 2020, rule: "Remove Claims on Same-Week Cuts", description: "Remove the assumption of contracts for players cut and claimed in the same week", proposedBy: "Clancy", result: "Passed", implementedSeason: 2021 },
  { season: 2020, rule: "Sacko Goes to Worst Record", description: "Sacko recipient is determined by worst record; draft order still decided by optimal scoring", proposedBy: "Durkin", result: "Passed", implementedSeason: 2020 },
  { season: 2020, rule: "Change Payout Structure", description: "Change payouts to 1250/300/150 + $100 for most points in the regular season", proposedBy: "Cummings", result: "Passed", implementedSeason: 2020 },
  { season: 2020, rule: "Change Waiver Schedule", description: "Switch from waivers to free agency on game days", proposedBy: "Clancy", result: "Passed", implementedSeason: 2020 },
  { season: 2020, rule: "Change 5th Year Extension Value", description: "Change value of 5th year rookie extensions to 75% of the previous season's franchise tag amount; must be declared a year before contract expires", proposedBy: "Peterson", result: "Passed", implementedSeason: 2021 },
  { season: 2020, rule: "Change TE to TE/WR", description: "Allow WRs to be eligible for the TE roster position", proposedBy: "Peterson", result: "Denied", implementedSeason: null },
  { season: 2020, rule: "Don't Trade Tag Rights", description: "Restrict franchise tag to one player; if you want to trade that player, you must tag first then trade", proposedBy: "Williams", result: "Denied", implementedSeason: null },
  { season: 2020, rule: "Increase Tanking Punishment", description: "If an owner starts a player who isn't playing, the owner gets an automatic loss and a $10 cap hit", proposedBy: "Williams", result: "Denied", implementedSeason: null },
  { season: 2020, rule: "Redraft Divisions Every 4 Seasons", description: "Redraft league divisions on a 4-year cycle", proposedBy: "Durkin", result: "Denied", implementedSeason: null },
  { season: 2020, rule: "League Median Matchup", description: "Add a second weekly matchup against the league's median score, doubling regular season games from 13 to 26", proposedBy: "Peterson", result: "Denied", implementedSeason: null },
  { season: 2020, rule: "Normalize Salaries", description: "Convert the salary cap ceiling to $100 and adjust all salaries proportionally", proposedBy: "Clancy", result: "Denied", implementedSeason: null },

  // --- 2019 ---
  { season: 2019, rule: "Extend Contracts in Lockout", description: "If a lockout occurs and fewer than 12 NFL games are played, all contracts are extended by one additional year", proposedBy: "Durkin", result: "Passed", implementedSeason: 2019 },
  { season: 2019, rule: "Change Payout Structure", description: "Change payouts to 1350/300/150", proposedBy: "Clancy", result: "Passed", implementedSeason: 2019 },
  { season: 2019, rule: "League Trophy", description: "Purchase an ITTWA trophy for the champion — must be a cheap, shitty trophy", proposedBy: "Bohne", result: "Passed", implementedSeason: 2019 },
  { season: 2019, rule: "Player Options", description: "Add 5th year player options on first round picks; average of top 10 salaries for a top 6 pick, average of top 25 for picks 6-12; starts with the 2018 rookie class", proposedBy: "Peterson", result: "Passed", implementedSeason: 2018 },
  { season: 2019, rule: "Allow Trading Cash", description: "Bring back the ability to trade cash between owners", proposedBy: "HoganLamb", result: "Denied", implementedSeason: null },
  { season: 2019, rule: "Next 5-Year Payout", description: "Figure out what to do for the next 5-year bonus, if anything", proposedBy: "Clancy", result: "Denied", implementedSeason: null },
  { season: 2019, rule: "Compensatory Picks", description: "If a starting-caliber player is lost (top 12 QB, 24 RB, 36 WR), the owner gets a compensatory pick at the end of the next draft", proposedBy: "Durkin", result: "Denied", implementedSeason: null },

  // --- 2018 ---
  { season: 2018, rule: "Increase Roster Size", description: "Add 2 more roster spots (max 22) and 5 more years to the years cap (max 60)", proposedBy: "HoganLamb", result: "Passed", implementedSeason: 2019 },
  { season: 2018, rule: "Change Rookie Contracts", description: "Change contract amounts and years for rookie draft picks; add first round tenders", proposedBy: "Williams", result: "Passed", implementedSeason: 2018 },
  { season: 2018, rule: "Keep Same Divisions", description: "Do not redraft divisions every year; keep them consistent to develop rivalries and mimic the NFL", proposedBy: "Albarran", result: "Passed", implementedSeason: 2018 },
  { season: 2018, rule: "FA on Sundays and Mondays", description: "Switch from waivers to free agency on Sundays and Mondays for last-minute transactions", proposedBy: "Clancy", result: "Passed", implementedSeason: 2018 },
  { season: 2018, rule: "Trade RFA Rights", description: "Allow trading of Restricted Free Agent (RFA/MATCH) rights", proposedBy: "Durkin", result: "Passed", implementedSeason: 2018 },
  { season: 2018, rule: "Trade Future Draft Picks", description: "Allow trading of rookie draft picks up to 2 years in advance", proposedBy: "Collins", result: "Passed", implementedSeason: 2018 },
  { season: 2018, rule: "Optimal Lineup for Draft Order", description: "Use optimal lineup scores instead of actual scores to determine draft order for non-playoff teams", proposedBy: "Albarran", result: "Passed", implementedSeason: 2018 },
  { season: 2018, rule: "Increase IR Spots to 4", description: "Increase the number of IR spots to 4", proposedBy: "Williams", result: "Passed", implementedSeason: 2018 },
  { season: 2018, rule: "Disallow Trading Cash", description: "Do not allow trading cash; only players and picks can be traded", proposedBy: "Clancy", result: "Passed", implementedSeason: 2018 },
  { season: 2018, rule: "Final Year Cap Hit Removal", description: "No cap hit penalty for a player cut in the final year of his contract", proposedBy: "Brown", result: "Passed", implementedSeason: 2018 },
  { season: 2018, rule: "Retirement Cap Hits", description: "If a player retires, the owner is charged half the normal cap hit (1/4 of the remaining contract value) to cut the player", proposedBy: "Clancy", result: "Passed", implementedSeason: 2018 },
  { season: 2018, rule: "Allow Matching for One-Way Trades", description: "If a player is traded for nothing or just cash, lock the trade for 24 hours to allow competing offers", proposedBy: "Clancy", result: "Denied", implementedSeason: null },
  { season: 2018, rule: "Retirement Cap Hit Relief", description: "If a player retires after you cut him, you are relieved of all outstanding cap hits", proposedBy: "Katz", result: "Denied", implementedSeason: null },

  // --- 2017 ---
  { season: 2017, rule: "Secondary Tiebreaker is Division Record", description: "Second tiebreaker (after H2H record) is division record", proposedBy: "HoganLamb", result: "Passed", implementedSeason: 2017 },
  { season: 2017, rule: "Sacko Hosts Opening Weekend Party", description: "Sacko must host an NFL opening weekend party with ~$60 of booze, serve everyone drinks, and be called a derogatory name TBD", proposedBy: "Clancy", result: "Passed", implementedSeason: 2018 },
  { season: 2017, rule: "Retirement Contracts", description: "If a player retires, the owner is charged 1/4 of the remaining contract value if they choose to cut the player", proposedBy: "Clancy", result: "Passed", implementedSeason: 2018 },
  { season: 2017, rule: "Increase Buy-In to $150", description: "Raise annual dues from $100 to $150", proposedBy: "Clancy", result: "Passed", implementedSeason: 2017 },
  { season: 2017, rule: "Half PPR", description: "Change scoring to half-PPR (0.5 points per reception)", proposedBy: "Peterson", result: "Passed", implementedSeason: 2018 },
  { season: 2017, rule: "Decimal Scoring", description: "Change to decimal scoring (0.1 points per yard instead of 1 point per 10 yards)", proposedBy: "Williams", result: "Passed", implementedSeason: 2017 },
  { season: 2017, rule: "Waive Draft Picks", description: "Allow the option to skip a rookie draft pick to avoid receiving that player's contract", proposedBy: "Durkin", result: "Passed", implementedSeason: 2018 },
  { season: 2017, rule: "Draft Divisions", description: "Top four teams from the prior season snake-draft the next year's divisions", proposedBy: "Clancy", result: "Passed", implementedSeason: 2017 },
  { season: 2017, rule: "Dues and Tanking Fines", description: "$10 fine for failure to pay dues by FA draft or failure to set a lineup; owner chooses real cash or $10 cap hit next season", proposedBy: "Clancy", result: "Passed", implementedSeason: 2017 },
  { season: 2017, rule: "Sacko Hosts Auction", description: "The Sacko loser hosts the next season's FA auction", proposedBy: "—", result: "Passed", implementedSeason: 2017 },
  { season: 2017, rule: "Trade Draft Picks 2 Years in Advance", description: "Allow trading of rookie draft picks for up to 2 years in advance", proposedBy: "Collins", result: "Passed", implementedSeason: 2018 },
  { season: 2017, rule: "Trade RFA Rights", description: "Allow trading of RFA rights (the ability to match the highest bid in FA auction)", proposedBy: "Durkin", result: "Passed", implementedSeason: 2018 },
  { season: 2017, rule: "Keep Same Divisions Every Year", description: "Do not redraft divisions; keep them consistent year-over-year to develop rivalries", proposedBy: "Albarran", result: "Passed", implementedSeason: 2018 },
  { season: 2017, rule: "Change Rookie Contract Values", description: "Change contracts of rookie picks and add first round tenders", proposedBy: "Williams", result: "Passed", implementedSeason: 2018 },
  { season: 2017, rule: "Option to Swap Draft Picks", description: "Allow trading the option to swap draft picks in the next year's draft", proposedBy: "Clancy", result: "Denied", implementedSeason: null },
  { season: 2017, rule: "Add Practice Squad", description: "Add a practice squad with separate budget and slots for stashing rookies", proposedBy: "Williams", result: "Denied", implementedSeason: null },
  { season: 2017, rule: "Change DEF Scoring", description: "Overhaul defensive scoring based on a Reddit-sourced alternative system", proposedBy: "HoganLamb", result: "Denied", implementedSeason: null },
];
