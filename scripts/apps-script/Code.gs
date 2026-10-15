/**
 * ═══════════════════════════════════════════════════════════════════
 *  ITTWA ADMIN — Sleeper → Google Sheets transaction automation
 * ═══════════════════════════════════════════════════════════════════
 *
 *  What it does:
 *   • Pulls every add / cut / trade from the Sleeper API
 *   • Writes new ones to a "Transaction Inbox" tab for your review
 *   • On Apply, performs the exact row surgery you do by hand:
 *       CUT   → Contract Status = "Cut", new CapHits row (copies the
 *               row above so formulas F,G,H,N+ drag down automatically)
 *       ADD   → new Contracts row ($0 / 0 yr, Status Active)
 *       TRADE → old row = "Traded", duplicated row for the new owner
 *   • Waiver / FA pickups NEVER inherit a contract. A dropped player is
 *     immediately a free agent at $0 / 0 — including when he is claimed
 *     the same week he was cut. (The old Section 9 "claimer assumes the
 *     contract" rule was repealed in 2021; CLAIM rows are no longer made.)
 *   • Owner mapping is derived automatically by comparing Sleeper
 *     rosters to Active contracts (same approach as the site's
 *     reconcile.ts) — no mapping tab to maintain.
 *
 *  Menu (appears after you open the sheet): 🏈 ITTWA Admin
 *
 *  YEARLY CHECKLIST (before FA Auction):
 *   1. Update LEAGUE_ID — Sleeper issues a NEW league id every season.
 *   2. Update SEASON.
 * ═══════════════════════════════════════════════════════════════════
 */

const CONFIG = {
  LEAGUE_ID: '1351401929883807744', // ⚠️ changes every season in Sleeper
  SEASON: '2026',                   // ⚠️ update each year

  AUTO_APPLY: false,   // flip to true after a few trusted weeks
  NOTIFY_EMAIL: '',    // optional: your email → get a summary when new items land

  PICKUP_SALARY: 0,    // in-season pickup contract terms
  PICKUP_YEARS: 0,
  DEFAULT_CAP_HIT_TYPE: 'Split',

  TABS: {
    contracts: 'Contracts',
    capHits: 'CapHits',
    inbox: 'Transaction Inbox',
    log: 'Automation Log',
    playerDb: 'PlayerDB', // hidden helper tab, built on demand
  },
};

// ── Column positions (1-based) ─────────────────────────────────────
// Contracts: A player_id, B Season, C Owner, D Player, E Position,
// F Years, G Salary, H DP Original Owner, I Draft Pick ID,
// J Contract Status, K Contract Start Year, L Original Pick,
// M Franchise Tag, N 5th Year Tag, O 5th Year Tag Amount
const C = { PID: 1, SEASON: 2, OWNER: 3, PLAYER: 4, POS: 5, YEARS: 6, SALARY: 7,
  DP_OWNER: 8, DP_ID: 9, STATUS: 10, START: 11, ORIG_PICK: 12, FTAG: 13, TAG5: 14, TAG5_AMT: 15 };

// CapHits: A Season, B Week, C Retire, D Claim, E Cap Hit Type,
// F Check*, G Diff*, H First Season*, I Owner, J Player, K Position,
// L Years, M Salary, N Cap Hit*, O+ formulas   (* = formula columns)
const H = { SEASON: 1, WEEK: 2, RETIRE: 3, CLAIM: 4, TYPE: 5,
  OWNER: 9, PLAYER: 10, POS: 11, YEARS: 12, SALARY: 13 };

// Inbox layout
const IB = { KEY: 1, DATE: 2, WEEK: 3, TYPE: 4, PLAYER: 5, POS: 6, FROM: 7, TO: 8,
  ACTION: 9, STATUS: 10, NOTES: 11, DATA: 12 };
const IB_HEADERS = ['Key', 'Date', 'Week', 'Type', 'Player', 'Pos', 'From', 'To',
  'Proposed Action', 'Status', 'Notes', 'Data (do not edit)'];
