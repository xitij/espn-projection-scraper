# ESPN projection scraper + auction values

Node scripts for a 12-team, **2QB**, $250, no-keeper auction. The old ESPN scrapers are still here. The thing you actually use at the draft is `auction-values.js`, which scores three projection sources in **this league’s scoring**, applies your positional ranks, and prices players against this league’s history.

```bash
node auction-values.js
# or: npm run auction
```

Writes:

- `src/2026-auction-values.csv` — draft sheet
- `src/2026-movers.csv` — where your ranks moved the model
- `src/2026-market-curves.csv` — recency-weighted historical prices by ADP / pos rank

`.gitignore` ignores `*.csv`. Projection CSVs, rank sheets, draft history, and these outputs live on disk even if git does not see them.

---

## League (2026)

Confirmed in `src/mappings/league.js`:

- 12 teams, $250, 19 roster spots (11 starters + 8 bench), **$3,000** in the room, **228** rostered players
- Starters: **2QB, 2RB, 3WR, 1TE, 1 FLEX (RB/WR/TE), 1 D/ST, 1 K**
- No roster limits. K and D/ST are always **$1**
- Scoring (see `src/mappings/scoring.js`): pass TD 60, pass yards 0.35/yd, INT −30, rush/rec TD 60, rush/rec yards 1/yd, rec 5, fumble lost −20, 2PC 20, return TD 60
- Payout is 1st only; 6 make playoffs; top 2 get a bye; playoffs weeks 15–17. That is **not** in the model (no weekly projections)

---

## Repo index

| Path | What it is |
|---|---|
| `auction-values.js` | Auction engine. `YEAR` at the top drives input/output paths. |
| `projections.js` | Legacy: ESPN projection JSON → CSV (`src/projections-parser.js`) |
| `draft.js` | Legacy: ESPN `values.json` + projection JSON → draft CSV (`src/draft-parser.js`) |
| `src/mappings/league.js` | Teams, budget, starters, man-games weeks, market recency, excluded draft years |
| `src/mappings/scoring.js` | League scoring. ESPN `appliedTotal` is the **wrong** scoring — never use it. |
| `src/mappings/baselines.js` | Players drafted by position each year. `threeYearAvg` is the **Drafted $** replacement rank only |
| `src/mappings/teams.js` | ESPN team / position ids |
| `src/mappings/stats.js` | ESPN counting-stat ids (used by the old parser; auction engine has its own map) |
| `src/mappings/sctid-managers.js` | ESPN `teamId` → manager nickname (draft parser only) |
| `src/auction/csv.js` | CSV parse helpers |
| `src/auction/names.js` | Name / team / position normalization for matching |
| `src/projections/YYYY/` | Raw projections for that season |
| `src/draft/YYYY/` | Historical auctions. Engine reads `YYYY-Draft.csv`. ESPN dump is `values.json` |
| `src/ranks/YYYY-ranks.csv` | Your positional ranks + tiers |
| `src/2026-auction-values.csv` | **Main draft sheet** |
| `src/2026-movers.csv` | Rank/dollar moves vs consensus |
| `src/2026-market-curves.csv` | Historical price curves |

### Projection files (`src/projections/2026/`)

- `projections-page-1.json` … `projections-page-11.json` — ESPN player cards (50 per page). Stat block id `102026` (pattern `10` + year). 2PC ids 19/26/44; return TDs 101–104.
- `el-boberto-QB-Raw.csv` (and RB/WR/TE) — industry consensus counting stats
- `fantasy-points-qb-projections.season.csv` (and rb/wr/te) — includes **GP**, used for man-games. Row 0 is a group header; data starts at row 2. Column layout is positional (ATT/YDS/TD repeat). If FantasyPoints changes the export, `loadFantasyPoints()` in `auction-values.js` has to change.

### Draft history (`src/draft/YYYY/YYYY-Draft.csv`)

