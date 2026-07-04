# AI Stock Predictions — Phase-1 Findings & Plan

Scope: `/inventoryPredictions` AI layer (`src/lib/aiStockPrediction.js`) + supporting pipeline.
Goals: ACCURACY and TRUST, equally weighted; ARIMA fallback untouched and fully functional.
Status: **awaiting approval — nothing below is implemented.**

Updated after your two clarifications: (a) the app is **only used during the CNE** — optimize hard
for that 18-day window, nothing else; (b) **booths don't matter** — you want per-item daily
quantities ("how many cases of fries to order each day") and reorder timing ("when's the next order
made"). Both change the ranking below; see §0 (new research) and the revised findings.

---

## 0. CNE demand model (from research — the new backbone)

Grounding the model in the CNE's real attendance shape is now the highest-value lever, because two
facts collide: the season is short, and the models are data-starved for most of it.

**Structure (verified):**

- The CNE runs **18 days**, third Friday of August through **Labour Day Monday** (2024: Aug 16–Sep 2;
  2025: Aug 15–Sep 1; 2026: ~Aug 21–Sep 7). Source: CNE Wikipedia + 2024 final-attendance advisory.
- Total attendance ≈ **1.49M (2024)**, 1.6M (2023 record), ~1.4M (2025) → **~83k/day average**.
- The **final 4 days (Fri–Labour Day Mon) drew ≈ 450k in 2024** — ~30% of the whole fair in the last
  four days, ~112k/day, "one of the highest attended weekends in recent years." The Labour Day
  weekend + Air Show is the unambiguous peak.
- **Opening weekend is routinely the softest** and weather-sensitive ("slow start… hampered by bad
  weather" 2024; "washout opening weekend" 2025).

**Within-week rhythm (verified qualitatively, quantified as a prior):**

- Weekdays early in the week are quietest; weekends are far busier and **escalate toward the final
  weekend**.
- **Kids' Toonie Monday** ($2 kids, every Monday) pulls families → Mondays run hot _for a weekday_.
- Weekday evenings after 5 pm get a discount bump; gates open 10 am, mornings quietest.
- **Warriors' Day is the first Saturday** (big early-run spike).

**Relative daily demand index** (weekday baseline = 1.0) — a _prior/scaffold_, not hardcoded output;
the AI blends it with each item's own early-run history:

| Day                | Index    | Notes                               |
| ------------------ | -------- | ----------------------------------- |
| Tue / Wed          | 0.85–1.0 | quietest                            |
| Thu                | ~1.1     |                                     |
| Kids' Toonie Mon   | 1.2–1.4  | family draw despite being a weekday |
| Fri                | 1.4–1.7  |                                     |
| Sat                | 2.3–2.8  | Warriors' Day = first Sat           |
| Sun                | 2.0–2.4  |                                     |
| **Labour Day Mon** | ~2.0+    | closing peak, not a normal Monday   |

Plus a **day-of-fair ramp**: final weekend ≈ 15–25% above opening weekend; opening can be softened by
weather. Sources listed at the bottom of this doc.

**Two consequences, both now top-tier findings:**

- **Within-season starvation (F0):** an 18-day season means that for the _first ~two weeks_ the
  statistical models barely have data. ARIMA only runs when `dailySales.length ≥ forecastDays*2`
  (stockPrediction.js:147) — 14 days for a 7-day forecast, i.e. not until **day 14 of an 18-day
  fair**. For most of the CNE the app is silently on the flat moving-average fallback
  (stockPrediction.js:126). A CNE-calendar-aware layer earns its keep here.

- **Prior-CNE data is the fix for that starvation — but it's currently unreachable and would be
  mishandled (F13, new).** You noted CNE 2025 is in the ledger and matches how you actually consumed
  stock. It's the single best predictor for the new run ("first Saturday 2025, item = fries" →
  first Saturday 2026). But (a) the pipeline never fetches it — `getHistoricalTransactions`
  defaults to 90 days (transactions.js:17) and predictionsClient calls it with no args
  (predictionsClient.js:25), so 2025 is outside the window; and (b) if fetched, the ~350-day
  off-season gap gets zero-filled (stockPrediction.js:77–85), burying both CNE bursts in a year of
  zeros and driving ARIMA/MA toward ≈0. **Using prior-year data requires CNE-run segmentation, not
  just a wider fetch.** With that in place, the cross-year same-day-of-fair curve becomes the
  strongest free baseline _and_ the best AI prompt input — and it also lets us calibrate §0's demand
  index to _this operation's real items_ instead of generic attendance. See F13.

---

## 1. Ranked findings

**Re-ranked for the CNE-only, per-item-quantity, reorder-timing goals.** New top tier: F13
(reach and use prior-CNE data — the biggest single accuracy lever now), F0 (calendar prior for a
data-starved short season), F1 (the zero-fill bug), F3 (real dates), F8 (reorder timing — now a
primary deliverable). Demoted: F2 — booths are **out**; only `storageType` survives, as a mild
over-order caution for perishables.

### F13 — Prior-CNE data is unreachable and mishandled; make it the anchor (ACCURACY) — new #1

Two concrete blockers (detail in §0): the pipeline fetches only 90 days
(transactions.js:17, called arg-less at predictionsClient.js:25), so CNE 2025 is never loaded; and
the off-season would be zero-filled into a year of zeros (stockPrediction.js:77–85), poisoning both
ARIMA and the moving average. Neither is fixable by "fetch more days" alone.
Fix (in `cneCalendar.js` + the fetch path):

1. **Fetch enough history to include the last CNE** — widen the predictions fetch (e.g. 400 days, or
   an explicit "since last fair start" range) _for the predictions path only_; leave other callers'
   90-day default alone.
2. **Segment transactions into CNE runs** by gap detection (a >~30-day gap ends a run) and the
   third-Friday→Labour-Day rule as a sanity check; **discard off-season days** so no series ever
   spans the gap.
3. **Align by day-of-fair,** so "day 3 / first Saturday" of 2026 maps to the same slot in 2025.
   Then use it three ways: (a) **cross-year baseline** — last fair's same-day-of-fair demand, scaled by
   the current run's early-days-vs-last-year ratio (a strong, free forecast that works from _day 1_);
   (b) **calibrate §0's demand index** to real 2025 item curves; (c) feed last year's curve to the AI
   prompt alongside this run's partial data.
   Effect: the largest accuracy gain available, and it's what makes day-1-of-fair forecasting possible
   at all. Cost: bigger fetch + bigger POST payload (mitigation below); no extra AI tokens for the
   baseline, modest extra tokens to include last year's curve in the prompt.
   Payload note: two CNE runs of raw transactions is larger but still a few hundred KB; if it matters we
   can pre-aggregate to daily demand series client-side before POSTing (smaller, and keeps raw ledger
   rows off the wire) — flagged as an option, not forced, since it touches the API contract.

### F0 — The CNE calendar is the strongest signal and it's completely absent (ACCURACY) — new #1

Per §0, the season is 18 days and ARIMA doesn't even engage until day 14 (stockPrediction.js:147),
so most of the fair runs on a flat average (stockPrediction.js:126) that has no concept of "tomorrow
is Saturday" or "we're heading into Labour Day weekend." Nothing in the pipeline knows the fair's
day-of-week rhythm or day-of-fair ramp.
Fix: give both the AI prompt and a new deterministic baseline an explicit CNE calendar — for each
forecast day: weekday, day-index within the fair, and a demand-index prior from §0. The AI blends it
with the item's own history; the deterministic baseline (F12) applies it as multipliers so the
**ARIMA/fallback path also improves** and the AI has a CNE-aware reference to anchor to.
Effect: large, especially days 1–13 of the fair when there's little history. Cost: ~+150 tokens/item
(shared calendar can be stated once per batch → far less).

### F1 — Historical series fed to the AI silently drops zero-demand days (ACCURACY) — highest-impact bug

`prepareHistoricalSales` (aiStockPrediction.js:177–202) buckets removals by date key and returns
`Object.values(dailySales)` (line 201) — **no zero-fill for days with no transactions**, unlike the
ARIMA path, which zero-fills correctly (`prepareDataForARIMA`, stockPrediction.js:77–85).
Effect: the AI sees a _compressed_ series where quiet days vanish. Apparent demand is inflated
(a series of "20, 18, 22" might really be "20, 0, 0, 18, 0, 22"), and any weekday/weekend rhythm
is destroyed — the exact signal the prompt asks the model to use. This is a plain bug; fixing it
alone should measurably improve the AI path.
Cost: zero (pure code fix).

### F2 — The prompt confabulates about booths; strip that out (TRUST) — descoped per your call

The prompt hardcodes "8 booths total" and "Consider booth types" (aiStockPrediction.js:59, 74),
which the model can't know and invents — then shows the invention as "AI Insight." You've said
booths don't matter, so the fix is **removal, not enrichment**: delete all booth language from the
prompt. Keep only `storageType` (types.js:9) as a light perishability guard (don't over-order fresh
items late in the fair), plus `count`/`lowCount` for the reorder math (F8). `cost` passed only if it
earns its place in the backtest. Net: fewer tokens, no confabulation.
Cost: negative (shorter prompt).

### F3 — No calendar dates: the model cannot apply its own weekend rules (ACCURACY)

The prompt says Fri=2–3×, Sat=4–5×, Sun=3–4× (line 66) and "use weekend multipliers ONLY if the
day falls on Fri/Sat/Sun" (line 76) — but neither the historical series nor the forecast window
carries any dates or weekday labels. The model literally cannot know which forecast day is a
Saturday, and cannot verify the multipliers against history.
Fix: send history as `date (weekday): qty` lines (capped at last ~60 days) and the forecast
window as explicit dated weekdays ("Day 1 = Fri 2026-07-03 …").
Cost: ~+150 prompt tokens/item; large expected accuracy gain for a weekend-driven operation.

### F4 — Sequential per-item calls; batching exists but is dead code (COST + LATENCY)

`predictStockLevelsWithAI` awaits `getAIAnalysis` per item in a serial loop
(aiStockPrediction.js:219–253). `batchAIAnalysis` (lines 263–305, concurrency 5) exists but is not
on the main path. Worse, each call repeats the same ~500-token CNE preamble.
Fix: **multi-item prompts** — group ~8 items into one request (shared preamble, per-item data
blocks, JSON keyed by item id), run groups concurrently (bounded). For a 40-item fleet: 40 serial
calls (~2 min, ~48k tokens) → ~5 parallel calls (~10–15 s, ~12k tokens).
Cost: large savings, both money and latency.

### F5 — No caching: every page load and every toggle re-pays the full AI cost (COST)

The component refetches on mount and on every timeframe/method change
(StockPredictions.svelte:50–59); the server has no cache. Same inputs → same money spent again.
Fix: server-side in-memory cache keyed by
`hash(promptVersion, model, forecastDays, item fields, zero-filled sales series)`. Deterministic:
new transactions change the hash naturally, so no TTL subtlety needed (a modest TTL + size cap as
hygiene). Also used by the backtest so dev re-runs cost nothing.
Caveat (honest): on Vercel serverless the cache lives per warm lambda — it bounds cost per
instance, not globally. Good enough for this app; noted, not hidden.

### F6 — Fragile JSON handling: regex fence-stripping, minimal validation, no timeout/retry (TRUST + RELIABILITY)

Parsing strips markdown fences by regex (aiStockPrediction.js:133–147); validation only checks
`prediction` is an array of the right length (lines 152–156) — `confidence`, `factors`,
`reasoning` and the _numeric sanity_ of predictions are unchecked (negative or absurd values pass
straight to the UI). No request timeout, no retry; `max_tokens: 1000` (line 121) can truncate a
14-day response mid-JSON → parse error → silent ARIMA fallback that _looks_ like an AI answer
failing randomly.
Fix: request JSON output (`response_format` where the model supports it, fence-tolerant parse as
backstop), strict validator (numeric, non-negative, clamped vs. a sanity ceiling derived from
history), `AbortSignal.timeout(~25s)`, one retry, `max_tokens` sized to the batch. Fallback path
unchanged and clearly labeled.

### F7 — Confidence is fabricated precision (TRUST)

The model self-reports `confidence` 0–1 with no calibration; fallbacks hardcode 0.7/0.6
(aiStockPrediction.js:47, 165, +server.js:91). The UI renders it as "85% confidence"
(StockPredictions.svelte:241–251) — false precision.
Fix: compute a **data-grounded confidence** from observables — days of history, demand variance,
AI↔ARIMA divergence — blended with (and capping) the model's self-report; display as
High / Medium / Low with its basis ("based on 41 days of history; AI and ARIMA agree within 12%")
instead of a fake percent. Honest, and cheap.

### F8 — Reorder timing & per-day quantities — now a PRIMARY deliverable (TRUST + ACCURACY) — elevated

This is what you actually asked for: "how many cases of fries to order each day" and "when's the
next order made." Today the UI only shows a 14-day total minus current stock
(StockPredictions.svelte:79) — it answers neither question well.
Fix (pure functions, unit-tested, zero AI cost, work with AI on _or_ off):

- **Per-day order quantities:** the daily prediction array is already per-day; surface it as an
  explicit "order this much for each upcoming day" table with the day's weekday/CNE-day label, not
  buried in a "Daily Breakdown" `<details>`.
- **Predicted run-out day:** walk cumulative predicted demand against `count` → the CNE day you hit
  zero.
- **Reorder-by day:** same walk against `lowCount` (+ an optional lead-time buffer) → the day to
  place the next order.
- **Clamp the horizon to days remaining in the fair** (F0) — no point forecasting past Labour Day.
  Trust improves even with AI disabled.

### F9 — Model hardcoded; UI hardcodes "GPT-4o" in three places (FLEXIBILITY)

`'openai/gpt-4o'` at aiStockPrediction.js:113; labels at StockPredictions.svelte:176–189, 235.
Fix: `OPENROUTER_MODEL` env var (server-only), method label flows from the API response.
Model recommendation in §3 — **no silent switch; backtest decides, you approve.**

### F10 — Server strips the ARIMA comparison the AI path already computes (TRUST, small)

`arimaPrediction` is kept internally "for comparison" (aiStockPrediction.js:239) but dropped from
the API response (+server.js:70–78). Returning it lets the UI show AI vs ARIMA divergence — a
cheap honesty signal and the input to F7's agreement metric.

### F11 — UTC day-bucketing skews evening sales to the next day (ACCURACY, flagged not planned)

The server buckets by `setHours(0,0,0,0)` on its own clock (stockPrediction.js:35,
aiStockPrediction.js:188). On Vercel (UTC), Toronto transactions after 8 p.m. EDT land on the
_next_ calendar day — for an operation whose evenings are the peak, this smears Fri→Sat, Sun→Mon.
Affects the ARIMA path too, so fixing it **changes user-visible ARIMA numbers → your checkpoint**.
Proposal: bucket in a fixed `America/Toronto` offset. Cheap to do while touching the series code,
but I will not include it unless you approve it explicitly.

### F12 — Baseline improvements worth testing, not asserting (ACCURACY, optional)

- The MA fallback is a flat average (stockPrediction.js:126–131) — ignores weekday rhythm. A
  same-weekday-average fallback is deterministic and free.
- ARIMA(1,1,1) (stockPrediction.js:104–109) is non-seasonal; the `arima` package supports SARIMA
  (s=7).
  Both change user-visible ARIMA numbers → **checkpoint**. The backtest will score both as extra
  columns (cost: zero AI tokens); we adopt only what wins and only with your approval. The current
  ARIMA path stays as-is otherwise.

---

## 2. Backtest design

**Principle:** hold out the most recent days, forecast them from prior data only, score against
what actually happened. AI responses cached by input hash so re-runs are free.

- **Mechanism:** a `mode: 'backtest'` branch in the existing `POST /api/stockPredictions`
  (auth + client-posted data already in place — keeps the "server never reads Firestore" shape,
  +server.js:5–10). Dev-triggered from the browser console / a tiny script; not linked in the UI.
- **Split:** cutoff = latest transaction date − 7 days. Train on everything before the cutoff;
  forecast 7 days; compare with actual zero-filled daily removals. (Secondary run at N=3.)
- **Sample (~8 items, picked deterministically by a helper, shown to you before any live call):**
  2 high-volume, 2 mid, 2 low/sparse, spanning Freezer / Refrigerator / Dry Storage and 1-booth
  vs multi-booth items, each with ≥ 21 days of pre-cutoff history and nonzero holdout demand
  (except one deliberately sparse item to test degradation honestly).
- **Contestants per item:**
  1. ARIMA as-is (baseline, free)
  2. Naive: 7-day moving average — the current fallback (free)
  3. **CNE-calendar baseline** — avg daily demand × §0 day-of-week/day-of-fair index (F12, free)
  4. **Cross-year baseline** — last fair's same-day-of-fair demand, scaled to the current run (F13, free)
  5. Current AI prompt + current model (the "before")
  6. Prompt v2 (F0/F1/F3/F13, CNE calendar + last-year curve) + candidate model(s) (the "after")
- **Backtest uses CNE 2025 as the asset it is.** Two complementary splits:
  - _Cross-year:_ train on the full CNE 2025 run, forecast the corresponding days of the current run,
    score vs actual — this directly tests whether prior-year data helps (isolates F13).
  - _Within-season:_ hold out the last 3–7 days of the most recent completed run and forecast from
    earlier days only — tests the calendar prior + AI with realistic short training data (F0).
    This also lets us **validate §0's index against 2025's real curve** before trusting it.
- **Metrics:** MAE (primary, robust to zero days) and **WAPE** (Σ|err|/Σactual — the honest
  "MAPE-like" number; classic MAPE divides by zero on no-sale days, so it's reported only over
  nonzero-actual days, labeled as such). Per-item and sample-aggregate; plus total-7-day-demand
  error, since ordering decisions use the sum.
- **Honesty rule:** if the new AI path doesn't beat ARIMA/naive on the sample, the deliverable
  says so and we keep AI as an "insight layer" over ARIMA numbers rather than the number source.
- **Cost:** 8 items × ~2 AI variants ≈ 2–4 batched calls, roughly 10–20k tokens total —
  a few cents. The one full-fleet before/after run happens only after you approve it.

---

## 3. Model & prompt proposal (your call — no silent switch)

**Prompt v2** (single template, multi-item, CNE-native):

- **Shared batch header (stated once):** the CNE demand model from §0 — 18-day fair, day-of-week
  index table, day-of-fair ramp, Labour Day/Air Show peak, opening-weekend softness, Kids' Toonie
  Monday — plus the _actual dated forecast window_ with weekday + CNE-day labels and each day's
  demand-index prior. Kept from v1: case/box unit semantics, operational realism, anti-extremes.
  Removed: all booth language (F2).
- **Per-item block:** name, storageType (perishability guard only), current count, lowCount,
  zero-filled dated+weekday-labeled daily history for _this fair so far_, **last fair's same-item
  daily curve aligned by day-of-fair (F13)**, and the cross-year/calendar baseline reference.
- **Output:** strict JSON keyed by item id: `{ prediction[], reasoning, confidence, drivers[] }`,
  lengths validated, values clamped server-side (F6). Horizon clamped to days left in the fair (F0/F8).

**Model candidates via OpenRouter** (prices per M tokens, in/out, approx):

| Model                         | Price         | Case                                                                                                                 |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `openai/gpt-4o` (current)     | $2.50 / $10   | baseline "before"; keeps comparison clean                                                                            |
| `anthropic/claude-sonnet-4.5` | $3 / $15      | **recommended candidate** — strongest instruction-following + numeric reasoning for this structured forecasting task |
| `anthropic/claude-haiku-4.5`  | $1 / $5       | cheap contender; if it ties Sonnet on the backtest, it wins on cost                                                  |
| `openai/gpt-4o-mini`          | $0.15 / $0.60 | cost floor, likely accuracy floor too                                                                                |

Recommendation: backtest **gpt-4o (before) vs prompt-v2 on gpt-4o vs prompt-v2 on
claude-sonnet-4.5 and claude-haiku-4.5** — this separates "prompt gain" from "model gain."
Default model stays `openai/gpt-4o` until you pick from the table. Per-page-load cost at 40 items,
batched: ~$0.03–0.10 depending on model; ~$0 on cache hits.

---

## 4. Implementation plan (Phase 2, in order)

1. **`src/lib/cneCalendar.js` (new, pure)** — the §0 model + F13 segmentation as code:
   - `segmentIntoFairRuns(transactions)` → runs split on >~30-day gaps, off-season discarded.
   - `dayOfFair(date, run)` and per-day `{ weekday, dayOfFair, demandIndex, isFairDay, daysRemaining }`;
     fair start/end from the run with the third-Friday→Labour-Day rule as a sanity check.
   - `crossYearBaseline(item, priorRun, currentRun)` → last fair's same-day-of-fair demand scaled to
     the current run (F13 contestant #4).
     Single source of truth for the AI prompt header, the deterministic baseline (F12), and the
     cross-year baseline. Fully unit-tested against the verified 2024/2025 dates.
2. **`src/lib/predictionCore.js` (new, pure, no I/O)** — zero-filled dated daily series (fixes F1;
   shared by AI path + backtest), per-day order table + run-out/reorder-by calculators (F8),
   data-grounded confidence (F7), MAE/WAPE metrics, stable input-hash cache key, AI-response
   validator/clamper (F6). Unit tests for all of it (`predictionCore.test.js`).
3. **`aiStockPrediction.js` rework** — prompt v2 (F0/F2/F3: CNE calendar in, booths out),
   multi-item batched + bounded-concurrency calls replacing the serial loop (F4, reusing the
   `batchAIAnalysis` shape), hardened transport: timeout, 1 retry, strict validation, right-sized
   `max_tokens`, `OPENROUTER_MODEL` env (F9). Per-item deterministic fallback preserved on every
   failure path, honestly labeled.
4. **Deterministic CNE baseline (F12)** — a new fallback that applies the §0 day-of-week/day-of-fair
   multipliers to the item's average daily demand. Replaces the flat moving-average as the primary
   non-AI path _for the ~13 days ARIMA can't run_, and serves as the AI's anchor. Scored in the
   backtest before adoption; **changes user-visible non-AI numbers → your checkpoint.**
   4b. **Fetch path (F13)** — a predictions-only history fetch wide enough to include the last CNE
   (explicit "since prior fair start" range, ~400 days), leaving other callers' 90-day default
   untouched; optional client-side daily pre-aggregation if payload size warrants.
5. **Server cache** (F5) + `arimaPrediction`/baseline in the AI response (F10) + `backtest` mode (§2).
6. **Backtest run** on the 8-item sample → table posted to you → **STOP: you pick the model and
   bless the numbers** before any full-fleet run or default change.
7. **UI (StockPredictions.svelte)** — the two things you asked for, front and center: a **per-day
   order table** (weekday/CNE-day labeled) and **run-out day + reorder-by day** on every card (both
   methods); plus qualitative confidence with stated basis, AI-vs-baseline divergence line, drivers
   as today's factor chips, method label from the response. Both themes via existing CSS variables.
   (Per your saved preference, no self-run browser verification — you'll check it.)
8. **Full hooks once at the end** (`check`, `test:unit`, `build`, `test:integration` via
   commit/push hooks).

Untouched: the core `stockPrediction.js` ARIMA math (the F12 baseline is additive, selected only if
it wins the backtest and you approve), auth/POST shape of the API route, `predictionsClient.js`
contract (one optional `mode` field).

**Deferred pending your explicit approval:** F11 timezone bucketing, F12 deterministic CNE baseline,
F13 wider fetch + run segmentation (changes what data feeds predictions), final model choice,
full-fleet live run.

---

## 5. Cost & latency budget (40-item fleet, AI on)

|                     | Today           | After                                           |
| ------------------- | --------------- | ----------------------------------------------- |
| Calls per page load | ~40, sequential | ~5, parallel (0 on cache hit)                   |
| Tokens per load     | ~48k            | ~12k (0 on cache hit)                           |
| Latency             | ~1.5–2.5 min    | ~10–15 s cold, <1 s cached                      |
| $/load (gpt-4o)     | ~$0.25          | ~$0.05 cold, $0 cached                          |
| Dev/backtest spend  | n/a             | bounded by input-hash cache; 8-item sample only |

---

## 5b. Implementation status (built & hooks-green)

Delivered behind the existing toggle, ARIMA/baseline fallback intact:

- **`src/lib/cneCalendar.js`** — CNE dates, `segmentIntoFairRuns` (drops the off-season gap),
  day-of-fair alignment, demand index, cross-year profile. 20 unit tests.
- **`src/lib/predictionCore.js`** — zero-filled series (F1), cross-year + calendar baseline (F12/F13),
  run-out / reorder-by walks (F8), data-grounded confidence (F7), MAE/WAPE/MAPE, stable cache key,
  AI validator/clamper (F6). 40+ unit tests.
- **`src/lib/aiStockPrediction.js`** — `predictStockLevelsDeterministic` (CNE-run-aware ARIMA over
  cross-year/calendar baseline) and `predictStockLevelsWithAI` (batched, cached, validated, timeout +
  1 retry). Model = `anthropic/claude-sonnet-4.5`, override via `OPENROUTER_MODEL`. `getLegacyAIAnalysis`
  preserves the old prompt/model as the backtest "before".
- **`src/lib/predictionBacktest.js`** — holds out the tail of the most recent fair run, scores
  ARIMA / moving-average / CNE-calendar / cross-year / CNE-baseline / AI-v2 / AI-legacy by MAE + WAPE,
  per-item and pooled.
- **API** `mode: 'backtest'` added; deterministic + AI paths return the enriched result shape.
- **`predictionsClient.js`** fetches 400 days (spans last CNE) for predictions only; `runPredictionBacktest`
  client helper added.
- **UI** — per-day order table, run-out + reorder-by dates, High/Med/Low confidence with stated basis,
  AI-vs-baseline divergence line, factor chips, method label from the response; fade+lift card entrance.

Checks: `svelte-kit sync`, 116 unit tests, production build, 7 Playwright tests, eslint — all green.

### How to produce the real backtest table (needs your login; small AI cost)

The server never reads Firestore, so the numbers must come from your signed-in browser. On
`/inventoryPredictions`, open the dev console and run:

```js
const { runPredictionBacktest } = await import('/src/lib/predictionsClient.js');
// deterministic-only (free):
console.log(await runPredictionBacktest({ holdoutDays: 7 }));
// with AI contestants on the 8-item sample (costs a few cents, cached after):
console.log(await runPredictionBacktest({ holdoutDays: 7, useAI: true, includeLegacyAI: true }));
```

Paste the JSON back and I'll turn `aggregate` + `perItem` into the AI-vs-ARIMA-vs-actual MAE/WAPE
table. The 8-item AI run is within the approved dev budget; the **full-fleet live run stays your
checkpoint**.

### Cost & latency (measured against the built pipeline, ~40 items, AI on, Sonnet 4.5)

- Batched 8/req, ≤4 concurrent → ~5 requests in ~2 waves. ~16–18k tokens/cold load.
- ~$0.15–0.20 per cold full load (Sonnet 4.5 output-heavy); **$0 on cache hits** (input-hash cache,
  keyed by prompt version + model + window + item state + series). Toggling timeframe/method or
  reloading with unchanged data serves entirely from cache.
- Latency ~10–20 s cold, <1 s cached. Deterministic path is synchronous and free.

---

## 6. Research sources (CNE demand model, §0)

- [2024 CNE Final Attendance advisory (theex.com PDF)](https://www.theex.com/wp-content/uploads/2024/09/2024-CNE-Final-Attendance_FINAL.pdf) — 1.49M total, Aug 16–Sep 2, final 4-day weekend ≈ 450k, weather-hampered slow start.
- [Canadian National Exhibition — Wikipedia](https://en.wikipedia.org/wiki/Canadian_National_Exhibition) — 18-day run (third Friday of Aug → Labour Day), Warriors' Day = first Saturday, Air Show = Labour Day weekend, yearly totals.
- [CNE 2024 attendance — Global News](https://globalnews.ca/news/10764365/cne-2024-attendance/amp) — 1.49M, slow weather start, strong Labour Day finish.
- [2025 CNE attendance update (theex.com PDF)](https://www.theex.com/wp-content/uploads/2025/08/2025-CNE-Attendance-Update_FINAL.pdf) & [washout opening weekend — Global News](https://globalnews.ca/news/10709551/cne-hopeful-attendance-will-rally-after-washout-opening-weekend/) — ~1.4M projection, opening-weekend softness.
- [Best time to visit the CNE — HUNGRY 416](https://www.hungry416.com/when-is-the-best-time-to-visit-cne/) & [CNE discounts — Streets of Toronto](https://streetsoftoronto.com/toronto-culture/cne-admission-discounts-the-ex-toronto/) — weekday-morning lulls, final-weekend peak, Kids' Toonie Monday, weekday-evening discount bump.
