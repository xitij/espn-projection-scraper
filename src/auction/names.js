const TEAM_ALIASES = {
  ARI: 'ARI', ARZ: 'ARI',
  ATL: 'ATL',
  BAL: 'BAL', BLT: 'BAL',
  BUF: 'BUF',
  CAR: 'CAR',
  CHI: 'CHI',
  CIN: 'CIN',
  CLE: 'CLE', CLV: 'CLE',
  DAL: 'DAL',
  DEN: 'DEN',
  DET: 'DET',
  GB: 'GB', GNB: 'GB',
  HOU: 'HOU', HST: 'HOU',
  IND: 'IND',
  JAX: 'JAX', JAC: 'JAX',
  KC: 'KC', KAN: 'KC',
  LAC: 'LAC', SD: 'LAC', SDG: 'LAC',
  LAR: 'LAR', LA: 'LAR', STL: 'LAR',
  LVR: 'LVR', LV: 'LVR', OAK: 'LVR', RAI: 'LVR',
  MIA: 'MIA',
  MIN: 'MIN',
  NE: 'NE', NWE: 'NE', NEP: 'NE',
  NO: 'NO', NOR: 'NO',
  NYG: 'NYG',
  NYJ: 'NYJ',
  PHI: 'PHI',
  PIT: 'PIT',
  SEA: 'SEA',
  SF: 'SF', SFO: 'SF',
  TB: 'TB', TAM: 'TB', TBB: 'TB',
  TEN: 'TEN', OTI: 'TEN',
  WSH: 'WSH', WAS: 'WSH', WFT: 'WSH',
};

function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTeam(team) {
  const key = String(team || '').trim().toUpperCase();
  return TEAM_ALIASES[key] || key;
}

function normalizePosition(pos) {
  const p = String(pos || '').trim().toUpperCase();
  if (p === 'DST' || p === 'D/ST' || p === 'DEF' || p === 'DEFENSE') return 'D/ST';
  if (p === 'PK' || p === 'KICKER') return 'K';
  return p;
}

function playerKey(name, pos) {
  return `${normalizeName(name)}|${normalizePosition(pos)}`;
}

module.exports = {
  TEAM_ALIASES,
  normalizeName,
  normalizeTeam,
  normalizePosition,
  playerKey,
};
