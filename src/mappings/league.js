// Confirmed league settings for the 2026 auction.

const TEAMS = 12;
const BUDGET = 250;
const STARTERS = {
  QB: 2,
  RB: 2,
  WR: 3,
  TE: 1,
  FLEX: 1, // RB/WR/TE only
  DST: 1,
  K: 1,
};
const BENCH = 8;
const ROSTER_SPOTS = 11 + BENCH; // 19
const TOTAL_DOLLARS = TEAMS * BUDGET; // 3000
const TOTAL_SPOTS = TEAMS * ROSTER_SPOTS; // 228
const MIN_BID = 1;
const K_DST_PRICE = 1;

const WEEKS = 17; // regular season; bye weeks are NOT added to man-games demand

// Years excluded from market-price curves (not from the baseline table):
// 2020: COVID — $260 budget and 3 extra bench spots.
const EXCLUDE_DRAFT_YEARS = [2020];

// Recency: weight = 0.5 ^ ((referenceYear - draftYear) / halfLifeYears)
const MARKET_REFERENCE_YEAR = 2025;
const MARKET_HALF_LIFE_YEARS = 3.5;

const SKILL_POSITIONS = ['QB', 'RB', 'WR', 'TE'];
const DOLLAR_FIXED_POSITIONS = ['K', 'D/ST'];

module.exports = {
  TEAMS,
  BUDGET,
  STARTERS,
  BENCH,
  ROSTER_SPOTS,
  TOTAL_DOLLARS,
  TOTAL_SPOTS,
  MIN_BID,
  K_DST_PRICE,
  WEEKS,
  EXCLUDE_DRAFT_YEARS,
  MARKET_REFERENCE_YEAR,
  MARKET_HALF_LIFE_YEARS,
  SKILL_POSITIONS,
  DOLLAR_FIXED_POSITIONS,
};