Required columns: **Player, Position, Cost, ADP**. 228 rows (except 2020). **2020 is excluded** from market curves (COVID: $260 and extra bench) via `EXCLUDE_DRAFT_YEARS`.

The legacy parser writes a different file (`Pick,Player,Team,Pos,Cost,Owner`, no ADP). The engine does not use that file.

---

## How Model $ is built (short)

1. **Merge projections.** Equal average of el-boberto + FantasyPoints + ESPN counting stats when present. 2PC and return TDs are ESPN-only and are **not** zero-filled from the others.
2. **Score** those stats with `src/mappings/scoring.js`.
3. **Custom ranks** do not invent new totals. Consensus builds a point curve per position (WR1 pts, WR2 pts, …). Your `My Rank` decides **who sits on which slot**. Tiers are labels only.
4. **Replacement** for Model $ is Dupont **man-games**: `teams × starting slots × 17` (no bye add-on). Flex leftover games go to remaining RB/WR/TE by points. GP comes from FantasyPoints. Typical cutoffs: QB ~28, RB ~39, WR ~44, TE ~14.
5. `VBD = max(0, league points − replacement)`.
6. 204 skill roster spots get **$1 + (VBD / all VBD) × $2,772**, integer-rounded so the league sums to **$3,000**. $2,772 = $3,000 − 228 $1 floors. 12 K and 12 D/ST are $1; extras $0.

**VOLS $** and **Drafted $** are the same pie with different replacement lines (last starter+flex, and last historically drafted). Comparison only. Bid with **Model $**.

**Market $** is not a model input. It is this league’s recency-weighted history (half-life 3.5 years, reference year in `league.js`) joined onto the player after pricing.

---

## `src/2026-auction-values.csv` — the draft sheet

One row per merged player, sorted by Model $ then points. Pull these onto the live sheet:

| Keep on the draft sheet | Role |
|---|---|
| **Model $** | Your max bid |
| **Market $ (pos rank)** | What this league usually pays for *this slot* (your Model $ order) |
| **Market $ (overall rank)** | Same, overall ADP 1–228. **$0** if he is not one of the 228 rostered |
| **My Rank**, **Tier** | Your board / drop-offs |
| **Consensus Pos Rank**, **Rank Difference** | Do you like him more than consensus? `consensus − my rank` (positive = you ranked him up) |
| **Surplus vs Pos** | Model $ − market for *your* slot. Cheap **rank**, not cheap **name** |
| **Consensus Market Surplus** | Model $ − market for his *consensus* slot. Cheap **name** if the room still believes consensus |

### Every column

| Column | Meaning |
|---|---|
| Rank | Overall order by Model $ |
| Player, Team, Pos | Identity. Names prefer ESPN, then FantasyPoints, then el-boberto |
| Pos Rank | Positional order by Model $ (RB1, RB2, …) |
| My Rank | Your positional rank. Blank if not on `src/ranks/2026-ranks.csv` |
| Tier | Your tier label. Does not change price |
| Consensus Pos Rank | Order by consensus league points (before your ranks) |
| Rank Difference | Consensus Pos Rank − My Rank. Blank if either is missing |
| Consensus Pts | League points before the rank swap |
| League Pts | Points after the rank swap (the curve slot you assigned) |
| VBD | League Pts − man-games replacement (floor 0) |
| **Model $** | Man-games VBD share of $2,772, plus $1 if rostered |
| VOLS $ | Same allocation, VOLS replacement |
| Drafted $ | Same allocation, last-drafted replacement (`baselines.js` 3-year avg) |
| Market $ (pos rank) | Historical $ for this **Pos Rank**. Deep skill players clamp to the last curve point (~$1), not $0 |
| Market $ (overall rank) | Historical $ for this overall draft rank. $0 if Model $ is $0 (not in the 228) |
| Market $ (consensus pos rank) | Historical $ for **Consensus Pos Rank** — what they pay for the *name* if they still see consensus |
| Surplus vs Pos | Model $ − Market $ (pos rank) |
| Surplus vs Overall | Model $ − Market $ (overall rank) |
| **Consensus Market Surplus** | Model $ − Market $ (consensus pos rank). **This is the “is this guy a value?” column** |
| Sources | Which of el-boberto / fantasy-points / espn were averaged |
| GP | FantasyPoints games played (man-games) |
| FP ADP, ESPN SF Rank, ESPN Auc $ | Other boards. ESPN Auc $ is what the ESPN client shows this year |
| Pass/Rush/Rec stats, FL, 2PC, Ret TD | Averaged counting stats used to score |

