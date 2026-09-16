import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.js';

const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'store.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  price INTEGER NOT NULL DEFAULT 0,
  old_price INTEGER DEFAULT 0,
  sku TEXT DEFAULT '',
  stock INTEGER DEFAULT 0,
  short_desc TEXT DEFAULT '',
  description TEXT DEFAULT '',
  specs TEXT DEFAULT '[]',
  image TEXT DEFAULT '',
  gallery TEXT DEFAULT '[]',
  is_new INTEGER DEFAULT 0,
  is_hit INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  sort INTEGER DEFAULT 0,
  created_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  in_menu INTEGER DEFAULT 1,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  name TEXT, phone TEXT, email TEXT, city TEXT,
  delivery TEXT, payment TEXT, note TEXT,
  items TEXT DEFAULT '[]',
  total INTEGER DEFAULT 0,
  status TEXT DEFAULT 'new'
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  hash TEXT NOT NULL,
  salt TEXT NOT NULL
);
`);

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}

export function verifyPassword(password, user) {
  const attempt = Buffer.from(scryptSync(password, user.salt, 64).toString('hex'));
  const stored = Buffer.from(user.hash);
  return attempt.length === stored.length && timingSafeEqual(attempt, stored);
}

export const getSetting = (key, fallback = '') => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
};

export function allSettings() {
  const map = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all()) map[row.key] = row.value;
  return map;
}

export const setSetting = (key, value) =>
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value ?? ''));

export const json = (value, fallback) => {
  try { const out = JSON.parse(value); return out ?? fallback; } catch { return fallback; }
};
