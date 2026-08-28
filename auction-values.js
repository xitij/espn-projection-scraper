const fs = require('fs');
const path = require('path');

const Scoring = require('./src/mappings/scoring');
const Baselines = require('./src/mappings/baselines');
const League = require('./src/mappings/league');
const TeamMappings = require('./src/mappings/teams');
const { parseCsv, parseNumber } = require('./src/auction/csv');
const { normalizeName, normalizeTeam, normalizePosition, playerKey } = require('./src/auction/names');

const ROOT = __dirname;
const YEAR = 2026;
const ESPN_PAGES = 11;
const STAT_FIELDS = [
  'passYds', 'passTds', 'ints',
  'rushAtt', 'rushYds', 'rushTds',
  'rec', 'recYds', 'recTds', 'fl',
  'twoPt', 'returnTds',
];

const ESPN_STAT_IDS = {
  passYds: '3',
  passTds: '4',
  ints: '20',
  rushAtt: '23',
  rushYds: '24',
  rushTds: '25',
  rec: '53',
  recYds: '42',
  recTds: '43',
  fl: '72',
};

const ESPN_TWO_POINT_IDS = ['19', '26', '44'];
const ESPN_RETURN_TD_IDS = ['101', '102', '103', '104'];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function emptyStats() {
  const stats = {};
  STAT_FIELDS.forEach((field) => {
    stats[field] = null;
  });
  return stats;
}