### How to read it at the table

- **Max bid** = Model $. K/D/ST = $1.
- **Value target:** Consensus Market Surplus clearly positive and you don’t hate the player. Example: you have Chase Brown RB7 ($49) and consensus still treats him as RB10 (~$38) → surplus about **+$11**.
- **Fade:** you docked him and Consensus Market Surplus is negative. Example: Jacobs your RB22 ($24) vs consensus RB12 (~$33) → **−$9**. They will outbid your cap.
- **Slot trap:** Surplus vs Pos is big positive on someone you docked. That means the *rank* is cheap in this league (mid RBs 12–30 especially), not that the *name* is a buy.
- If Model $, your rank, and market **agree**, both surplus columns are small. Fair price, not a steal.

Unmatched rank-sheet names with no projection (e.g. Tylen Green) are **$0** stubs so they still appear.

---

## `src/2026-movers.csv` — what your ranks changed

Skill players who appear on your rank sheet, sorted by the biggest **$ vs Consensus**, then rank move.

This is the pre-draft diagnostic, not the live bid sheet. The main CSV is the *after* picture: Model $ and surplus there already include your rank swap. Movers is the before/after.

| Column | Meaning |
|---|---|
| My Rank, Consensus Pos Rank, Rank Delta | Same Rank Difference as the main sheet (`consensus − my`) |
| Consensus Pts / Adj Pts / Pts Delta | Point curve before vs after the swap |
| Consensus Model $ | Model $ if we **did not** apply your ranks |
| Model $ | Model $ with your ranks |
| **$ vs Consensus** | Model $ − Consensus Model $. “I moved him $X in my model.” Not what the league pays |
| Market $ (my pos rank), Surplus vs Market | Same as Surplus vs Pos on the main sheet |
| Market $ (consensus pos rank), Consensus Market Surplus | Same as the main sheet |

**$ vs Consensus** is “did I change his worth?” Jacobs **−$14** (docked). Chase Brown **+$9** (promoted).

**Consensus Market Surplus** is “will they let me buy him under my cap?” Jacobs **−$9**. Brown **+$11**.

Do not sort movers by Surplus vs Market to pick targets. Docked mid-RBs pile up there because RB22 historically goes for ~$14 while your model still says ~$24.

---

## `src/2026-market-curves.csv` — historical prices

Not a template. Recency-weighted average of what this league paid, excluding 2020.

Weight = `0.5 ^ ((MARKET_REFERENCE_YEAR − draftYear) / 3.5)`. Reference year is the last **completed** draft (2025 until you add 2026).

| Column | Meaning |
|---|---|
| Type | `overall` or `pos` |
| Pos | Blank on `overall` rows (not missing data). QB/RB/WR/TE on `pos` rows |
| Rank | Overall ADP 1–228, or positional rank among that year’s drafted players at the position (sorted by ADP) |
| Historical $ | Weighted average **Cost** |
| Weighted N | Sum of recency weights (not a player count). ~4.91 means every included year hit that slot |

These curves are joined onto the main sheet as Market $ (overall / pos / consensus pos). Skill **Pos Rank** past the last historical rank still gets the last curve value (~$1). Overall rank is $0 for anyone not in the 228.

Sanity check (not an input): last ≥$2 historical ranks are about QB32, RB46, WR55, TE12.

