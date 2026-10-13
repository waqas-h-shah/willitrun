// Model catalog, quantization ladder and rig presets.
// Architecture numbers are from the public model cards (rounded). The MoE
// "cacheability" numbers come from the Strata routing-trace study: where a
// model was traced the evidence says "measured", otherwise it is an estimate.

export type MoeSpec = {
  experts: number; // routed experts per layer
  topK: number; // experts fired per token
  shared: boolean; // has an always-on shared expert
  expertB: number; // total routed-expert params, billions
  ws: number; // working-set fraction: share of experts that must be resident for ~95% hit rate
  bias: number; // share of miss traffic Strata's routing bias removes at <=0.5% perplexity cost
  evidence: string;
};

export type Model = {
  id: string;
  name: string;
  org: string;
  released: string;
  totalB: number;
  activeB: number;
  layers: number;
  kvLayers: number; // layers that keep a full-context KV cache
  kvElemsPerToken: number; // per KV layer: 2 * kvHeads * headDim (GQA) or the latent width (MLA)
  maxCtx: number;
  moe?: MoeSpec;
  nativeQuant?: string;
  blurb: string;
};

export const MODELS: Model[] = [
  {
    id: "qwen3-30b-a3b",
    name: "Qwen3-30B-A3B",
    org: "Alibaba Qwen",
    released: "2025-04",
    totalB: 30.5,
    activeB: 3.3,
    layers: 48,
    kvLayers: 48,
    kvElemsPerToken: 2 * 4 * 128,
    maxCtx: 131072,
    moe: {
      experts: 128,
      topK: 8,
      shared: false,
      expertB: 29.0,
      ws: 0.31,
      bias: 0.33,
      evidence:
        "Measured. ~80% of experts are reused within 8 tokens; an LRU cache of half the experts hits 94–98%. Routing bias saves 33% of miss traffic at ±0.0% perplexity.",
    },
    blurb: "The everyday MoE. Strata's reference model: tiny active set, very cacheable.",
  },
  {
    id: "qwen3-next-80b-a3b",
    name: "Qwen3-Next-80B-A3B",
    org: "Alibaba Qwen",
    released: "2025-09",
    totalB: 80,
    activeB: 3.0,
    layers: 48,
    kvLayers: 12,
    kvElemsPerToken: 2 * 2 * 256,
    maxCtx: 262144,
    moe: {
      experts: 512,
      topK: 10,
      shared: true,
      expertB: 78.5,
      ws: 0.2,
      bias: 0.17,
      evidence:
        "Measured. The most cacheable model in the Strata zoo despite having a shared expert. Strata Server ran it byte-identical at ~2× CPU-offload speed on an L40S.",
    },
    blurb: "512 tiny experts plus hybrid attention, so the KV cache is small. A paging dream.",
  },
  {
    id: "gpt-oss-20b",
    name: "gpt-oss-20b",
    org: "OpenAI",
    released: "2025-08",
    totalB: 20.9,
    activeB: 3.6,
    layers: 24,
    kvLayers: 12,
    kvElemsPerToken: 2 * 8 * 64,
    maxCtx: 131072,
    nativeQuant: "MXFP4",
    moe: {
      experts: 32,
      topK: 4,
      shared: false,
      expertB: 19.7,
      ws: 0.52,
      bias: 0.2,
      evidence:
        "Locality measured: experts are reused within 8 tokens 83–88% of the time, and the working set breathes between 4 and 22 of 32 experts. The bias saving is an estimate.",
    },
    blurb: "Ships natively in MXFP4. Fits on almost anything.",
  },
  {
    id: "gpt-oss-120b",
    name: "gpt-oss-120b",
    org: "OpenAI",
    released: "2025-08",
    totalB: 116.8,
    activeB: 5.1,
    layers: 36,
    kvLayers: 18,
    kvElemsPerToken: 2 * 8 * 64,
    maxCtx: 131072,
    nativeQuant: "MXFP4",
    moe: {
      experts: 128,
      topK: 4,
      shared: false,
      expertB: 115.3,
      ws: 0.4,
      bias: 0.2,
      evidence: "Estimated from gpt-oss-20b's measured locality.",
    },
    blurb: "A 117B model that only reads ~5B params per token. Made for 64–128 GB machines.",
  },
  {
    id: "glm-4.5-air",
    name: "GLM-4.5-Air",
    org: "Zhipu AI",
    released: "2025-07",
    totalB: 106,
    activeB: 12,
    layers: 46,
    kvLayers: 46,
    kvElemsPerToken: 2 * 8 * 128,
    maxCtx: 131072,
    moe: {
      experts: 128,
      topK: 8,
      shared: true,
      expertB: 100.3,
      ws: 0.45,
      bias: 0.4,
      evidence:
        "Measured. Routing bias saves 40% of miss traffic at −0.4% perplexity. In the real paged runtime it went from 6.6 to 11.5 tok/s at a 21 GB budget. The worst pagers benefit most.",
    },
    blurb: "The best agentic coder you can realistically page.",
  },
  {
    id: "qwen3-235b-a22b",
    name: "Qwen3-235B-A22B",
    org: "Alibaba Qwen",
    released: "2025-04",
    totalB: 235,
    activeB: 22,
    layers: 94,
    kvLayers: 94,
    kvElemsPerToken: 2 * 4 * 128,
    maxCtx: 131072,
    moe: {
      experts: 128,
      topK: 8,
      shared: false,
      expertB: 227.2,
      ws: 0.31,
      bias: 0.3,
      evidence: "Estimated from Qwen3-30B-A3B, which has the same routing family.",
    },
    blurb: "Frontier-ish quality. 130+ GB even at 4-bit.",
  },
  {
    id: "deepseek-v3.1",
    name: "DeepSeek-V3.1",
    org: "DeepSeek",
    released: "2025-08",
    totalB: 671,
    activeB: 37,
    layers: 61,
    kvLayers: 61,
    kvElemsPerToken: 576, // MLA latent (512) + rope key (64)
    maxCtx: 131072,
    moe: {
      experts: 256,
      topK: 8,
      shared: true,
      expertB: 654.5,
      ws: 0.35,
      bias: 0.13,
      evidence: "Estimated. The bias saving comes from DeepSeek-V2-Lite (measured −13%); the working set is extrapolated.",
    },
    blurb: "671B params. The classic 'you need a server' model.",
  },
  {
    id: "kimi-k2",
    name: "Kimi K2",
    org: "Moonshot AI",
    released: "2025-07",
    totalB: 1040,
    activeB: 32,
    layers: 61,
    kvLayers: 61,
    kvElemsPerToken: 576,
    maxCtx: 131072,
    moe: {
      experts: 384,
      topK: 8,
      shared: true,
      expertB: 1029.4,
      ws: 0.35,
      bias: 0.13,
      evidence: "Estimated from the DeepSeek-style architecture.",
    },
    blurb: "A trillion parameters. Let's see your rig try.",
  },
  {
    id: "mixtral-8x7b",
    name: "Mixtral 8x7B",
    org: "Mistral AI",
    released: "2023-12",
    totalB: 46.7,
    activeB: 12.9,
    layers: 32,
    kvLayers: 32,
    kvElemsPerToken: 2 * 8 * 128,
    maxCtx: 32768,
    moe: {
      experts: 8,
      topK: 2,
      shared: false,
      expertB: 45.1,
      ws: 0.94,
      bias: 0.22,
      evidence:
        "Measured, and the counterexample: the working set saturates at ~7.5 of 8 experts, so it's effectively un-pageable. Bias still saves 22%.",
    },
    blurb: "The OG open MoE, and the one that breaks the paging laws.",
  },
  {
    id: "llama-3.1-8b",
    name: "Llama 3.1 8B",
    org: "Meta",
    released: "2024-07",
    totalB: 8.0,
    activeB: 8.0,
    layers: 32,
    kvLayers: 32,
    kvElemsPerToken: 2 * 8 * 128,
    maxCtx: 131072,
    blurb: "The hello-world of local LLMs.",
  },
  {
    id: "qwen3-8b",
    name: "Qwen3-8B",
    org: "Alibaba Qwen",
    released: "2025-04",
    totalB: 8.2,
    activeB: 8.2,
    layers: 36,
    kvLayers: 36,
    kvElemsPerToken: 2 * 8 * 128,
    maxCtx: 131072,
    blurb: "Small, dense and surprisingly sharp. A great laptop default.",
  },
  {
    id: "mistral-small-3.2",
    name: "Mistral Small 3.2 24B",
    org: "Mistral AI",
    released: "2025-06",
    totalB: 23.6,
    activeB: 23.6,
    layers: 40,
    kvLayers: 40,
    kvElemsPerToken: 2 * 8 * 128,
    maxCtx: 131072,
    blurb: "Dense 24B: the sweet spot for a 24–32 GB GPU.",
  },
  {
    id: "gemma-3-27b",
    name: "Gemma 3 27B",
    org: "Google",
    released: "2025-03",
    totalB: 27.4,
    activeB: 27.4,
    layers: 62,
    kvLayers: 11, // 5:1 local:global attention, so only ~1 in 6 layers keeps full context
    kvElemsPerToken: 2 * 16 * 128,
    maxCtx: 131072,
    blurb: "Dense, multimodal, and a cheap KV cache thanks to sliding-window layers.",
  },
  {
    id: "qwen3-32b",
    name: "Qwen3-32B",
    org: "Alibaba Qwen",
    released: "2025-04",
    totalB: 32.8,
    activeB: 32.8,
    layers: 64,
    kvLayers: 64,
    kvElemsPerToken: 2 * 8 * 128,
    maxCtx: 131072,
    blurb: "Dense 32B. Every parameter, every token.",
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B",
    org: "Meta",
    released: "2024-12",
    totalB: 70.6,
    activeB: 70.6,
    layers: 80,
    kvLayers: 80,
    kvElemsPerToken: 2 * 8 * 128,
    maxCtx: 131072,
    blurb: "The dense 70B that made a generation of people buy a second GPU.",
  },
];