const STATUSES = ['Pending', 'Approved', 'Applied', 'Skipped', 'Error', 'Needs Review'];

// Types the scheduler will never auto-apply — these always wait for you.
// (CLAIM stays listed only so legacy inbox rows are never auto-applied.)
const MANUAL_ONLY = ['CLAIM', 'PICK TRADE', 'UNKNOWN'];

// ═══════════════════════════════════════════════════════════════════
//  MENU
// ═══════════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏈 ITTWA Admin')
    .addItem('🔄 Check Sleeper for new transactions', 'checkSleeperNow')
    .addItem('✅ Apply APPROVED rows', 'applyApproved')
    .addItem('⚡ Apply ALL pending rows', 'applyAllPending')
    .addItem('⏩ Mark as up to date (ignore older transactions)', 'setBaselineNow')
    .addSeparator()
    .addItem('🕒 Enable daily auto-check (7am)', 'enableDailyTrigger')
    .addItem('🛑 Disable daily auto-check', 'disableDailyTrigger')
    .addSeparator()
    .addItem('🧑‍🤝‍🧑 Show owner map', 'showOwnerMap')
    .addItem('📖 Refresh Player DB (~1 min)', 'refreshPlayerDb')
    .addItem('🧹 Convert old Section 9 CLAIM rows → $0/0 ADD', 'convertLegacyClaims')
    .addToUi();
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN: fetch Sleeper transactions → Inbox
// ═══════════════════════════════════════════════════════════════════

function checkSleeperNow() {
  const added = runCheck_(true);
  toast_(added === 0 ? 'No new transactions — inbox is up to date.'
                     : added + ' new item(s) added to the Transaction Inbox.');
}

/** Time-driven entry point. */
function scheduledCheck() {
  const added = runCheck_(false);
  if (CONFIG.AUTO_APPLY && added > 0) {
    applyRows_(r => r[IB.STATUS - 1] === 'Pending' && MANUAL_ONLY.indexOf(r[IB.TYPE - 1]) === -1);
  }
  if (added > 0 && CONFIG.NOTIFY_EMAIL) {
    MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, 'ITTWA: ' + added + ' new transaction(s)',
      added + ' new item(s) are in the Transaction Inbox.\n' +
      (CONFIG.AUTO_APPLY ? 'Auto-apply is ON — routine items were applied; anything flagged is waiting for you.'
                         : 'Open the sheet to review and apply.') +
      '\n\n' + SpreadsheetApp.getActive().getUrl());
  }
}

