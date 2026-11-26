const path = require('path');
const express = require('express');
const { validateExpense, readRange, reportPipeline, money } = require('./lib/expenses');

module.exports = function createApp(expenses, toDecimal) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Record an expense
  app.post('/api/expenses', async (req, res) => {
    const { error, value } = validateExpense(req.body);
    if (error) return res.status(400).json({ error });

    await expenses.insertOne({ ...value, amount: toDecimal(value.amount), createdAt: new Date() });
    res.status(201).json({ ok: true });
  });

  // Expense table: every recorded expense, newest date first
  app.get('/api/expenses', async (req, res) => {
    const rows = await expenses.find().sort({ date: -1, createdAt: -1 }).toArray();
    res.json(rows.map((r) => ({
      date: r.date,
      description: r.description,
      category: r.category,
      amount: money(r.amount),
    })));
  });

  // The three reports. Optional ?start=YYYY-MM-DD&end=YYYY-MM-DD (both inclusive)
  app.get('/api/reports', async (req, res) => {
    const { error, match } = readRange(req.query);
    if (error) return res.status(400).json({ error });

    const run = async (type) => {
      const rows = await expenses.aggregate(reportPipeline(type, match)).toArray();
      return rows.map((r) => ({ label: r._id, total: money(r.total) }));
    };

    const [category, daily, monthly] = await Promise.all([
      run('category'), run('daily'), run('monthly'),
    ]);
    res.json({ category, daily, monthly });
  });

  // Any unexpected error (for example, the database is unreachable)
  app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ error: status === 500 ? 'Server error. Please try again.' : 'Invalid request.' });
  });

  return app;
};