---

## Updating for next year (e.g. 2026 season → 2027 sheet)

Do this in order. After each data drop, run `node auction-values.js` and read the console (unmatched ranks, duplicate ranks, source mix, Model $ sum = 3000).

### 1. Archive this year’s draft (after it happens)

1. Save the completed auction as `src/draft/2026/2026-Draft.csv` with **Player, Position, Cost, ADP** and **228** picks.
2. Optional: dump ESPN `values.json` next to it (legacy parser / backup).
3. Count players drafted by position. Add a `2026:` row to `src/mappings/baselines.js` and recompute `threeYearAvg` as 2024–2026 (still skip 2020).
4. In `src/mappings/league.js` set `MARKET_REFERENCE_YEAR = 2026`.

### 2. Flip the generator to the new season

In `auction-values.js` set:

```js
const YEAR = 2027;
```

That picks up `src/projections/2027/`, `src/ranks/2027-ranks.csv`, ESPN stat id `102027`, and writes `src/2027-*.csv`.

If ESPN pagination changes, set `ESPN_PAGES` to the number of `projections-page-N.json` files.

### 3. League settings

Only touch `src/mappings/league.js` and `src/mappings/scoring.js` if something actually changed (budget, roster, scoring, weeks). Man-games demand is `teams × starters × WEEKS`. Keep `EXCLUDE_DRAFT_YEARS = [2020]` unless another year is equally broken.

### 4. Drop new projections into `src/projections/2027/`

| File | Source |
|---|---|
| `projections-page-1.json` … | ESPN (same shape as 2026). Confirm a player’s season stats use id `102027`, or rely on the fallback `statSourceId === 1 && scoringPeriodId === 0` |
| `el-boberto-QB-Raw.csv` (+ RB/WR/TE) | Same filenames as 2026, new season data. Headers matched loosely (`player`, `passyds`, …) |
| `fantasy-points-*-projections.season.csv` | Must include **GP**. If columns shift, fix `loadFantasyPoints()` |

Ignore fantasy-point totals in those files. The engine re-scores counting stats.

`projections.js` / `LAST_PAGE_NUM` in `src/projections-parser.js` are only for the old ESPN CSV export. Auction values read the JSON directly.

### 5. Your ranks: `src/ranks/2027-ranks.csv`

CSV (not TSV). Header:

```text
Player,Team,Bye,Position,Tier,My Rank
```

- **My Rank** is positional (QB 1..n, WR 1..n, …), not overall
- One player per rank per position. No duplicates, no skipped numbers (or the curve leaves holes)
- Names should match ESPN / FantasyPoints closely (`jr`/`sr` and punctuation are stripped)
- Unprojected names (camp QBs, etc.) still get a row; they price at **$0**
- Tiers do not change dollars

### 6. Generate

```bash
node auction-values.js
```

Check:

- `Custom ranks: … remapped …` — should be almost every skill player on your sheet
- Duplicate / unmatched ranks — fix the rank CSV
- `Model $ sum=3000`
- Top Model $ still looks like your board (elites you ranked 1 should be the expensive ones)

### 7. Draft sheet

Copy from `src/2027-auction-values.csv`:

**Model $, Market $ (pos rank), Market $ (overall rank), My Rank, Tier, Consensus Pos Rank, Rank Difference, Surplus vs Pos, Consensus Market Surplus**

Use movers only if you want to audit who you moved.

---

## Regenerating the current year

After any ranks, scoring, or projection tweak:

```bash
node auction-values.js
```

No install step. No dependencies.

## Old ESPN helpers (optional)

```bash
# projections.js → 2026-projections.csv (ESPN appliedTotal, not league scoring)
node projections.js

# draft.js → src/draft.csv from values.json + projection pages (no ADP)
# edit the year string in draft.js first
node draft.js
```

`package.json` `npm start` still points at a missing `app.js`. Use the commands above.
