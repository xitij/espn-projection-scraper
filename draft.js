const Parser = require('./src/projections-parser');

const parser = new Parser('draft.csv', '2021');

(async () => {
  try {
    await parser.createProjectionsCSV();
  } catch (e) {
    console.error(`parser failed with error: ${e.message}`);
  }
  console.log('parser finished');
})();