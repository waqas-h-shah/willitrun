import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true });

const g = globalThis as unknown as { __wirDb?: Database.Database };

function open() {
  const db = new Database(path.join(dir, "willitrun.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT,
      is_guest INTEGER NOT NULL DEFAULT 0,
      target_tps REAL NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rigs (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('unified','discrete')),
      mem_gb REAL NOT NULL DEFAULT 0,
      mem_bw REAL NOT NULL DEFAULT 0,
      gpu_limit_pct REAL NOT NULL DEFAULT 75,
      vram_gb REAL NOT NULL DEFAULT 0,
      vram_bw REAL NOT NULL DEFAULT 0,
      ram_gb REAL NOT NULL DEFAULT 0,
      ram_bw REAL NOT NULL DEFAULT 0,
      ssd_gbs REAL NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rig_name TEXT NOT NULL,
      rig_json TEXT NOT NULL,
      model_id TEXT NOT NULL,
      quant TEXT NOT NULL,
      ctx INTEGER NOT NULL,
      runtime TEXT NOT NULL,
      mode TEXT NOT NULL,
      measured_tps REAL NOT NULL,
      predicted_tps REAL NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS wishlist (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      model_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, model_id)
    );
    CREATE INDEX IF NOT EXISTS runs_model ON runs(model_id);
  `);
  return db;
}

export const db = g.__wirDb ?? (g.__wirDb = open());

export type UserRow = { id: number; email: string; name: string; is_guest: number; target_tps: number };
export type RigRow = {
  id: number;
  user_id: number;
  name: string;
  kind: "unified" | "discrete";
  mem_gb: number;
  mem_bw: number;
  gpu_limit_pct: number;
  vram_gb: number;
  vram_bw: number;
  ram_gb: number;
  ram_bw: number;
  ssd_gbs: number;
};
export type RunRow = {
  id: number;
  user_id: number;
  rig_name: string;
  rig_json: string;
  model_id: string;
  quant: string;
  ctx: number;
  runtime: string;
  mode: string;
  measured_tps: number;
  predicted_tps: number;
  notes: string;
  created_at: string;
  user_name?: string;
};

export const rigSpec = (r: RigRow) => ({
  kind: r.kind,
  memGB: r.mem_gb,
  memBw: r.mem_bw,
  gpuLimitPct: r.gpu_limit_pct,
  vramGB: r.vram_gb,
  vramBw: r.vram_bw,
  ramGB: r.ram_gb,
  ramBw: r.ram_bw,
  ssdGBs: r.ssd_gbs,
});