function runCheck_(interactive) {
  const inbox = ensureInbox_();
  const known = existingKeys_(inbox);

  // Baseline: the first-ever run stamps "everything up to now is already in
  // the sheet" (the sheet is current at install time). Only transactions that
  // happen AFTER the baseline ever reach the inbox.
  const props = PropertiesService.getDocumentProperties();
  let baseline = Number(props.getProperty('BASELINE_TS') || 0);
  if (!baseline) {
    baseline = Date.now();
    props.setProperty('BASELINE_TS', String(baseline));
    log_('Baseline set: transactions before ' + new Date(baseline).toLocaleString() +
         ' are treated as already entered.');
    toast_('Baseline set — you\'re marked up to date. Only NEW transactions will appear from now on.');
    return 0;
  }

  const state = sleeperGet_('/state/nfl');
  const txns = fetchAllTransactions_().filter(t => (t.status_updated || t.created) > baseline);
  const map = buildOwnerMap_();
  const contracts = readContracts_();
  const season = effectiveSeason_(contracts);

  // Cuts seen so far this run (pid|week → cutter). Only used to annotate a
  // same-week pickup for your information — it does NOT change the pickup's
  // terms. Every pickup is a fresh $0 / 0 contract.
  const cuts = {};
  const rows = [];

  txns.forEach(t => {
    const week = txnWeek_(t, state);
    const when = new Date(t.status_updated || t.created);

    if (t.type === 'trade') {
      Object.keys(t.adds || {}).forEach(pid => {
        const toOwner = map[t.adds[pid]] || '?';
        const fromOwner = map[(t.drops || {})[pid]] || '?';
        const p = playerInfo_(pid, contracts);
        pushRow_(rows, known, {
          key: t.transaction_id + ':' + pid + ':TRADE', when, week, type: 'TRADE',
          player: p.name, pos: p.pos, from: fromOwner, to: toOwner,
          action: 'Mark ' + fromOwner + "'s row Traded → duplicate for " + toOwner,
          data: { pid, from: fromOwner, to: toOwner },
        });
      });
      (t.draft_picks || []).forEach((dp, i) => {
        pushRow_(rows, known, {
          key: t.transaction_id + ':pick' + i, when, week, type: 'PICK TRADE',
          player: dp.season + ' Rd ' + dp.round + ' pick', pos: 'Pick',
          from: map[dp.previous_owner_id] || '?', to: map[dp.owner_id] || '?',
          action: 'Draft pick traded — update the pick row manually', data: {},
          status: 'Needs Review',
        });
      });
      return;
    }

    // free_agent / waiver / commissioner — drops first
    Object.keys(t.drops || {}).forEach(pid => {
      const owner = map[t.drops[pid]] || '?';
      const p = playerInfo_(pid, contracts);
      cuts[pid + '|' + week] = owner;
      pushRow_(rows, known, {
        key: t.transaction_id + ':' + pid + ':CUT', when, week, type: 'CUT',
        player: p.name, pos: p.pos, from: owner, to: '',
        action: 'Status → Cut; add CapHits row (' + p.years + ' yr / $' + p.salary + ')',
        data: { pid, owner },
      });
    });

    // Pickups: ALWAYS a new $0 / 0 contract for the new owner. A dropped
    // player is a free agent — the claimer never inherits the old contract,
    // even when claimed the same week he was cut.
    Object.keys(t.adds || {}).forEach(pid => {
      const owner = map[t.adds[pid]] || '?';
      const p = playerInfo_(pid, contracts);
      const cutBy = cuts[pid + '|' + week];
      const sameWeekNote = cutBy && cutBy !== owner ? ' (cut by ' + cutBy + ' this week)' : '';
      pushRow_(rows, known, {
        key: t.transaction_id + ':' + pid + ':ADD', when, week, type: 'ADD',
        player: p.name, pos: p.pos, from: '', to: owner,
        action: 'New contract: $' + CONFIG.PICKUP_SALARY + ' / ' + CONFIG.PICKUP_YEARS +
                ' yr, Active, season ' + season + sameWeekNote,
        data: { pid, owner, name: p.name, pos: p.pos },
      });
    });
  });

  if (rows.length) {
    const start = inbox.getLastRow() + 1;
    inbox.getRange(start, 1, rows.length, IB_HEADERS.length).setValues(rows);
    inbox.getRange(start, IB.STATUS, rows.length, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build());
    log_('Fetched Sleeper: ' + rows.length + ' new item(s) added to inbox.');
  }
  return rows.length;
}

function pushRow_(rows, known, o) {
  if (known[o.key]) return;
  known[o.key] = true;
  rows.push([o.key, o.when, o.week, o.type, o.player, o.pos, o.from, o.to,
             o.action, o.status || 'Pending', '', JSON.stringify(o.data)]);
}

// ═══════════════════════════════════════════════════════════════════
//  APPLY — the row surgery
// ═══════════════════════════════════════════════════════════════════

function applyApproved()   { applyRows_(r => r[IB.STATUS - 1] === 'Approved'); }
function applyAllPending() { applyRows_(r => r[IB.STATUS - 1] === 'Pending' || r[IB.STATUS - 1] === 'Approved'); }

