// Source: league spreadsheet of players actually drafted by position.
// 2020 is COVID ($260 budget, 3 extra bench spots) and is excluded from the
// 3-year average below. Auction values use `threeYearAvg` as replacement rank.
//
// Year     QB #    RB #    WR #    TE #
// Total    37.27   65.87   79.67   21.07
// 3 Year   38.00   66.33   77.33   20.67
// 2025     36      68      77      21
// 2024     40      65      77      21
// 2023     38      66      78      20
// 2022     34      61      84      20
// 2021     38      61      80      21
// 2020     41      74      92      29
// 2019     36      67      81      20
// 2018     39      65      82      18
// 2017     36      68      75      20
// 2016     36      67      78      21
// 2015     33      67      81      22
// 2014     38      63      81      20
// 2013     35      67      80      21
// 2012     41      64      75      20
// 2011     38      65      74      22

const byYear = {
  2025: { QB: 36, RB: 68, WR: 77, TE: 21 },
  2024: { QB: 40, RB: 65, WR: 77, TE: 21 },
  2023: { QB: 38, RB: 66, WR: 78, TE: 20 },
  2022: { QB: 34, RB: 61, WR: 84, TE: 20 },
  2021: { QB: 38, RB: 61, WR: 80, TE: 21 },
  2020: { QB: 41, RB: 74, WR: 92, TE: 29 },
  2019: { QB: 36, RB: 67, WR: 81, TE: 20 },
  2018: { QB: 39, RB: 65, WR: 82, TE: 18 },
  2017: { QB: 36, RB: 68, WR: 75, TE: 20 },
  2016: { QB: 36, RB: 67, WR: 78, TE: 21 },
  2015: { QB: 33, RB: 67, WR: 81, TE: 22 },
  2014: { QB: 38, RB: 63, WR: 81, TE: 20 },
  2013: { QB: 35, RB: 67, WR: 80, TE: 21 },
  2012: { QB: 41, RB: 64, WR: 75, TE: 20 },
  2011: { QB: 38, RB: 65, WR: 74, TE: 22 },
};

const allYearAvg = { QB: 37.27, RB: 65.87, WR: 79.67, TE: 21.07 };

// 2023–2025. These are the replacement ranks for VBD.
const threeYearAvg = { QB: 38.00, RB: 66.33, WR: 77.33, TE: 20.67 };

module.exports = {
  byYear,
  allYearAvg,
  threeYearAvg,
};