function avg(values) {
  const nums = values.filter((v) => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function recencyWeight(year) {
  return 0.5 ** ((League.MARKET_REFERENCE_YEAR - year) / League.MARKET_HALF_LIFE_YEARS);
}

function replacementPoints(sortedDesc, baselineRank) {
  if (!sortedDesc.length) return 0;
  const idx = baselineRank - 1;
  if (idx <= 0) return sortedDesc[0];
  if (idx >= sortedDesc.length - 1) return sortedDesc[sortedDesc.length - 1];
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  if (frac === 0) return sortedDesc[lo];
  return sortedDesc[lo] * (1 - frac) + sortedDesc[hi] * frac;
}

function interpolateLookup(table, rank) {
  if (!table || Object.keys(table).length === 0 || rank == null) return null;
  const exact = table[Math.round(rank)];
  if (exact != null) return exact;
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (!keys.length) return null;
  if (rank <= keys[0]) return table[keys[0]];
  if (rank >= keys[keys.length - 1]) return table[keys[keys.length - 1]];
  let lo = keys[0];
  let hi = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (keys[i] <= rank && keys[i + 1] >= rank) {
      lo = keys[i];
      hi = keys[i + 1];
      break;
    }
  }
  if (hi === lo) return table[lo];
  const frac = (rank - lo) / (hi - lo);
  return table[lo] * (1 - frac) + table[hi] * frac;
}

function loadElBoberto() {
  const dir = path.join(ROOT, `src/projections/${YEAR}`);
  const files = [
    { file: 'el-boberto-QB-Raw.csv', pos: 'QB' },
    { file: 'el-boberto-RB-Raw.csv', pos: 'RB' },
    { file: 'el-boberto-WR-Raw.csv', pos: 'WR' },
    { file: 'el-boberto-TE-Raw.csv', pos: 'TE' },
  ];
  const players = [];
  files.forEach(({ file, pos }) => {
    const rows = parseCsv(read(path.join(dir, file)));
    const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const col = (names) => {
      for (const name of names) {
        const idx = header.indexOf(name);
        if (idx !== -1) return idx;
      }
      return -1;
    };
    const idx = {
      player: col(['player', 'name']),
      team: col(['team']),
      passYds: col(['passyds']),
      passTds: col(['passstds', 'passtds', 'passtd']),
      ints: col(['passints', 'ints', 'int']),
      rushAtt: col(['rushatt']),
      rushYds: col(['rushyds']),
      rushTds: col(['rushtds', 'rudhtds']),
      rec: col(['rec']),
      recYds: col(['recyds']),
      recTds: col(['rectds']),
      fl: col(['fl']),
    };
    rows.slice(1).forEach((row) => {
      const name = row[idx.player];
      if (!name) return;
      const stats = emptyStats();
      Object.keys(idx).forEach((key) => {
        if (key === 'player' || key === 'team') return;
        if (idx[key] >= 0) stats[key] = parseNumber(row[idx[key]]);
      });
      players.push({
        source: 'el-boberto',
        name: name.trim(),
        team: normalizeTeam(row[idx.team]),
        pos,
        stats,
      });
    });
  });
  return players;
}

function loadFantasyPoints() {
  const dir = path.join(ROOT, `src/projections/${YEAR}`);
  const files = [
    { file: 'fantasy-points-qb-projections.season.csv', pos: 'QB', kind: 'qb' },
    { file: 'fantasy-points-rb-projections.season.csv', pos: 'RB', kind: 'skill' },
    { file: 'fantasy-points-wr-projections.season.csv', pos: 'WR', kind: 'skill' },
    { file: 'fantasy-points-te-projections.season.csv', pos: 'TE', kind: 'skill' },
  ];
  const players = [];
  files.forEach(({ file, pos, kind }) => {
    const rows = parseCsv(read(path.join(dir, file)));
    // Row 0 is a group header; row 1 is the real header. Columns are positional
    // because ATT/YDS/TD repeat.
    rows.slice(2).forEach((row) => {
      const name = row[1];
      if (!name) return;
      const stats = emptyStats();
      if (kind === 'qb') {
        stats.passYds = parseNumber(row[13]);
        stats.passTds = parseNumber(row[14]);
        stats.ints = parseNumber(row[15]);
        stats.rushAtt = parseNumber(row[16]);
        stats.rushYds = parseNumber(row[17]);
        stats.rushTds = parseNumber(row[18]);
      } else {
        stats.rushAtt = parseNumber(row[11]);
        stats.rushYds = parseNumber(row[12]);
        stats.rushTds = parseNumber(row[13]);
        stats.rec = parseNumber(row[15]);
        stats.recYds = parseNumber(row[16]);
        stats.recTds = parseNumber(row[17]);
      }
      players.push({
        source: 'fantasy-points',
        name: name.trim(),
        team: normalizeTeam(row[3]),
        pos,
        adp: parseNumber(row[10]),
        fpPosRank: parseNumber(row[9]),
        gp: parseNumber(row[6]),
        stats,
      });
    });
  });
  return players;
}

function espnProjectionStats(player) {
  const block = (player.stats || []).find((s) => s.id === `10${YEAR}`)
    || (player.stats || []).find((s) => s.statSourceId === 1 && s.scoringPeriodId === 0);
  if (!block || !block.stats) return emptyStats();
  const stats = emptyStats();
  Object.entries(ESPN_STAT_IDS).forEach(([field, id]) => {
    const value = block.stats[id];
    stats[field] = value == null ? null : Number(value);
  });
  const twoPt = ESPN_TWO_POINT_IDS.reduce((s, id) => s + (Number(block.stats[id]) || 0), 0);
  const returnTds = ESPN_RETURN_TD_IDS.reduce((s, id) => s + (Number(block.stats[id]) || 0), 0);
  stats.twoPt = twoPt;
  stats.returnTds = returnTds;
  return stats;
}

function loadEspn() {
  const players = [];
  for (let page = 1; page <= ESPN_PAGES; page += 1) {
    const data = require(`./src/projections/${YEAR}/projections-page-${page}.json`);
    data.players.forEach((raw) => {
      const pos = TeamMappings.positionMapping[raw.player.defaultPositionId];
      if (!pos) return;
      const sf = raw.player.draftRanksByRankType && raw.player.draftRanksByRankType.SUPERFLEX;
      const ownership = raw.player.ownership || {};
      players.push({
        source: 'espn',
        name: raw.player.fullName,
        team: TeamMappings.teamAbbrevMapping[raw.player.proTeamId] || '',
        pos,
        espnId: raw.player.id,
        espnAuc: raw.draftAuctionValue < 1 ? 0 : raw.draftAuctionValue,
        espnSfRank: sf ? sf.rank : null,
        espnAdp: ownership.averageDraftPosition == null ? null : Number(ownership.averageDraftPosition),
        stats: espnProjectionStats(raw.player),
      });
    });
  }
  return players;
}

function mergeProjections(elBoberto, fantasyPoints, espn) {
  const byKey = new Map();

  function ensure(row) {
    const key = playerKey(row.name, row.pos);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        name: row.name,
        team: row.team,
        pos: normalizePosition(row.pos),
        sources: [],
        sourceStats: {},
        espnId: null,
        espnAuc: null,
        espnSfRank: null,
        espnAdp: null,
        fpAdp: null,
        fpPosRank: null,
        gp: null,
      });
    }
    const player = byKey.get(key);
    if (!player.sources.includes(row.source)) player.sources.push(row.source);
    player.sourceStats[row.source] = row.stats;
    if (row.team && (!player.team || player.team === 'Bye')) player.team = row.team;
    if (row.source === 'espn') {
      player.name = row.name;
      player.team = row.team;
      player.espnId = row.espnId;
      player.espnAuc = row.espnAuc;
      player.espnSfRank = row.espnSfRank;
      player.espnAdp = row.espnAdp;
    }
    if (row.source === 'fantasy-points') {
      player.fpAdp = row.adp;
      player.fpPosRank = row.fpPosRank;
      player.gp = row.gp;
      if (!player.espnId) player.name = row.name;
    }
    if (row.source === 'el-boberto' && !player.espnId && !player.fpAdp) {
      player.name = row.name;
    }
    return player;
  }

  elBoberto.forEach(ensure);
  fantasyPoints.forEach(ensure);
  espn.forEach(ensure);

  const merged = [];
  byKey.forEach((player) => {
    const used = ['el-boberto', 'fantasy-points', 'espn'].filter((s) => player.sourceStats[s]);
    const stats = emptyStats();
    STAT_FIELDS.forEach((field) => {
      stats[field] = avg(used.map((s) => player.sourceStats[s][field]));
    });
    const points = Scoring.leaguePoints(stats);
    merged.push({
      ...player,
      stats,
      usedSources: used,
      gp: player.gp,
      points,
    });
  });
  return merged;
}

function loadRanks() {
  const file = path.join(ROOT, `src/ranks/${YEAR}-ranks.csv`);
  const rows = parseCsv(read(file));
  const header = rows[0].map((h) => h.trim());
  const col = (name) => header.indexOf(name);
  const iPlayer = col('Player');
  const iTeam = col('Team');
  const iPos = col('Position');
  const iTier = col('Tier');
  const iRank = col('My Rank');
  const ranks = [];
  const seen = {};
  rows.slice(1).forEach((row) => {
    const name = (row[iPlayer] || '').trim();
    const pos = normalizePosition(row[iPos]);
    if (!name || !pos) return;
    const myRank = parseNumber(row[iRank]);
    const tier = parseNumber(row[iTier]);
    ranks.push({
      name,
      team: normalizeTeam(row[iTeam]),
      pos,
      myRank,
      tier,
      key: playerKey(name, pos),
    });
    const slot = `${pos}|${myRank}`;
    seen[slot] = (seen[slot] || 0) + 1;
  });
  const duplicateRanks = Object.entries(seen).filter(([, n]) => n > 1).map(([slot]) => slot);
  return { ranks, duplicateRanks };
}

