function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cur = '';
    } else if (c !== '\r') {
      cur += c;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
}

function parseNumber(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === '' || s === '-' || s === 'NA' || s === 'N/A') return null;
  const n = Number(s.replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

module.exports = {
  parseCsv,
  parseNumber,
};