export const modelById = (id: string) => MODELS.find((m) => m.id === id);

export type Quant = { id: string; bpw: number; quality: string; score: number };

// Ordered best quality to smallest.
export const QUANTS: Quant[] = [
  { id: "F16", bpw: 16, quality: "Reference", score: 100 },
  { id: "Q8_0", bpw: 8.5, quality: "≈ lossless", score: 99 },
  { id: "Q6_K", bpw: 6.56, quality: "Excellent", score: 97 },
  { id: "Q5_K_M", bpw: 5.69, quality: "Very good", score: 95 },
  { id: "Q4_K_M", bpw: 4.89, quality: "Good, the sweet spot", score: 92 },
  { id: "MXFP4", bpw: 4.25, quality: "Good (native for gpt-oss)", score: 91 },
  { id: "Q3_K_M", bpw: 3.91, quality: "Noticeable loss", score: 84 },
  { id: "IQ2_XXS", bpw: 2.2, quality: "Rough, big models only", score: 68 },
];

export const quantById = (id: string) => QUANTS.find((q) => q.id === id);

export type RigSpec = {
  kind: "unified" | "discrete";
  memGB: number; // unified: total memory
  memBw: number; // unified: GB/s
  gpuLimitPct: number; // unified: share of memory the GPU may wire
  vramGB: number; // discrete: total VRAM across GPUs
  vramBw: number; // discrete: GB/s per GPU (layer-split, so per-token bandwidth doesn't add)
  ramGB: number; // discrete: system RAM
  ramBw: number; // discrete: GB/s
  ssdGBs: number; // sequential read GB/s
};

