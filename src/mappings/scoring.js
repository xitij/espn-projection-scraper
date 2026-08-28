// Source: league scoring pasted by the commissioner (2026).
// Kicker and D/ST scoring are intentionally omitted: those slots are always $1.
//
// Passing TD          60     points
// Passing Yards        0.35  points per yard
// Passing INT        -30     points
// Rushing Att          0     points
// Rushing TD          60     points
// Rushing Yards        1     points per yard
// Fumble Lost        -20     points
// Receptions           5     points
// Receiving TD        60     points
// Receiving Yards      1     points per yard
// 2-point conversion  20     points (passing, rushing, or receiving)
// Return TD           60     points (any TD scores 60)
//
// 2PC and return TDs are projected only by ESPN in this repo. They are averaged
// in when present, not zero-filled from other sources.

const POINTS = {
  passTd: 60,
  passYard: 0.35,
  interception: -30,
  rushAtt: 0,
  rushTd: 60,
  rushYard: 1,
  fumbleLost: -20,
  reception: 5,
  recTd: 60,
  recYard: 1,
  twoPoint: 20,
  returnTd: 60,
};

function num(value) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function leaguePoints(stats) {
  const passYds = num(stats.passYds);
  const passTds = num(stats.passTds);
  const ints = num(stats.ints);
  const rushAtt = num(stats.rushAtt);
  const rushYds = num(stats.rushYds);
  const rushTds = num(stats.rushTds);
  const rec = num(stats.rec);
  const recYds = num(stats.recYds);
  const recTds = num(stats.recTds);
  const fl = num(stats.fl);
  const twoPt = num(stats.twoPt);
  const returnTds = num(stats.returnTds);

  return (
    passYds * POINTS.passYard +
    passTds * POINTS.passTd +
    ints * POINTS.interception +
    rushAtt * POINTS.rushAtt +
    rushYds * POINTS.rushYard +
    rushTds * POINTS.rushTd +
    rec * POINTS.reception +
    recYds * POINTS.recYard +
    recTds * POINTS.recTd +
    fl * POINTS.fumbleLost +
    twoPt * POINTS.twoPoint +
    returnTds * POINTS.returnTd
  );
}

module.exports = {
  POINTS,
  leaguePoints,
};