function applyRows_(filterFn) {
  const inbox = ensureInbox_();
  const data = inbox.getDataRange().getValues();
  let applied = 0, errors = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!filterFn(row)) continue;
    const type = row[IB.TYPE - 1];
    const info = row[IB.DATA - 1] ? JSON.parse(row[IB.DATA - 1]) : {};
    try {
      let note = '';
      if (type === 'CUT')        note = applyCut_(info, row[IB.WEEK - 1]);
      else if (type === 'ADD')   note = applyAdd_(info);
      else if (type === 'TRADE') note = applyTrade_(info);
      else if (type === 'CLAIM') {
        // Legacy Section 9 row — that rule is repealed. Never transfer a contract.
        setStatus_(inbox, i + 1, 'Skipped',
          'Section 9 repealed — use "Convert old Section 9 CLAIM rows" to make it a $0/0 ADD');
        continue;
      }
      else { setStatus_(inbox, i + 1, 'Skipped', 'Manual-only type'); continue; }
      setStatus_(inbox, i + 1, 'Applied', note + ' — ' + new Date().toLocaleString());
      log_(type + ' applied: ' + row[IB.PLAYER - 1] + ' (' + note + ')');
      applied++;
    } catch (e) {
      setStatus_(inbox, i + 1, 'Error', String(e.message || e));
      log_('ERROR on ' + type + ' ' + row[IB.PLAYER - 1] + ': ' + (e.message || e));
      errors++;
    }
  }
  toast_('Applied ' + applied + ' item(s)' + (errors ? ', ' + errors + ' error(s) — see Notes column.' : '.'));
}

/** CUT: flip status, append CapHits row by copying the row above. */
function applyCut_(info, week) {
  const sh = tab_(CONFIG.TABS.contracts);
  const r = findActiveContract_(info.pid, info.owner);
  if (r.alreadyCut) return 'already Cut in sheet — CapHits row assumed present, verify';
  sh.getRange(r.row, C.STATUS).setValue('Cut');
  addCapHitRow_({ week: week, retire: 'No', claim: 'No', owner: r.owner,
                  player: r.player, pos: r.pos, years: r.years, salary: r.salary });
  return 'cut + CapHits row added';
}

/** ADD: append Contracts row (copy row above for formulas, overwrite literals). */
function applyAdd_(info) {
  const sh = tab_(CONFIG.TABS.contracts);
  const season = effectiveSeason_(readContracts_());
  // Idempotence: skip only if THIS owner already has an Active row (you
  // entered it by hand). An Active row under a DIFFERENT owner is the
  // previous owner's contract that hasn't been cut yet — the new owner must
  // still get a fresh $0 / 0 row, never that old contract.
  try {
    const existing = findActiveContract_(info.pid, info.owner);
    if (existing && !existing.alreadyCut && existing.owner === info.owner) return 'already in sheet — skipped';
  } catch (e) { /* not found → proceed */ }

  const newRow = sh.getLastRow() + 1;
  sh.getRange(newRow - 1, 1, 1, sh.getLastColumn()).copyTo(sh.getRange(newRow, 1, 1, sh.getLastColumn()));
  const set = (col, v) => sh.getRange(newRow, col).setValue(v);
  set(C.PID, info.pid); set(C.SEASON, season); set(C.OWNER, info.owner);
  set(C.PLAYER, info.name); set(C.POS, info.pos);
  set(C.YEARS, CONFIG.PICKUP_YEARS); set(C.SALARY, CONFIG.PICKUP_SALARY);
  set(C.STATUS, 'Active'); set(C.START, season); set(C.ORIG_PICK, 'N');
  [C.DP_OWNER, C.DP_ID, C.FTAG, C.TAG5, C.TAG5_AMT].forEach(col =>
    sh.getRange(newRow, col).clearContent());
  return 'contract row ' + newRow + ' added';
}

/** TRADE: mark Traded, duplicate the row under the new owner. */
function applyTrade_(info) {
  const sh = tab_(CONFIG.TABS.contracts);
  const r = findActiveContract_(info.pid, info.from);
  sh.getRange(r.row, C.STATUS).setValue('Traded');
  const newRow = sh.getLastRow() + 1;
  sh.getRange(r.row, 1, 1, sh.getLastColumn()).copyTo(sh.getRange(newRow, 1, 1, sh.getLastColumn()));
  sh.getRange(newRow, C.OWNER).setValue(info.to);
  sh.getRange(newRow, C.STATUS).setValue('Active');
  return 'row ' + r.row + ' → Traded, new row ' + newRow + ' for ' + info.to;
}

