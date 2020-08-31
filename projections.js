const Parser = require('./src/projections-parser');

const parser = new Parser('espn-auction-2020.csv');

(async () => {
  try {
    await parser.createAuctionCSV();
  } catch (e) {
    console.error(`parser failed with error: ${e.message}`);
  }
  console.log('parser finished');
})();