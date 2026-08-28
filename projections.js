const Parser = require('./src/projections-parser');

const parser = new Parser('2026-projections.csv', '2026');

(async () => {
  try {
    await parser.createProjectionsCSV();
  } catch (e) {
    console.error(`parser failed with error: ${e.message}`);
  }
  console.log('parser finished');
})();