export type RigPreset = RigSpec & { id: string; name: string; note: string };

const unified = (memGB: number, memBw: number, ssdGBs: number, gpuLimitPct = 75) => ({
  kind: "unified" as const,
  memGB,
  memBw,
  gpuLimitPct,
  vramGB: 0,
  vramBw: 0,
  ramGB: 0,
  ramBw: 0,
  ssdGBs,
});
const discrete = (vramGB: number, vramBw: number, ramGB: number, ramBw: number, ssdGBs: number) => ({
  kind: "discrete" as const,
  memGB: 0,
  memBw: 0,
  gpuLimitPct: 100,
  vramGB,
  vramBw,
  ramGB,
  ramBw,
  ssdGBs,
});

export const RIG_PRESETS: RigPreset[] = [
  { id: "mba-m4-16", name: "MacBook Air M4 · 16 GB", note: "The everyday laptop.", ...unified(16, 120, 3) },
  { id: "mbp-m4pro-48", name: "MacBook Pro M4 Pro · 48 GB", note: "", ...unified(48, 273, 6) },
  { id: "mbp-m4max-128", name: "MacBook Pro M4 Max · 128 GB", note: "", ...unified(128, 546, 7) },
  { id: "studio-m3u-512", name: "Mac Studio M3 Ultra · 512 GB", note: "The 'just buy more memory' answer.", ...unified(512, 819, 7) },
  { id: "strix-halo-128", name: "Ryzen AI Max+ 395 · 128 GB", note: "", ...unified(128, 256, 7, 85) },
  { id: "dgx-spark", name: "NVIDIA DGX Spark · 128 GB", note: "", ...unified(128, 273, 6, 90) },
  { id: "rtx4090-64", name: "RTX 4090 24 GB + 64 GB DDR5", note: "", ...discrete(24, 1008, 64, 80, 7) },
  { id: "rtx5090-96", name: "RTX 5090 32 GB + 96 GB DDR5", note: "", ...discrete(32, 1792, 96, 90, 12) },
  { id: "2x3090-128", name: "2× RTX 3090 (48 GB) + 128 GB DDR4", note: "", ...discrete(48, 936, 128, 50, 5) },
  { id: "laptop-4060", name: "Gaming laptop RTX 4060 8 GB + 32 GB", note: "", ...discrete(8, 256, 32, 60, 5) },
];

export const RUNTIMES = ["llama.cpp", "MLX", "Ollama", "LM Studio", "vLLM", "Strata", "other"] as const;
