const statsMappings = {
  // passing
  0: 'attempts',
  1: 'completions',
  2: 'incompletions',
  3: 'passing yards',
  4: 'passing tds',
  19: 'passing 2pc',
  20: 'interceptions',
  21: 'completion pct',
  // rushing
  23: 'carries',
  24: 'rushing yards',
  25: 'rushing tds',
  26: 'rushing 2pc',
  // receiving
  42: 'receiving yards',
  43: 'receiving tds',
  44: 'receiving 2pc',
  53: 'receptions',
  58: 'targets',
  // misc
  72: 'lost fumbles',
  73: 'fumbles',
  // kicking
  74: 'fgm 50+',
  75: 'fga 50+',
  76: 'missed fg 50+',
  77: 'fgm 40',
  78: 'fga 40',
  79: 'missed fg 40',
  80: 'fgm 30',
  81: 'fga 30',
  82: 'missed fg 30',
  83: 'fgm',
  84: 'fga',
  85: 'missed fg',
  86: 'xpm',
  87: 'xpa',
  88: 'missed xp',
  // defense
  89: 'shutouts',
  90: '1-6 points allowed',
  91: '7-13 points allowed',
  92: '14-17 points allowed',
  93: 'blocked kick td',
  95: 'defense interceptions',
  96: 'defense fumbles',
  97: 'defense blocks',
  98: 'safeties',
  99: 'defense sacks',
  // tds
  101: 'kr tds',
  102: 'pr tds',
  103: 'fumble ret tds',
  104: 'interception ret tds',
  // defense
  123: '28-34 points allowed',
  124: '35-45 points allowed',
  129: '100-199 yards allowed',
  130: '200-299 yards allowed',
  132: '350-399 yards allowed',
  133: '400-449 yards allowed',
  134: '450-499 yards allowed',
  135: '500-549 yards allowed',
  136: '550+ yards allowed',
  // games
  210: 'games started', // TODO: Is this correct
};
