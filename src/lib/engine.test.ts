import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, QUANTS, RIG_PRESETS } from "./catalog";
import { estimate, hitRate, memoryNeeded, rigMenu } from "./engine";

const model = (id: string) => MODELS.find((m) => m.id === id)!;
const quant = (id: string) => QUANTS.find((q) => q.id === id)!;
const rig = (id: string) => RIG_PRESETS.find((r) => r.id === id)!;

test("hit curve reproduces the Qwen3-30B trace calibration points", () => {
  const ws = model("qwen3-30b-a3b").moe!.ws;
  assert.ok(Math.abs(hitRate(0.5, ws) - 0.96) < 0.02);
  assert.ok(hitRate(0.25, ws) > 0.76 && hitRate(0.25, ws) < 0.87);
  assert.equal(hitRate(1, ws), 1);
  assert.equal(hitRate(0, ws), 0);
});

test("a model that fits runs fully resident and Strata has nothing to page", () => {
  const e = estimate(model("qwen3-30b-a3b"), quant("Q4_K_M"), rig("mbp-m4max-128"), 8192);
  assert.equal(e.modes.stock.placed.ssd, 0);
  assert.equal(e.modes.strata.hit, 1);
  assert.ok(e.modes.stock.tps > 60);
});

test("Qwen3-30B on a 16 GB MacBook: stock thrashes, Strata makes it usable", () => {
  const e = estimate(model("qwen3-30b-a3b"), quant("Q4_K_M"), rig("mba-m4-16"), 8192);
  assert.ok(e.modes.stock.placed.ssd > 0);
  assert.ok(e.modes.strata.tps > 5 * e.modes.stock.tps, `${e.modes.strata.tps} vs ${e.modes.stock.tps}`);
  assert.ok(e.modes.strataBias.tps >= e.modes.strata.tps);
});

test("dense models are not pageable", () => {
  const e = estimate(model("llama-3.3-70b"), quant("Q4_K_M"), rig("rtx4090-64"), 8192);
  assert.equal(e.modes.strata.applicable, false);
  assert.ok(e.modes.stock.tps > 1 && e.modes.stock.tps < 5, String(e.modes.stock.tps));
});

test("Strata needs less memory than stock to hit 10 tok/s on DeepSeek", () => {
  const args = [model("deepseek-v3.1"), quant("Q4_K_M"), rig("mbp-m4max-128"), 8192, 10] as const;
  const stockGB = memoryNeeded(...args, "stock")!;
  const strataGB = memoryNeeded(...args, "strataBias")!;
  assert.ok(strataGB < stockGB, `${strataGB} vs ${stockGB}`);
});

test("rig menu ranks runnable models first", () => {
  const menu = rigMenu(MODELS, rig("mba-m4-16"), 8192, 10);
  assert.equal(menu.length, MODELS.length);
  assert.ok(menu.some((m) => m.status === "unlocked"));
});
