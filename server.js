const { MongoClient, Decimal128 } = require('mongodb');
const createApp = require('./app');

try { process.loadEnvFile(); } catch { /* no .env file, e.g. on the hosting service */ }

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'spendlog';
const port = process.env.PORT || 3000;

async function start() {
  const client = new MongoClient(uri);
  await client.connect();
  const expenses = client.db(dbName).collection('expenses');
  await expenses.createIndex({ date: 1 });

  const app = createApp(expenses, (text) => Decimal128.fromString(text));
  app.listen(port, () => console.log(`SpendLog running at http://localhost:${port}`));
}

start().catch((err) => {
  console.error('Could not start SpendLog:', err.message);
  process.exit(1);
});
