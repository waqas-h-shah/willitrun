"use client";

import { useState } from "react";
import { RIG_PRESETS, type RigSpec } from "@/lib/catalog";

type Init = RigSpec & { id?: number; name: string };

const BLANK: Init = { name: "", kind: "unified", memGB: 32, memBw: 200, gpuLimitPct: 75, vramGB: 24, vramBw: 1000, ramGB: 64, ramBw: 80, ssdGBs: 5 };

export function RigForm({ action, initial, submitLabel }: { action: (f: FormData) => void; initial?: Init; submitLabel: string }) {
  const [v, setV] = useState<Init>(initial ?? BLANK);
  const set = (k: keyof Init) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: k === "name" ? e.target.value : Number(e.target.value) });
  const field = (k: keyof Init, label: string, unit: string, step = 1) => (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input className="input pr-14" type="number" step={step} name={k} value={v[k] as number} onChange={set(k)} />
        <span className="num pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mute">{unit}</span>
      </div>
    </div>
  );
  return (
    <form action={action} className="card space-y-5 p-5">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <div>
        <label className="label">Start from a preset</label>
        <select
          className="input"
          defaultValue=""
          onChange={(e) => {
            const p = RIG_PRESETS.find((x) => x.id === e.target.value);
            if (p) setV({ ...p, id: v.id, name: v.name || p.name });
          }}
        >
          <option value="">Choose a known machine…</option>
          {RIG_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Name</label>
        <input className="input" name="name" value={v.name} onChange={set("name")} placeholder="e.g. My MacBook, The basement 3090s" required />
      </div>
      <div>
        <label className="label">Architecture</label>
        <input type="hidden" name="kind" value={v.kind} />
        <div className="grid grid-cols-2 gap-2">
          {(["unified", "discrete"] as const).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setV({ ...v, kind: k })}
              className={`rounded-xl border p-3 text-left text-sm ${v.kind === k ? "border-acid bg-acid/10" : "border-line hover:border-mute"}`}
            >
              <b className="block">{k === "unified" ? "Unified memory" : "GPU + system RAM"}</b>
              <span className="text-xs text-mute">{k === "unified" ? "Apple Silicon, Strix Halo, DGX Spark" : "NVIDIA / AMD cards with separate VRAM"}</span>
            </button>
          ))}
        </div>
      </div>
      {v.kind === "unified" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {field("memGB", "Memory", "GB")}
          {field("memBw", "Bandwidth", "GB/s")}
          {field("gpuLimitPct", "GPU may use", "%")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {field("vramGB", "VRAM (all GPUs)", "GB")}
          {field("vramBw", "VRAM bandwidth", "GB/s")}
          {field("ramGB", "System RAM", "GB")}
          {field("ramBw", "RAM bandwidth", "GB/s")}
        </div>
      )}
      <div className="sm:w-1/3">{field("ssdGBs", "SSD read", "GB/s", 0.5)}</div>
      <p className="text-xs text-mute">
        Tip: macOS lets the GPU wire ~75% of memory by default (raise it with <code className="num">sysctl iogpu.wired_limit_mb</code>).
        SSD speed matters a lot here: it's what expert paging streams from.
      </p>
      <button className="btn">{submitLabel}</button>
    </form>
  );
}