/**
 * One-time cleanup: turn legacy Section 9 CLAIM rows that were never applied
 * into regular $0 / 0 ADD rows for the claimer. They land as "Needs Review"
 * (not Pending) so "Apply ALL pending" won't touch them. Check that the
 * player is still on that roster, then set Status = Approved and run
 * "Apply APPROVED rows".
 */
function convertLegacyClaims() {
  const inbox = ensureInbox_();
  const data = inbox.getDataRange().getValues();
  let converted = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[IB.TYPE - 1] !== 'CLAIM' || row[IB.STATUS - 1] === 'Applied') continue;
    const info = row[IB.DATA - 1] ? JSON.parse(row[IB.DATA - 1]) : {};
    const r = i + 1;
    inbox.getRange(r, IB.TYPE).setValue('ADD');
    inbox.getRange(r, IB.FROM).setValue('');
    inbox.getRange(r, IB.ACTION).setValue('New contract: $' + CONFIG.PICKUP_SALARY + ' / ' +
      CONFIG.PICKUP_YEARS + ' yr, Active (was Section 9 claim from ' + info.from + ')');
    inbox.getRange(r, IB.DATA).setValue(JSON.stringify({
      pid: info.pid, owner: info.to, name: row[IB.PLAYER - 1], pos: row[IB.POS - 1] }));
    setStatus_(inbox, r, 'Needs Review', 'Converted from CLAIM — confirm still rostered, then Approve');
    converted++;
  }
  log_('Converted ' + converted + ' legacy CLAIM row(s) to $0/0 ADD.');
  toast_(converted ? converted + ' CLAIM row(s) converted — review them, set Approved, then Apply APPROVED.'
                   : 'No legacy CLAIM rows to convert.');
}

/** Append a CapHits row: copy the row above (formulas F,G,H,N+ drag down), overwrite literals. */
function addCapHitRow_(o) {
  const sh = tab_(CONFIG.TABS.capHits);
  const newRow = sh.getLastRow() + 1;
  sh.getRange(newRow - 1, 1, 1, sh.getLastColumn()).copyTo(sh.getRange(newRow, 1, 1, sh.getLastColumn()));
  const season = effectiveSeason_(readContracts_());
  const set = (col, v) => sh.getRange(newRow, col).setValue(v);
  set(H.SEASON, season); set(H.WEEK, o.week); set(H.RETIRE, o.retire);
  set(H.CLAIM, o.claim); set(H.TYPE, CONFIG.DEFAULT_CAP_HIT_TYPE);
  set(H.OWNER, o.owner); set(H.PLAYER, o.player); set(H.POS, o.pos);
  set(H.YEARS, o.years); set(H.SALARY, o.salary);
}

// ═══════════════════════════════════════════════════════════════════
//  LOOKUPS
// ═══════════════════════════════════════════════════════════════════

function readContracts_() {
  return tab_(CONFIG.TABS.contracts).getDataRange().getValues();
}

/** Get a tab by name, with a friendly error if the name doesn't match. */
function tab_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" not found — check the spelling in CONFIG.TABS at the top of the script.');
  return sh;
}

/** Contracts rows exist per-season; if CONFIG.SEASON has no Active rows yet, fall back to the latest season that does. */
function effectiveSeason_(contracts) {
  let target = 0, latest = 0;
  for (let i = 1; i < contracts.length; i++) {
    if (contracts[i][C.STATUS - 1] !== 'Active') continue;
    const s = Number(contracts[i][C.SEASON - 1]);
    if (!s) continue;
    if (String(s) === String(CONFIG.SEASON)) target++;
    if (s > latest) latest = s;
  }
  return target >= 20 ? String(CONFIG.SEASON) : String(latest);
}

