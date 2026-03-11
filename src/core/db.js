import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

const dbDir = path.dirname(config.data.dbPath);
fs.mkdirSync(dbDir, { recursive: true });

export const db = new Database(config.data.dbPath);

function ensureColumns(table, columns) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  for (const [name, definition] of Object.entries(columns)) {
    if (!existing.includes(name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  }
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      retailer TEXT NOT NULL,
      item TEXT NOT NULL,
      price TEXT,
      crawled_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clustered_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      category TEXT NOT NULL,
      vegan INTEGER NOT NULL,
      item TEXT NOT NULL,
      source_retailer TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL UNIQUE,
      vegan_breakfast TEXT NOT NULL,
      vegan_lunch TEXT NOT NULL,
      vegan_dinner TEXT NOT NULL,
      vegan_snack TEXT NOT NULL,
      vegan_drink TEXT NOT NULL,
      omni_breakfast TEXT NOT NULL,
      omni_lunch TEXT NOT NULL,
      omni_dinner TEXT NOT NULL,
      omni_snack TEXT NOT NULL,
      omni_drink TEXT NOT NULL,
      co2_score REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_id INTEGER NOT NULL,
      option_type TEXT NOT NULL,
      meal_slot TEXT NOT NULL,
      title TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      steps TEXT NOT NULL,
      meta TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY(menu_id) REFERENCES menus(id)
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      action TEXT,
      acted_at TEXT,
      FOREIGN KEY(menu_id) REFERENCES menus(id)
    );

    CREATE TABLE IF NOT EXISTS guidelines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL,
      markdown TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      stage TEXT NOT NULL,
      ok INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `);

  ensureColumns('recipes', {
    meta: "TEXT NOT NULL DEFAULT '{}'"
  });
}