function applyCustomRanks(players, rankData) {
  const byKey = new Map();
  const byTeamPos = new Map();
  players.forEach((p) => {
    byKey.set(p.key, p);
    byTeamPos.set(`${p.team}|${p.pos}`, p);
    p.consensusPoints = p.points;
  });

  const curve = {};
  const allPos = [...League.SKILL_POSITIONS, ...League.DOLLAR_FIXED_POSITIONS];
  allPos.forEach((pos) => {
    const list = players
      .filter((p) => p.pos === pos)
      .sort((a, b) => b.consensusPoints - a.consensusPoints);
    list.forEach((p, i) => {
      p.consensusPosRank = i + 1;
    });
    curve[pos] = {};
    list.forEach((p, i) => {
      curve[pos][i + 1] = p.consensusPoints;
    });
  });

  const unmatched = [];
  const stubs = [];
  let remapped = 0;
  rankData.ranks.forEach((r) => {
    let p = byKey.get(r.key);
    if (!p && (r.pos === 'K' || r.pos === 'D/ST')) {
      p = byTeamPos.get(`${r.team}|${r.pos}`);
    }
    if (!p) {
      unmatched.push(r);
      if (League.SKILL_POSITIONS.includes(r.pos)) {
        const stub = {
          key: r.key,
          name: r.name,
          team: r.team,
          pos: r.pos,
          myRank: r.myRank,
          tier: r.tier,
          points: 0,
          consensusPoints: 0,
          consensusPosRank: null,
          stats: emptyStats(),
          sources: [],
          usedSources: [],
          sourceStats: {},
          gp: null,
          espnId: null,
          espnAuc: null,
          espnSfRank: null,
          espnAdp: null,
          fpAdp: null,
          fpPosRank: null,
        };
        players.push(stub);
        stubs.push(stub);
      }
      return;
    }
    p.myRank = r.myRank;
    p.tier = r.tier;
    if (League.SKILL_POSITIONS.includes(p.pos) && r.myRank != null && curve[p.pos][r.myRank] != null) {
      p.points = curve[p.pos][r.myRank];
      remapped += 1;
    }
  });

  const movers = players
    .filter((p) => p.myRank != null && p.consensusPosRank != null && League.SKILL_POSITIONS.includes(p.pos))
    .map((p) => ({
      name: p.name,
      pos: p.pos,
      myRank: p.myRank,
      consensusPosRank: p.consensusPosRank,
      delta: p.consensusPosRank - p.myRank,
      consensusPts: p.consensusPoints,
      adjPts: p.points,
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return { unmatched, stubs, remapped, movers, duplicateRanks: rankData.duplicateRanks };
}

function loadDrafts() {
  const draftRoot = path.join(ROOT, 'src/draft');
  const years = fs.readdirSync(draftRoot)
    .filter((name) => /^\d{4}$/.test(name))
    .map(Number)
    .sort((a, b) => a - b);

  const picks = [];
  const yearSummaries = [];

  years.forEach((year) => {
    const file = path.join(draftRoot, String(year), `${year}-Draft.csv`);
    if (!fs.existsSync(file)) return;
    const rows = parseCsv(read(file));
    const header = rows[0].map((h) => h.trim());
    const col = (name) => header.indexOf(name);
    const iPlayer = col('Player');
    const iPos = col('Position');
    const iCost = col('Cost');
    const iAdp = col('ADP');
    const yearPicks = [];
    rows.slice(1).forEach((row) => {
      const pos = normalizePosition(row[iPos]);
      const cost = parseNumber(row[iCost]);
      if (!row[iPlayer] || cost == null) return;
      yearPicks.push({
        year,
        player: row[iPlayer].trim(),
        pos,
        cost,
        adp: parseNumber(row[iAdp]),
      });
    });

    const posCounts = {};
    let spent = 0;
    let dollarOnes = 0;
    yearPicks.forEach((p) => {
      posCounts[p.pos] = (posCounts[p.pos] || 0) + 1;
      spent += p.cost;
      if (p.cost === 1) dollarOnes += 1;
    });
    const expectedN = year === 2020 ? 264 : League.TOTAL_SPOTS;
    yearSummaries.push({
      year,
      n: yearPicks.length,
      spent,
      dollarOnes,
      posCounts,
      excluded: League.EXCLUDE_DRAFT_YEARS.includes(year),
      incomplete: yearPicks.length !== expectedN,
    });
    if (!League.EXCLUDE_DRAFT_YEARS.includes(year)) {
      picks.push(...yearPicks);
    }
  });

  return { picks, yearSummaries };
}

function buildMarket(picks) {
  const overall = {};
  const byPos = { QB: {}, RB: {}, WR: {}, TE: {} };

  function add(table, rank, cost, weight) {
    if (rank == null || rank < 1) return;
    const key = Math.round(rank);
    if (!table[key]) table[key] = { wx: 0, w: 0, n: 0 };
    table[key].wx += cost * weight;
    table[key].w += weight;
    table[key].n += 1;
  }

  const byYear = new Map();
  picks.forEach((p) => {
    if (!byYear.has(p.year)) byYear.set(p.year, []);
    byYear.get(p.year).push(p);
  });

  byYear.forEach((yearPicks, year) => {
    const w = recencyWeight(year);
    yearPicks.forEach((p) => add(overall, p.adp, p.cost, w));

    League.SKILL_POSITIONS.forEach((pos) => {
      const atPos = yearPicks
        .filter((p) => p.pos === pos && p.adp != null)
        .sort((a, b) => a.adp - b.adp);
      atPos.forEach((p, i) => add(byPos[pos], i + 1, p.cost, w));
    });
  });

  function freeze(table) {
    const out = {};
    Object.entries(table).forEach(([rank, rec]) => {
      if (rec.w > 0) out[Number(rank)] = rec.wx / rec.w;
    });
    return out;
  }

  return {
    overall: freeze(overall),
    byPos: {
      QB: freeze(byPos.QB),
      RB: freeze(byPos.RB),
      WR: freeze(byPos.WR),
      TE: freeze(byPos.TE),
    },
    overallRaw: overall,
    byPosRaw: byPos,
  };
}

function volsReplacement(skill) {
  const qbPts = skill.filter((p) => p.pos === 'QB').map((p) => p.points).sort((a, b) => b - a);
  const replacement = {
    QB: replacementPoints(qbPts, League.TEAMS * League.STARTERS.QB),
  };

  const required = {
    RB: League.TEAMS * League.STARTERS.RB,
    WR: League.TEAMS * League.STARTERS.WR,
    TE: League.TEAMS * League.STARTERS.TE,
  };
  const byPos = { RB: [], WR: [], TE: [] };
  skill.forEach((p) => {
    if (byPos[p.pos]) byPos[p.pos].push(p);
  });
  ['RB', 'WR', 'TE'].forEach((pos) => {
    byPos[pos].sort((a, b) => b.points - a.points);
  });

  const rosteredIds = new Set();
  ['RB', 'WR', 'TE'].forEach((pos) => {
    byPos[pos].slice(0, required[pos]).forEach((p) => rosteredIds.add(p.key));
  });
  const leftover = skill
    .filter((p) => ['RB', 'WR', 'TE'].includes(p.pos) && !rosteredIds.has(p.key))
    .sort((a, b) => b.points - a.points);
  leftover.slice(0, League.TEAMS * League.STARTERS.FLEX).forEach((p) => rosteredIds.add(p.key));

  ['RB', 'WR', 'TE'].forEach((pos) => {
    const rostered = skill.filter((p) => p.pos === pos && rosteredIds.has(p.key));
    replacement[pos] = rostered.length
      ? Math.min(...rostered.map((p) => p.points))
      : 0;
  });
  return replacement;
}

function manGamesDemand() {
  return {
    QB: League.TEAMS * League.STARTERS.QB * League.WEEKS,
    RB: League.TEAMS * League.STARTERS.RB * League.WEEKS,
    WR: League.TEAMS * League.STARTERS.WR * League.WEEKS,
    TE: League.TEAMS * League.STARTERS.TE * League.WEEKS,
    FLEX: League.TEAMS * League.STARTERS.FLEX * League.WEEKS,
  };
}

function walkGames(sorted, demand) {
  const used = [];
  let acc = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const gp = sorted[i].gp > 0 ? sorted[i].gp : 0;
    if (gp <= 0) continue;
    const next = acc + gp;
    if (next >= demand) {
      const frac = (demand - acc) / gp;
      used.push(sorted[i]);
      return {
        used,
        cutoff: sorted[i],
        prev: used.length >= 2 ? used[used.length - 2] : sorted[i],
        frac,
        rank: i + frac,
        games: demand,
      };
    }
    acc = next;
    used.push(sorted[i]);
  }
  return {
    used,
    cutoff: used[used.length - 1] || null,
    prev: used[used.length - 2] || null,
    frac: 1,
    rank: used.length,
    games: acc,
  };
}

function manGamesReplacement(skill) {
  const demand = manGamesDemand();
  const sorted = {
    QB: skill.filter((p) => p.pos === 'QB').sort((a, b) => b.points - a.points),
    RB: skill.filter((p) => p.pos === 'RB').sort((a, b) => b.points - a.points),
    WR: skill.filter((p) => p.pos === 'WR').sort((a, b) => b.points - a.points),
    TE: skill.filter((p) => p.pos === 'TE').sort((a, b) => b.points - a.points),
  };

  const walks = {
    QB: walkGames(sorted.QB, demand.QB),
    RB: walkGames(sorted.RB, demand.RB),
    WR: walkGames(sorted.WR, demand.WR),
    TE: walkGames(sorted.TE, demand.TE),
  };

  const usedKeys = new Set();
  ['QB', 'RB', 'WR', 'TE'].forEach((pos) => {
    walks[pos].used.forEach((p) => usedKeys.add(p.key));
  });

  const leftover = skill
    .filter((p) => ['RB', 'WR', 'TE'].includes(p.pos) && !usedKeys.has(p.key))
    .sort((a, b) => b.points - a.points);
  const flexWalk = walkGames(leftover, demand.FLEX);
  flexWalk.used.forEach((p) => usedKeys.add(p.key));

  const replacement = {};
  const ranks = {};
  ['QB', 'RB', 'WR', 'TE'].forEach((pos) => {
    const atPos = skill
      .filter((p) => p.pos === pos && usedKeys.has(p.key))
      .sort((a, b) => b.points - a.points);
    const last = atPos[atPos.length - 1];
    replacement[pos] = last ? last.points : 0;
    ranks[pos] = atPos.length;
  });

  return {
    replacement,
    ranks,
    demand,
    walks,
    flexWalk,
    flexByPos: {
      RB: flexWalk.used.filter((p) => p.pos === 'RB').length,
      WR: flexWalk.used.filter((p) => p.pos === 'WR').length,
      TE: flexWalk.used.filter((p) => p.pos === 'TE').length,
    },
  };
}

function allocateIntegerDollars(rostered, vbdKey, rawKey, outKey, discretionary) {
  const vbdSum = rostered.reduce((s, p) => s + p[vbdKey], 0);
  rostered.forEach((p) => {
    const share = vbdSum > 0 ? (p[vbdKey] / vbdSum) * discretionary : 0;
    p[rawKey] = League.MIN_BID + share;
  });
  const floors = rostered.map((p) => Math.floor(p[rawKey] + 1e-9));
  const leftover = Math.round(
    rostered.reduce((s, p) => s + p[rawKey], 0) - floors.reduce((s, n) => s + n, 0),
  );
  const order = rostered
    .map((p, i) => ({ i, frac: p[rawKey] - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const bump = new Array(rostered.length).fill(0);
  for (let i = 0; i < leftover; i += 1) bump[order[i].i] = 1;
  rostered.forEach((p, i) => {
    p[outKey] = floors[i] + bump[i];
  });
  return vbdSum;
}

function assignVbdAndDollars(players) {
  const skill = players.filter((p) => League.SKILL_POSITIONS.includes(p.pos));
  const kdst = players.filter((p) => League.DOLLAR_FIXED_POSITIONS.includes(p.pos));

  const draftedRep = {};
  League.SKILL_POSITIONS.forEach((pos) => {
    const pts = skill
      .filter((p) => p.pos === pos)
      .map((p) => p.points)
      .sort((a, b) => b - a);
    draftedRep[pos] = replacementPoints(pts, Baselines.threeYearAvg[pos]);
  });
  const volsRep = volsReplacement(skill);
  const beer = manGamesReplacement(skill);

  skill.forEach((p) => {
    p.vbd = Math.max(0, p.points - beer.replacement[p.pos]);
    p.volsVbd = Math.max(0, p.points - volsRep[p.pos]);
    p.draftedVbd = Math.max(0, p.points - draftedRep[p.pos]);
  });

  skill.sort((a, b) => {
    if (b.vbd !== a.vbd) return b.vbd - a.vbd;
    return b.points - a.points;
  });

  const skillRostered = League.TOTAL_SPOTS - (League.TEAMS * 2);
  const rostered = skill.slice(0, skillRostered);
  const unrostered = skill.slice(skillRostered);
  unrostered.forEach((p) => {
    p.modelDollarsRaw = 0;
    p.modelDollars = 0;
    p.volsDollars = 0;
    p.draftedDollars = 0;
  });

  const discretionary = League.TOTAL_DOLLARS - League.TOTAL_SPOTS;
  const vbdSum = allocateIntegerDollars(rostered, 'vbd', 'modelDollarsRaw', 'modelDollars', discretionary);

  const volsOrder = [...rostered].sort((a, b) => {
    if (b.volsVbd !== a.volsVbd) return b.volsVbd - a.volsVbd;
    return b.points - a.points;
  });
  allocateIntegerDollars(volsOrder, 'volsVbd', 'volsDollarsRaw', 'volsDollars', discretionary);

  const draftedOrder = [...rostered].sort((a, b) => {
    if (b.draftedVbd !== a.draftedVbd) return b.draftedVbd - a.draftedVbd;
    return b.points - a.points;
  });
  allocateIntegerDollars(draftedOrder, 'draftedVbd', 'draftedDollarsRaw', 'draftedDollars', discretionary);

  const kSorted = kdst.filter((p) => p.pos === 'K').sort((a, b) => (a.espnAuc === b.espnAuc
    ? (a.espnSfRank || 999) - (b.espnSfRank || 999)
    : (b.espnAuc || 0) - (a.espnAuc || 0)));
  const dstSorted = kdst.filter((p) => p.pos === 'D/ST').sort((a, b) => (a.espnAuc === b.espnAuc
    ? (a.espnSfRank || 999) - (b.espnSfRank || 999)
    : (b.espnAuc || 0) - (a.espnAuc || 0)));

  function priceFixed(list) {
    list.forEach((p, i) => {
      p.vbd = 0;
      p.volsVbd = 0;
      p.draftedVbd = 0;
      p.modelDollarsRaw = i < League.TEAMS ? League.K_DST_PRICE : 0;
      p.modelDollars = p.modelDollarsRaw;
      p.volsDollars = p.modelDollars;
      p.draftedDollars = p.modelDollars;
    });
  }
  priceFixed(kSorted);
  priceFixed(dstSorted);

  const posRanks = { QB: 1, RB: 1, WR: 1, TE: 1, K: 1, 'D/ST': 1 };
  const all = [...skill, ...kSorted, ...dstSorted];
  all.sort((a, b) => {
    if (b.modelDollars !== a.modelDollars) return b.modelDollars - a.modelDollars;
    return b.points - a.points;
  });
  all.forEach((p, i) => {
    p.overallRank = i + 1;
    p.posRank = posRanks[p.pos];
    posRanks[p.pos] += 1;
  });
  let draftRank = 1;
  all.forEach((p) => {
    if (p.modelDollars >= League.MIN_BID) {
      p.draftRank = draftRank;
      draftRank += 1;
    } else {
      p.draftRank = null;
    }
  });

  return {
    players: all,
    replacement: beer.replacement,
    beer,
    volsRep,
    draftedRep,
    vbdSum,
    discretionary,
    skillRostered,
  };
}

function attachMarket(players, market) {
  players.forEach((p) => {
    if (!League.SKILL_POSITIONS.includes(p.pos)) {
      p.marketOverall = p.modelDollars;
      p.marketPos = p.modelDollars;
      return;
    }
    p.marketOverall = p.draftRank == null ? 0 : interpolateLookup(market.overall, p.draftRank);
    p.marketPos = interpolateLookup(market.byPos[p.pos], p.posRank);
    if (p.marketOverall == null) p.marketOverall = 0;
  });
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmt(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '';
  return Number(n).toFixed(digits);
}

function writeValuesCsv(players, outPath) {
  const headers = [
    'Rank', 'Player', 'Team', 'Pos', 'Pos Rank', 'My Rank', 'Tier',
    'Consensus Pos Rank', 'Rank Difference', 'Consensus Pts',
    'League Pts', 'VBD', 'Model $', 'VOLS $', 'Drafted $',
    'Market $ (pos rank)', 'Market $ (overall rank)', 'Market $ (consensus pos rank)',
    'Surplus vs Pos', 'Surplus vs Overall', 'Consensus Market Surplus',
    'Sources', 'GP', 'FP ADP', 'ESPN SF Rank', 'ESPN Auc $',
    'Pass Yds', 'Pass TD', 'INT',
    'Rush Yds', 'Rush TD', 'Rec', 'Rec Yds', 'Rec TD', 'FL', '2PC', 'Ret TD',
  ];
  const lines = [headers.join(',')];
  players.forEach((p) => {
    const marketPos = p.marketPos == null ? '' : Math.round(p.marketPos);
    const marketOverall = Math.round(p.marketOverall == null ? 0 : p.marketOverall);
    const marketConsensus = p.consensusMarketPos == null ? '' : Math.round(p.consensusMarketPos);
    const surplusPos = marketPos === '' ? '' : p.modelDollars - marketPos;
    const surplusOverall = marketOverall === '' ? '' : p.modelDollars - marketOverall;
    const surplusConsensusMarket = marketConsensus === '' ? '' : p.modelDollars - marketConsensus;
    lines.push([
      p.overallRank,
      csvEscape(p.name),
      p.team,
      p.pos,
      p.posRank,
      p.myRank == null ? '' : p.myRank,
      p.tier == null ? '' : p.tier,
      p.consensusPosRank == null ? '' : p.consensusPosRank,
      (p.myRank == null || p.consensusPosRank == null) ? '' : p.consensusPosRank - p.myRank,
      p.consensusPoints == null ? fmt(p.points, 1) : fmt(p.consensusPoints, 1),
      fmt(p.points, 1),
      fmt(p.vbd, 1),
      p.modelDollars,
      p.volsDollars == null ? '' : p.volsDollars,
      p.draftedDollars == null ? '' : p.draftedDollars,
      marketPos,
      marketOverall,
      marketConsensus,
      surplusPos,
      surplusOverall,
      surplusConsensusMarket,
      p.usedSources ? p.usedSources.join('+') : '',
      p.gp == null ? '' : fmt(p.gp, 1),
      p.fpAdp == null ? '' : fmt(p.fpAdp, 1),
      p.espnSfRank == null ? '' : p.espnSfRank,
      p.espnAuc == null ? '' : p.espnAuc,
      fmt(p.stats.passYds, 1),
      fmt(p.stats.passTds, 1),
      fmt(p.stats.ints, 1),
      fmt(p.stats.rushYds, 1),
      fmt(p.stats.rushTds, 1),
      fmt(p.stats.rec, 1),
      fmt(p.stats.recYds, 1),
      fmt(p.stats.recTds, 1),
      fmt(p.stats.fl, 1),
      fmt(p.stats.twoPt, 1),
      fmt(p.stats.returnTds, 1),
    ].join(','));
  });
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
}

function clonePlayersForValuation(players, pointsKey) {
  return players.map((p) => ({
    ...p,
    stats: { ...p.stats },
    sources: [...(p.sources || [])],
    usedSources: [...(p.usedSources || [])],
    points: p[pointsKey] != null ? p[pointsKey] : p.points,
  }));
}

function writeMoversCsv(players, outPath) {
  const headers = [
    'Player', 'Team', 'Pos', 'Tier',
    'My Rank', 'Consensus Pos Rank', 'Rank Delta',
    'Consensus Pts', 'Adj Pts', 'Pts Delta',
    'Consensus Model $', 'Model $', '$ vs Consensus',
    'Market $ (my pos rank)', 'Surplus vs Market',
    'Market $ (consensus pos rank)', 'Consensus Market Surplus',
  ];
  const lines = [headers.join(',')];
  const ranked = players
    .filter((p) => p.myRank != null && League.SKILL_POSITIONS.includes(p.pos))
    .sort((a, b) => {
      const aDollar = Math.abs(a.dollarVsConsensus || 0);
      const bDollar = Math.abs(b.dollarVsConsensus || 0);
      if (bDollar !== aDollar) return bDollar - aDollar;
      const aRank = Math.abs((a.consensusPosRank || 0) - a.myRank);
      const bRank = Math.abs((b.consensusPosRank || 0) - b.myRank);
      if (bRank !== aRank) return bRank - aRank;
      return a.myRank - b.myRank;
    });
  ranked.forEach((p) => {
    const rankDelta = p.consensusPosRank == null ? '' : p.consensusPosRank - p.myRank;
    const ptsDelta = p.consensusPoints == null ? '' : p.points - p.consensusPoints;
    const marketPos = p.marketPos == null ? '' : Math.round(p.marketPos);
    const surplusPos = marketPos === '' ? '' : p.modelDollars - marketPos;
    const consensusMarket = p.consensusMarketPos == null ? '' : Math.round(p.consensusMarketPos);
    lines.push([
      csvEscape(p.name),
      p.team,
      p.pos,
      p.tier == null ? '' : p.tier,
      p.myRank,
      p.consensusPosRank == null ? '' : p.consensusPosRank,
      rankDelta,
      p.consensusPoints == null ? '' : fmt(p.consensusPoints, 1),
      fmt(p.points, 1),
      ptsDelta === '' ? '' : fmt(ptsDelta, 1),
      p.consensusModelDollars == null ? '' : p.consensusModelDollars,
      p.modelDollars,
      p.dollarVsConsensus == null ? '' : p.dollarVsConsensus,
      marketPos,
      surplusPos,
      consensusMarket,
      consensusMarket === '' ? '' : p.modelDollars - consensusMarket,
    ].join(','));
  });
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
}

function writeMarketCsv(market, outPath) {
  const lines = ['Type,Pos,Rank,Historical $,Weighted N'];
  Object.entries(market.overall).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([rank, price]) => {
    const raw = market.overallRaw[rank];
    lines.push(['overall', '', rank, fmt(price, 2), fmt(raw ? raw.w : 0, 2)].join(','));
  });
  League.SKILL_POSITIONS.forEach((pos) => {
    Object.entries(market.byPos[pos]).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([rank, price]) => {
      const raw = market.byPosRaw[pos][rank];
      lines.push(['pos', pos, rank, fmt(price, 2), fmt(raw ? raw.w : 0, 2)].join(','));
    });
  });
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
}

function printDiagnostics(yearSummaries, beer, volsRep, draftedRep, players, vbdSum, discretionary, market) {
  console.log('--- Draft history ---');
  yearSummaries.forEach((y) => {
    const flag = [
      y.excluded ? ' EXCLUDED-from-market' : '',
      y.incomplete && !y.excluded ? ' INCOMPLETE' : '',
    ].join('');
    console.log(
      `${y.year}: n=${y.n} spent=$${y.spent} $1s=${y.dollarOnes}`
      + ` QB=${y.posCounts.QB || 0} RB=${y.posCounts.RB || 0}`
      + ` WR=${y.posCounts.WR || 0} TE=${y.posCounts.TE || 0}`
      + ` K=${y.posCounts.K || 0} D/ST=${y.posCounts['D/ST'] || 0}${flag}`,
    );
  });

  console.log('\n--- Man-games (Dupont, 17 weeks, no bye add-on) ---');
  console.log(`demand  QB=${beer.demand.QB} RB=${beer.demand.RB} WR=${beer.demand.WR} TE=${beer.demand.TE} FLEX=${beer.demand.FLEX}`);
  console.log(`flex filled by  RB=${beer.flexByPos.RB} WR=${beer.flexByPos.WR} TE=${beer.flexByPos.TE}`);
  League.SKILL_POSITIONS.forEach((pos) => {
    const last = beer.walks[pos] && beer.walks[pos].cutoff;
    console.log(
      `  ${pos} man-games rank ${beer.ranks[pos]}  replacement ${beer.replacement[pos].toFixed(1)} pts`
      + (last ? `  (slot-walk cutoff ${last.name})` : ''),
    );
  });

  console.log('\n--- Other baselines (comparison only, not used in Model $) ---');
  Object.entries(volsRep).forEach(([pos, pts]) => {
    console.log(`VOLS     ${pos} last starter = ${pts.toFixed(1)} league pts`);
  });
  Object.entries(draftedRep).forEach(([pos, pts]) => {
    console.log(`drafted  ${pos} rank ${Baselines.threeYearAvg[pos]} = ${pts.toFixed(1)} league pts`);
  });

  console.log('\n--- Historical $2 cliff (sanity check, not an input) ---');
  League.SKILL_POSITIONS.forEach((pos) => {
    const ranks = Object.keys(market.byPos[pos]).map(Number).sort((a, b) => a - b);
    let last2 = null;
    let first1 = null;
    ranks.forEach((r) => {
      if (market.byPos[pos][r] >= 2) last2 = { r, p: market.byPos[pos][r] };
      if (first1 == null && market.byPos[pos][r] <= 1.05) first1 = { r, p: market.byPos[pos][r] };
    });
    console.log(
      `  ${pos} last >=$2 rank ${last2 ? last2.r : '-'} ($${last2 ? last2.p.toFixed(2) : '-'})`
      + `  first ~$1 rank ${first1 ? first1.r : '-'}`,
    );
  });

  console.log(`\nVBD sum=${vbdSum.toFixed(1)}  discretionary=$${discretionary}`);
  const dollarSum = players.reduce((s, p) => s + p.modelDollars, 0);
  const volsSum = players.reduce((s, p) => s + (p.volsDollars || 0), 0);
  const draftedSum = players.reduce((s, p) => s + (p.draftedDollars || 0), 0);
  console.log(`Model $ sum=${dollarSum}  VOLS $ sum=${volsSum}  Drafted $ sum=${draftedSum}  (target ${League.TOTAL_DOLLARS})`);

  const bySource = {};
  players.filter((p) => League.SKILL_POSITIONS.includes(p.pos)).forEach((p) => {
    const key = (p.usedSources || []).slice().sort().join('+') || 'none';
    bySource[key] = (bySource[key] || 0) + 1;
  });
  console.log('\n--- Skill player source mix ---');
  Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
    console.log(`${k}: ${n}`);
  });

  console.log('\n--- Top 15 by Model $ (man-games, custom ranks applied) ---');
  players.slice(0, 15).forEach((p) => {
    console.log(
      `${String(p.overallRank).padStart(2)} ${p.pos}${p.posRank} ${p.name.padEnd(22)}`
      + ` ${fmt(p.points, 0).padStart(5)} pts  $${String(p.modelDollars).padStart(3)}`
      + `  vols $${String(p.volsDollars).padStart(3)}`
      + `  drafted $${String(p.draftedDollars).padStart(3)}`
      + `  mkt-pos $${p.marketPos == null ? '-' : Math.round(p.marketPos)}`
      + `  [${(p.usedSources || []).join('+')}]`,
    );
  });
}

function main() {
  const elBoberto = loadElBoberto();
  const fantasyPoints = loadFantasyPoints();
  const espn = loadEspn();
  console.log(`Loaded projections  el-boberto=${elBoberto.length}  fantasy-points=${fantasyPoints.length}  espn=${espn.length}`);

  const merged = mergeProjections(elBoberto, fantasyPoints, espn);
  const rankData = loadRanks();
  const rankResult = applyCustomRanks(merged, rankData);
  console.log(`Custom ranks: ${rankData.ranks.length} rows, remapped ${rankResult.remapped} skill players`);
  if (rankResult.duplicateRanks.length) {
    console.log(`Duplicate My Rank slots: ${rankResult.duplicateRanks.join(', ')}`);
  }
  console.log('Largest rank moves (consensus pos rank -> my rank):');
  rankResult.movers.filter((m) => Math.abs(m.delta) >= 5).slice(0, 15).forEach((m) => {
    const dir = m.delta > 0 ? 'up' : 'down';
    console.log(
      `  ${m.pos} ${m.name}: ${m.consensusPosRank} -> ${m.myRank} (${dir} ${Math.abs(m.delta)})`
      + `  pts ${m.consensusPts.toFixed(0)} -> ${m.adjPts.toFixed(0)}`,
    );
  });
  if (rankResult.stubs.length) {
    console.log(`Rank stubs at $0 (${rankResult.stubs.length}):`);
    rankResult.stubs.forEach((r) => {
      console.log(`  ${r.pos} ${r.name} (My Rank ${r.myRank})`);
    });
  }
  const leftoverUnmatched = rankResult.unmatched.filter((r) => !rankResult.stubs.some((s) => s.key === r.key));
  if (leftoverUnmatched.length) {
    console.log(`Unmatched ranks (${leftoverUnmatched.length}):`);
    leftoverUnmatched.forEach((r) => {
      console.log(`  ${r.pos} ${r.name} (My Rank ${r.myRank})`);
    });
  }

  const { picks, yearSummaries } = loadDrafts();
  const market = buildMarket(picks);
  const consensusValuation = assignVbdAndDollars(clonePlayersForValuation(merged, 'consensusPoints'));
  attachMarket(consensusValuation.players, market);
  const consensusByKey = new Map(consensusValuation.players.map((p) => [p.key, p]));

  const { players, beer, volsRep, draftedRep, vbdSum, discretionary } = assignVbdAndDollars(merged);
  attachMarket(players, market);
  players.forEach((p) => {
    const c = consensusByKey.get(p.key);
    p.consensusModelDollars = c ? c.modelDollars : 0;
    p.dollarVsConsensus = p.modelDollars - p.consensusModelDollars;
    if (League.SKILL_POSITIONS.includes(p.pos) && p.consensusPosRank != null) {
      p.consensusMarketPos = interpolateLookup(market.byPos[p.pos], p.consensusPosRank);
    } else if (League.DOLLAR_FIXED_POSITIONS.includes(p.pos)) {
      p.consensusMarketPos = p.modelDollars;
    } else {
      p.consensusMarketPos = null;
    }
  });

  const valuesPath = path.join(ROOT, `src/${YEAR}-auction-values.csv`);
  const marketPath = path.join(ROOT, `src/${YEAR}-market-curves.csv`);
  const moversPath = path.join(ROOT, `src/${YEAR}-movers.csv`);
  writeValuesCsv(players, valuesPath);
  writeMarketCsv(market, marketPath);
  writeMoversCsv(players, moversPath);
  printDiagnostics(yearSummaries, beer, volsRep, draftedRep, players, vbdSum, discretionary, market);

  const dollarMovers = players
    .filter((p) => p.myRank != null && League.SKILL_POSITIONS.includes(p.pos) && p.dollarVsConsensus)
    .sort((a, b) => Math.abs(b.dollarVsConsensus) - Math.abs(a.dollarVsConsensus));
  console.log('\n--- Largest $ movers (custom ranks vs consensus Model $) ---');
  dollarMovers.slice(0, 15).forEach((p) => {
    const dir = p.dollarVsConsensus > 0 ? 'up' : 'down';
    const rankBit = p.consensusPosRank == null
      ? `my ${p.myRank}`
      : `${p.consensusPosRank} -> ${p.myRank}`;
    console.log(
      `  ${p.pos} ${p.name}: ${rankBit}  $${p.consensusModelDollars} -> $${p.modelDollars}`
      + `  (${dir} $${Math.abs(p.dollarVsConsensus)})`,
    );
  });

  console.log(`\nWrote ${valuesPath}`);
  console.log(`Wrote ${marketPath}`);
  console.log(`Wrote ${moversPath}`);
}

main();
