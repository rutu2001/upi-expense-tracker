//THIS FILE IS NOT BEING USED AS OF NOW


const sqlite3 = require("sqlite3").verbose();

// Creates db.sqlite in server folder
const db = new sqlite3.Database("./db.sqlite", (err) => {
  if (err) {
    console.error("❌ Failed to connect DB", err);
  } else {
    console.log("✅ SQLite DB connected");
  }
});

// Create table if not exists
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sr_no INTEGER,
  date TEXT,
  description TEXT,
  amount INTEGER,
  type TEXT,
  category REAL,
  transaction_id TEXT,
  utr_no TEXT,
  paid_by TEXT
)
  `);
});

module.exports = db;
