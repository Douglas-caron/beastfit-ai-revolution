import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { initializeSchema } from './schema.mjs';
import { seedDatabase } from './seed.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DB_PATH = process.env.BEASTFIT_DB || path.join(__dirname, 'data', 'beastfit.sqlite');
let db;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  initializeSchema(db);
  const count = db.prepare('SELECT COUNT(*) AS total FROM aluno').get().total;
  if (!count) seedDatabase(db);
  return db;
}

export function all(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

export function get(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

export function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

export function exec(sql) {
  return getDb().exec(sql);
}

export function transaction(callback) {
  const database = getDb();
  database.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = callback(database);
    database.exec('COMMIT;');
    return result;
  } catch (error) {
    database.exec('ROLLBACK;');
    throw error;
  }
}
