const CURRENCY = '₱'; // change to your currency symbol, for example '₱' or '¥'

const expenseForm = document.getElementById('expense-form');
const filterForm = document.getElementById('filter-form');
let range = { start: '', end: '' }; // the date range currently applied to the reports

const formatMoney = (v) => CURRENCY + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 });

async function request(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function showMessage(id, text, isError = false) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.classList.toggle('error', isError);
}

// Builds table rows with textContent, so typed text is never run as HTML
function fillTable(id, rows, columns, emptyText) {
  const body = document.getElementById(id);
  body.replaceChildren();

  if (!rows.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = columns;
    cell.className = 'empty';
    cell.textContent = emptyText;
    return;
  }
  for (const values of rows) {
    const tr = body.insertRow();
    values.forEach((value, i) => {
      const cell = tr.insertCell();
      cell.textContent = value;
      if (i === columns - 1) cell.className = 'num';
    });
  }
}

async function loadExpenses() {
  const rows = await request('/api/expenses');
  fillTable('expense-rows',
    rows.map((r) => [r.date, r.description, r.category, formatMoney(r.amount)]),
    4, 'No expenses recorded yet.');

  const list = document.getElementById('categories');
  list.replaceChildren(...[...new Set(rows.map((r) => r.category))].map((c) => new Option(c, c)));
}

async function loadReports() {
  const data = await request(`/api/reports?${new URLSearchParams(range)}`);
  for (const type of ['category', 'daily', 'monthly']) {
    fillTable(`${type}-rows`,
      data[type].map((r) => [r.label, formatMoney(r.total)]),
      2, 'No expenses in this range.');
  }
}

expenseForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = expenseForm.querySelector('button');
  button.disabled = true; // prevents saving twice on double click
  try {
    await request('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(expenseForm))),
    });
    expenseForm.reset();
    showMessage('form-message', 'Expense saved.');
    await Promise.all([loadExpenses(), loadReports()]);
  } catch (err) {
    showMessage('form-message', err.message, true);
  } finally {
    button.disabled = false;
  }
});

async function applyRange(next) {
  const previous = range;
  range = next;
  try {
    await loadReports();
    const { start, end } = range;
    showMessage('filter-message', start || end
      ? `Showing ${start || 'the beginning'} to ${end || 'the latest date'} (inclusive).`
      : 'Showing all dates.');
  } catch (err) {
    range = previous;
    showMessage('filter-message', err.message, true);
  }
}

filterForm.addEventListener('submit', (event) => {
  event.preventDefault();
  applyRange(Object.fromEntries(new FormData(filterForm)));
});

document.getElementById('clear').addEventListener('click', () => {
  filterForm.reset();
  applyRange({ start: '', end: '' });
});

Promise.all([loadExpenses(), applyRange(range)])
  .catch((err) => showMessage('form-message', err.message, true));