function findActiveContract_(pid, owner) {
  const v = readContracts_();
  const season = effectiveSeason_(v);
  let fallback = null;
  for (let i = v.length - 1; i >= 1; i--) {
    if (String(v[i][C.PID - 1]).trim() !== String(pid)) continue;
    if (String(v[i][C.SEASON - 1]) !== season) continue;
    const status = String(v[i][C.STATUS - 1]).trim();
    const hit = { row: i + 1, owner: v[i][C.OWNER - 1], player: v[i][C.PLAYER - 1],
      pos: v[i][C.POS - 1], years: v[i][C.YEARS - 1] || 0, salary: v[i][C.SALARY - 1] || 0,
      alreadyCut: status === 'Cut' };
    if (status === 'Active' && (!owner || v[i][C.OWNER - 1] === owner)) return hit;
    if (!fallback && (status === 'Active' || status === 'Cut')) fallback = hit;
  }
  if (fallback) return fallback; // active under other owner, or already cut by hand
  throw new Error('No ' + season + ' contract row found for player_id ' + pid +
                  (owner ? ' (' + owner + ')' : '') + ' — add/fix manually.');
}

/** Name/position: latest Contracts row for this pid → PlayerDB tab → Unknown. */
function playerInfo_(pid, contracts) {
  for (let i = contracts.length - 1; i >= 1; i--) {
    if (String(contracts[i][C.PID - 1]).trim() === String(pid)) {
      return { name: contracts[i][C.PLAYER - 1], pos: contracts[i][C.POS - 1],
               years: contracts[i][C.YEARS - 1] || 0, salary: contracts[i][C.SALARY - 1] || 0 };
    }
  }
  const db = SpreadsheetApp.getActive().getSheetByName(CONFIG.TABS.playerDb);
  if (db) {
    const v = db.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) {
      if (String(v[i][0]) === String(pid)) return { name: v[i][1], pos: v[i][2], years: 0, salary: 0 };
    }
  }
  return { name: 'Unknown (' + pid + ')', pos: '?', years: 0, salary: 0 };
}

/** Build the pid→name dictionary tab from Sleeper (run occasionally; rookies mostly). */
function refreshPlayerDb() {
  const res = UrlFetchApp.fetch('https://api.sleeper.app/v1/players/nfl');
  const all = JSON.parse(res.getContentText());
  const keep = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const rows = [['player_id', 'name', 'position']];
  Object.keys(all).forEach(pid => {
    const p = all[pid];
    if (p && keep.indexOf(p.position) !== -1) {
      rows.push([pid, p.full_name || (p.first_name + ' ' + p.last_name), p.position]);
    }
  });
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CONFIG.TABS.playerDb);
  if (!sh) { sh = ss.insertSheet(CONFIG.TABS.playerDb); sh.hideSheet(); }
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  toast_('Player DB refreshed: ' + (rows.length - 1) + ' players.');
}

// ═══════════════════════════════════════════════════════════════════
//  OWNER MAP  (ported from the site's reconcile.ts overlap heuristic)
// ═══════════════════════════════════════════════════════════════════

function buildOwnerMap_() {
  const rosters = sleeperGet_('/league/' + CONFIG.LEAGUE_ID + '/rosters');
  const contracts = readContracts_();
  const season = effectiveSeason_(contracts);

  const pidOwner = {}; // active sheet pid → surname
  for (let i = 1; i < contracts.length; i++) {
    if (String(contracts[i][C.SEASON - 1]) !== season) continue;
    if (String(contracts[i][C.STATUS - 1]).trim() !== 'Active') continue;
    const pid = String(contracts[i][C.PID - 1]).trim();
    if (/^\d+$/.test(pid)) pidOwner[pid] = contracts[i][C.OWNER - 1];
  }

  const map = {}, used = {};
  rosters.forEach(r => {
    const counts = {};
    (r.players || []).forEach(pid => {
      const o = pidOwner[String(pid)];
      if (o) counts[o] = (counts[o] || 0) + 1;
    });
    let best = '', n = -1;
    Object.keys(counts).forEach(o => { if (counts[o] > n) { n = counts[o]; best = o; } });
    map[r.roster_id] = best;
    if (best) {
      if (used[best]) throw new Error('Owner map is not 1:1 (' + best +
        ' matched two rosters). Fix Data Check discrepancies first, then retry.');
      used[best] = true;
    }
  });
  return map;
}

