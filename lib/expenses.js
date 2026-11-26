// Dates are stored as "YYYY-MM-DD" text. A calendar date has no time zone,
// so it never shifts by a day, and text order is the same as date order.
function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const clean = (s) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '');

// "food", "FOOD" and "Food" all become "Food", so they share one report row.
const toCategory = (s) => clean(s).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

function validateExpense(body = {}) {
  const date = body.date;
  const description = clean(body.description);
  const category = toCategory(body.category);
  const amount = String(body.amount ?? '').trim();

  if (!isDate(date)) return { error: 'Enter a valid date.' };
  if (!description || description.length > 100) return { error: 'Description is required (100 characters max).' };
  if (!category || category.length > 40) return { error: 'Category is required (40 characters max).' };
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    return { error: 'Amount must be greater than 0, with at most 2 decimal places.' };
  }
  return { value: { date, description, category, amount } };
}

function readRange({ start, end } = {}) {
  if (start && !isDate(start)) return { error: 'Start date is not valid.' };
  if (end && !isDate(end)) return { error: 'End date is not valid.' };
  if (start && end && start > end) return { error: 'Start date must be on or before end date.' };

  const date = {};
  if (start) date.$gte = start; // includes the start date
  if (end) date.$lte = end;     // includes the end date
  return { match: start || end ? { date } : {} };
}

function reportPipeline(type, match) {
  const groupBy = {
    category: '$category',
    daily: '$date',
    monthly: { $substrBytes: ['$date', 0, 7] }, // "YYYY-MM"
  }[type];

  return [
    { $match: match },
    { $group: { _id: groupBy, total: { $sum: '$amount' } } },
    { $sort: { _id: 1 } },
  ];
}

// Turns a Decimal128 (or number) into text with 2 decimals
const money = (v) => Number(String(v)).toFixed(2);

module.exports = { isDate, validateExpense, readRange, reportPipeline, money };
