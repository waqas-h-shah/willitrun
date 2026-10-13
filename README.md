# Will It Run?

**Live:** https://willitrun.amperor.ai. Click "Try it as a guest" for a throwaway account with two starter rigs, or sign up.

Every time a new open-weight model drops, the same question comes up: *can my machine run it?* This app answers it with bandwidth math.
You describe your rig (unified-memory Mac/Strix Halo/DGX Spark, or GPU + system RAM) and get the following for any model:

- the **footprint**: weights at each quantization, KV cache for your context, and what has to be read per token
- **placement** across memory tiers (fast memory → system RAM → SSD) and a **tokens/sec estimate** in three runtime modes:
  1. **Stock** (llama.cpp / MLX): overflow gets mmap'd from SSD and thrashes the page cache
  2. **Strata paging (exact)**: keeps the dense core resident, caches routed experts, and streams misses from SSD
  3. **Strata + routing bias**: a quality-gated (≤0.5% perplexity) nudge toward cached experts
- a **quant ladder** that picks the highest-quality quant that still hits your target speed
- a **memory advisor**: how much memory you'd need to hit your target stock vs. with paging

The paging numbers come from [Strata](https://strata.amperor.ai), the open expert-paging runtime for MoE models I've been contributing to.
The expert-cache hit curves and routing-bias savings are calibrated on real routing traces (Qwen3-30B-A3B, Qwen3-Next, GLM-4.5-Air,
gpt-oss, Mixtral), and every model in the catalog says whether its numbers are *measured* or *estimated*.

## What works

- **Auth**: email/password sign-up and login (scrypt hashes, httpOnly session cookies, server-side sessions), one-click guest accounts, and logout.
- **Rigs**: create, edit and delete, starting from 10 hardware presets or custom specs. Each rig card shows how many models it runs natively and how many more Strata unlocks.
- **Checker** (`/check`): live calculator with model, quant, context, KV precision and target speed. Results are URL-addressable and shareable. Anonymous users can use it with preset rigs.
- **Rig menu** (`/rigs/:id`): the whole catalog ranked for one rig, grouped as *runs great*, *unlocked by Strata*, *below target* and *out of reach*, with a context-length switch.
- **Model catalog**: 15 models (dense and MoE) with cacheability evidence and a comparison across popular rigs.
- **Community runs**: log a real measured tok/s. The prediction is stored next to it, along with the error %, filters, "only mine", delete-own, and a per-runtime calibration summary (median estimator bias).
- **Wishlist**: star models and get a model × rig matrix on your dashboard. You can also set a personal target speed, which drives every "best quant" pick.
- **How it works** page: the full estimator math and assumptions, plus the hit-rate curve.
- Engine unit tests (`npm test`): calibration points, fit and no-fit cases, dense vs. MoE, and the memory advisor.

## What's incomplete / next

- No prefill / time-to-first-token model, batching, or PCIe latency for paging into VRAM (listed on the How page).
- The community board starts empty. The plan is to seed it with our own measured runs and then fit the efficiency constants per runtime from logged runs. Today the calibration is only displayed, not fed back into the estimator.
- No password reset or email verification. Guest accounts are never cleaned up.
- No upvoting or flagging of outlier runs. Runs aren't deduplicated.
- The catalog is a typed constant, not admin-editable.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3210  (SQLite file in ./data, created on first request)
npm test           # estimator unit tests
npm run build      # production build (Next standalone output)
```

Requires Node 22+. There's no external services and no environment variables. `DATA_DIR` optionally relocates the SQLite file.

## Stack and layout

TypeScript end to end: Next.js 15 (App Router, server components, server actions), SQLite via better-sqlite3, and Tailwind v4.

```
src/lib/engine.ts     the estimator: footprint, tier placement, 3 modes, quant ladder, memory advisor, rig menu
src/lib/catalog.ts    models (arch + Strata cacheability), quant ladder, rig presets
src/lib/db.ts         schema (users, sessions, rigs, runs, wishlist)
src/lib/auth.ts       scrypt + session cookies
src/app/actions.ts    every mutation (auth, rigs, runs, wishlist, target speed)
src/app/**/page.tsx   pages
deploy/               Docker deploy scripts (AWS EC2 + Caddy)
```

Deploy: `./deploy/deploy.sh` syncs the source to the server, builds the image there, and restarts the container. The SQLite file lives in a named Docker volume.