function showOwnerMap() {
  const map = buildOwnerMap_();
  const lines = Object.keys(map).map(rid => 'Roster ' + rid + ' → ' + (map[rid] || '???'));
  SpreadsheetApp.getUi().alert('Sleeper roster → sheet owner\n\n' + lines.join('\n'));
}

// ═══════════════════════════════════════════════════════════════════
//  SLEEPER API
// ═══════════════════════════════════════════════════════════════════

function sleeperGet_(path) {
  const res = UrlFetchApp.fetch('https://api.sleeper.app/v1' + path, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Sleeper API ' + res.getResponseCode() + ' for ' + path);
  return JSON.parse(res.getContentText());
}

/** All completed transactions, all rounds 1–18, fetched in parallel. */
function fetchAllTransactions_() {
  const reqs = [];
  for (let w = 1; w <= 18; w++) {
    reqs.push({ url: 'https://api.sleeper.app/v1/league/' + CONFIG.LEAGUE_ID + '/transactions/' + w,
                muteHttpExceptions: true });
  }
  const out = [];
  const seen = {};
  UrlFetchApp.fetchAll(reqs).forEach(res => {
    if (res.getResponseCode() !== 200) return;
    JSON.parse(res.getContentText()).forEach(t => {
      if (t.status !== 'complete' || seen[t.transaction_id]) return;
      seen[t.transaction_id] = true;
      out.push(t);
    });
  });
  out.sort((a, b) => (a.status_updated || a.created) - (b.status_updated || b.created));
  return out;
}

/** Week for the sheet's Week column: txn leg, or -1 for offseason moves. */
function txnWeek_(t, state) {
  if (t.leg && t.leg > 0 && state.season_type === 'regular') return t.leg;
  if (t.leg && t.leg > 0 && state.season_type === 'post') return t.leg;
  return -1;
}

// ═══════════════════════════════════════════════════════════════════
//  INBOX / LOG / TRIGGER PLUMBING
// ═══════════════════════════════════════════════════════════════════

function ensureInbox_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CONFIG.TABS.inbox);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.TABS.inbox);
    sh.getRange(1, 1, 1, IB_HEADERS.length).setValues([IB_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.hideColumns(IB.KEY);   // internal dedupe key
    sh.hideColumns(IB.DATA);  // internal payload
    sh.setColumnWidth(IB.ACTION, 380);
  }
  return sh;
}

function existingKeys_(inbox) {
  const keys = {};
  const last = inbox.getLastRow();
  if (last < 2) return keys;
  inbox.getRange(2, IB.KEY, last - 1, 1).getValues().forEach(r => { if (r[0]) keys[r[0]] = true; });
  return keys;
}

function setStatus_(inbox, rowNum, status, note) {
  inbox.getRange(rowNum, IB.STATUS).setValue(status);
  if (note) inbox.getRange(rowNum, IB.NOTES).setValue(note);
}

function log_(msg) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CONFIG.TABS.log);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.TABS.log);
    sh.getRange(1, 1, 1, 2).setValues([['Timestamp', 'Event']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(), msg]);
}

function toast_(msg) {
  try { SpreadsheetApp.getActive().toast(msg, 'ITTWA Admin', 8); } catch (e) { /* headless run */ }
}

function setBaselineNow() {
  PropertiesService.getDocumentProperties().setProperty('BASELINE_TS', String(Date.now()));
  log_('Baseline reset to now by user.');
  toast_('Done — anything that happened before this moment will be ignored.');
}

function enableDailyTrigger() {
  disableDailyTrigger();
  ScriptApp.newTrigger('scheduledCheck').timeBased().everyDays(1).atHour(7).create();
  toast_('Daily auto-check enabled (runs ~7am).');
  log_('Daily trigger enabled.');
}

function disableDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'scheduledCheck') ScriptApp.deleteTrigger(t);
  });
  toast_('Daily auto-check disabled.');
}
