const Parser = require('./src/draft-parser');

const parser = new Parser('draft.csv', '2023');

(async () => {
  try {
    await parser.createDraftCSV();
  } catch (e) {
    console.error(`parser failed with error: ${e.message}`);
  }
  console.log('parser finished');
})();