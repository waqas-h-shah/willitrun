"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { db, rigSpec, type RigRow } from "@/lib/db";
import { endSession, hashPassword, requireUser, startSession, verifyPassword } from "@/lib/auth";
import { RIG_PRESETS, RUNTIMES, modelById, quantById, type RigSpec } from "@/lib/catalog";
import { estimate, type Mode } from "@/lib/engine";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string, min: number, max: number) => {
  const n = Number(f.get(k));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "/rigs");

// ---------- auth ----------

export async function signup(form: FormData) {
  const name = str(form, "name").slice(0, 60);
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(str(form, "next"));
  const back = (e: string) => redirect(`/signup?error=${encodeURIComponent(e)}&next=${encodeURIComponent(next)}`);
  if (!name) back("Tell us what to call you.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back("That email doesn't look right.");
  if (password.length < 8) back("Use at least 8 characters for your password.");
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) back("An account with that email already exists. Log in instead.");
  const { lastInsertRowid } = db.prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)").run(email, name, hashPassword(password));
  await startSession(Number(lastInsertRowid));
  redirect(next);
}

export async function login(form: FormData) {
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(str(form, "next"));
  const user = db.prepare("SELECT id, password_hash FROM users WHERE email = ?").get(email) as { id: number; password_hash: string | null } | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    redirect(`/login?error=${encodeURIComponent("Wrong email or password.")}&next=${encodeURIComponent(next)}`);
  }
  await startSession(user.id);
  redirect(next);
}

const GUEST_NAMES = ["Quantized Quokka", "Paged Panda", "Sparse Sparrow", "Expert Otter", "Cached Capybara", "Routed Raccoon"];

export async function guest() {
  const name = GUEST_NAMES[crypto.randomInt(GUEST_NAMES.length)];
  const email = `guest-${crypto.randomBytes(6).toString("hex")}@guest.willitrun`;
  const id = Number(db.prepare("INSERT INTO users (email, name, is_guest) VALUES (?, ?, 1)").run(email, name).lastInsertRowid);
  for (const presetId of ["mba-m4-16", "rtx4090-64"]) insertRig(id, RIG_PRESETS.find((p) => p.id === presetId)!.name, RIG_PRESETS.find((p) => p.id === presetId)!);
  await startSession(id);
  redirect("/rigs?welcome=1");
}

export async function logout() {
  await endSession();
  redirect("/");
}

export async function saveTarget(form: FormData) {
  const user = await requireUser();
  db.prepare("UPDATE users SET target_tps = ? WHERE id = ?").run(num(form, "target", 1, 200), user.id);
  revalidatePath("/", "layout");
}

// ---------- rigs ----------

function insertRig(userId: number, name: string, s: RigSpec) {
  return Number(
    db
      .prepare(
        `INSERT INTO rigs (user_id, name, kind, mem_gb, mem_bw, gpu_limit_pct, vram_gb, vram_bw, ram_gb, ram_bw, ssd_gbs)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(userId, name, s.kind, s.memGB, s.memBw, s.gpuLimitPct, s.vramGB, s.vramBw, s.ramGB, s.ramBw, s.ssdGBs).lastInsertRowid,
  );
}

function rigFromForm(form: FormData): { name: string; spec: RigSpec; error?: string } {
  const kind = str(form, "kind") === "discrete" ? "discrete" : "unified";
  const spec: RigSpec = {
    kind,
    memGB: kind === "unified" ? num(form, "memGB", 0, 4096) : 0,
    memBw: kind === "unified" ? num(form, "memBw", 0, 10000) : 0,
    gpuLimitPct: kind === "unified" ? num(form, "gpuLimitPct", 30, 100) : 100,
    vramGB: kind === "discrete" ? num(form, "vramGB", 0, 4096) : 0,
    vramBw: kind === "discrete" ? num(form, "vramBw", 0, 20000) : 0,
    ramGB: kind === "discrete" ? num(form, "ramGB", 0, 4096) : 0,
    ramBw: kind === "discrete" ? num(form, "ramBw", 0, 2000) : 0,
    ssdGBs: num(form, "ssdGBs", 0.1, 30),
  };
  const name = str(form, "name").slice(0, 80);
  let error: string | undefined;
  if (!name) error = "Give your rig a name.";
  else if (kind === "unified" && (spec.memGB < 4 || spec.memBw < 10)) error = "Unified rigs need memory (≥ 4 GB) and bandwidth (≥ 10 GB/s).";
  else if (kind === "discrete" && (spec.vramGB < 2 || spec.vramBw < 10)) error = "Discrete rigs need VRAM (≥ 2 GB) and VRAM bandwidth (≥ 10 GB/s).";
  return { name, spec, error };
}

export async function createRig(form: FormData) {
  const user = await requireUser();
  const { name, spec, error } = rigFromForm(form);
  if (error) redirect(`/rigs/new?error=${encodeURIComponent(error)}`);
  const id = insertRig(user.id, name, spec);
  redirect(`/rigs/${id}`);
}

export async function updateRig(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  const { name, spec, error } = rigFromForm(form);
  if (error) redirect(`/rigs/${id}/edit?error=${encodeURIComponent(error)}`);
  db.prepare(
    `UPDATE rigs SET name=?, kind=?, mem_gb=?, mem_bw=?, gpu_limit_pct=?, vram_gb=?, vram_bw=?, ram_gb=?, ram_bw=?, ssd_gbs=?
     WHERE id=? AND user_id=?`,
  ).run(name, spec.kind, spec.memGB, spec.memBw, spec.gpuLimitPct, spec.vramGB, spec.vramBw, spec.ramGB, spec.ramBw, spec.ssdGBs, id, user.id);
  redirect(`/rigs/${id}`);
}

export async function deleteRig(form: FormData) {
  const user = await requireUser();
  db.prepare("DELETE FROM rigs WHERE id = ? AND user_id = ?").run(Number(form.get("id")), user.id);
  redirect("/rigs");
}

// ---------- benchmark runs ----------

export async function logRun(form: FormData) {
  const user = await requireUser("/runs/new");
  const rig = db.prepare("SELECT * FROM rigs WHERE id = ? AND user_id = ?").get(Number(form.get("rigId")), user.id) as RigRow | undefined;
  const model = modelById(str(form, "modelId"));
  const quant = quantById(str(form, "quant"));
  const runtime = str(form, "runtime");
  const measured = Number(form.get("measured"));
  const ctx = num(form, "ctx", 512, 1048576);
  const back = (e: string) => redirect(`/runs/new?error=${encodeURIComponent(e)}`);
  if (!rig) back("Pick one of your rigs.");
  if (!model || !quant) back("Pick a model and quantization.");
  if (!(RUNTIMES as readonly string[]).includes(runtime)) back("Pick a runtime.");
  if (!Number.isFinite(measured) || measured <= 0 || measured > 5000) back("Measured speed should be a positive tokens/sec number.");
  // Strata runs are compared against the paging prediction; everything else against stock.
  const mode: Mode = runtime === "Strata" ? "strata" : "stock";
  const predicted = estimate(model!, quant!, rigSpec(rig!), ctx).modes[mode];
  db.prepare(
    `INSERT INTO runs (user_id, rig_name, rig_json, model_id, quant, ctx, runtime, mode, measured_tps, predicted_tps, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(user.id, rig!.name, JSON.stringify(rigSpec(rig!)), model!.id, quant!.id, ctx, runtime, mode, measured, predicted.tps, str(form, "notes").slice(0, 500));
  redirect(`/runs?mine=1&logged=1`);
}

export async function deleteRun(form: FormData) {
  const user = await requireUser("/runs");
  db.prepare("DELETE FROM runs WHERE id = ? AND user_id = ?").run(Number(form.get("id")), user.id);
  revalidatePath("/runs");
}

// ---------- wishlist ----------

export async function toggleWish(form: FormData) {
  const user = await requireUser("/models");
  const modelId = str(form, "modelId");
  if (!modelById(modelId)) return;
  const exists = db.prepare("SELECT 1 FROM wishlist WHERE user_id = ? AND model_id = ?").get(user.id, modelId);
  if (exists) db.prepare("DELETE FROM wishlist WHERE user_id = ? AND model_id = ?").run(user.id, modelId);
  else db.prepare("INSERT INTO wishlist (user_id, model_id) VALUES (?, ?)").run(user.id, modelId);
  revalidatePath("/", "layout");
}
