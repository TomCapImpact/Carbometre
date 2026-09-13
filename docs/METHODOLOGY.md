# Carbomètre — Methodology

**This tool gives an order of magnitude, not a measurement. It must not be used for
regulatory carbon reporting, for comparing providers against each other, or for any
claim that needs defensible precision.**

Every number below is either sourced or explicitly flagged as an assumption. Where our
value disagrees with the published literature, that is stated plainly along with the
direction of the resulting bias. If you only read one section, read
[Known limitations](#known-limitations).

---

## 1. The formula

For one exchange (one prompt, one reply):

```
effectiveOutputTokens = tokensOut + thinkingTokens
weightedInputTokens   = tokensIn × INPUT_WEIGHT

energyWh      = (effectiveOutputTokens × eTokenWh + weightedInputTokens × eTokenWh) × pue
electricityG  = energyWh × gridIntensity / 1000
embodiedG     = (effectiveOutputTokens + weightedInputTokens) × embodiedPerTokenG

gCO2e         = electricityG + embodiedG
gCO2eLow      = gCO2e / uncertaintyFactor
gCO2eHigh     = gCO2e × uncertaintyFactor
```

A conversation's displayed total is the sum of its exchanges. Implementation:
[`TokenBasedEmissionModel`](../packages/core/src/emissions/TokenBasedEmissionModel.ts).

---

## 2. Counting tokens

No official tokenizer is available to a browser extension, so token counts are estimated
from character length:

```
tokens = ceil(characters / charsPerToken)
```

with `charsPerToken` = **3.6** for French and **4.0** for English. The language of each
message is detected with a stopword-frequency ratio; if that is inconclusive (a very
short message), the browser's interface language is used as the fallback.

This detection exists for one technical reason only — French costs more tokens per
character than English — and is deliberately independent of the interface language and
of where the user lives.

> **Status: assumption, not measurement.** The 3.6 / 4.0 ratios are conventional
> rules of thumb for BPE tokenizers on Latin-script prose, not values we measured
> against any provider's tokenizer. They degrade for code, for languages with other
> scripts, and for text dense in rare tokens.

---

## 3. Energy per token (`eTokenWh`)

Values are assigned **by model size tier**, not per individual model, because a browser
extension can at best identify a model family from the interface.

| Tier | `eTokenWh` (Wh per output token) |
|---|---|
| `frontier` (>200B params) | 5.0 × 10⁻⁴ |
| `mid` | 2.0 × 10⁻⁴ |
| `small` / fast | 6.0 × 10⁻⁵ |

**How this compares to published measurements.** The frontier figure sits inside the
range reported by independent measurement work, toward the conservative (higher) end of
it:

- [*From Prompts to Power: Measuring the Energy Footprint of LLM Inference*](https://arxiv.org/html/2511.05597)
  reports a marginal cost of ≈1.72 J per generated token, i.e. ≈4.8 × 10⁻⁴ Wh/token —
  very close to our frontier value.
- Microsoft benchmarking of GPT-4o on H100 GPUs, as summarised in
  [this review of LLM inference energy use](https://www.emergentmind.com/topics/llm-inference-energy-consumption),
  gives a median ≈0.3 Wh for a 500-token query, i.e. ≈3 × 10⁻⁴ Wh/token — **below** our
  frontier value.
- The same review reports ≈3–4 J per output token for a 65B-parameter LLaMA, i.e.
  ≈8.3 × 10⁻⁴ – 1.1 × 10⁻³ Wh/token — **above** our frontier value.

The literature also finds that 70B-class models can consume up to two orders of
magnitude more energy per token than small ones, which is why this tool differentiates
by tier at all rather than using a single constant.

> **Status: sourced, but coarse.** The spread across the studies above is itself close
> to a factor of 4, which is most of why `uncertaintyFactor` is 3. The `mid` and
> `small` tier values are interpolations consistent with that literature, not
> separately measured figures.

---

## 4. Datacentre overhead (`pue`)

**Value used: 1.54.**

Power Usage Effectiveness accounts for cooling, power distribution and everything else
the facility draws beyond the servers themselves.

Source: the [Uptime Institute Global Data Center Survey 2025](https://intelligence.uptimeinstitute.com/resource/uptime-institute-global-data-center-survey-2025)
puts the global average at **1.54**, essentially unchanged for six years.

**Why the global average rather than a hyperscaler figure.** This project originally used
1.12, close to what Google, AWS and Microsoft claim at their best sites ("1.2 or lower"),
on the reasoning that frontier models are served from the newest facilities. We changed
it, deliberately, for two reasons:

- Using 1.12 required *assuming* that every request is served from a best-in-class site —
  a favourable assumption we cannot verify, of exactly the kind this project refuses
  elsewhere (see `regionConfidence: 'assumed'` in §5). An unverifiable assumption that
  happens to make the number smaller is the worst kind to make in a tool like this.
- It made the tool underestimate by roughly 30%.

The most *accurate* figure for this workload is arguably the 1.44–1.48 band Uptime
reports for large (20 MW+) facilities, since LLM inference does run in large facilities.
We chose the plain global average instead because it needs no assumption about facility
size and is a single, citable, explicable number. This is a conservative choice: if
providers do serve from large modern sites, **this now overestimates by a few percent** —
a trade we prefer over the previous 30% underestimate.

---

## 5. Grid carbon intensity

The grid factor is resolved from **where the model is served**, never from where the
user is. A user in France querying a US-hosted model is charged the US factor. See
[`DatacenterGridProvider`](../packages/core/src/grid/DatacenterGridProvider.ts).

| `regionId` | gCO2e/kWh | Note |
|---|---|---|
| `us-average` | 370 | Default assumption for US-hosted models |
| `us-east` | 380 | Virginia cluster |
| `us-west` | 120 | Pacific Northwest, hydro-heavy |
| `eu-west` | 290 | Ireland |
| `fr` | 30 | French mix, lifecycle (comparison mode only) |

Three rules govern this:

1. **Location-based, never market-based.** Providers buy renewable energy certificates
   and sign power purchase agreements. Crediting those would push the displayed number
   toward zero without describing the electricity physically consumed. We use the
   regional grid average.
2. **The serving region is an assumption, not a fact.** No provider discloses which
   datacentre answered a given request. Every profile in the catalogue therefore carries
   `regionConfidence: 'assumed'`.
3. **No live data in v1.** The extension makes no network calls at all. An hourly
   carbon-intensity API would require only a new class implementing
   `GridIntensityProvider` — the architecture allows it; v1 does not do it.

The French figure comes from [RTE's 2024 annual electricity review](https://analysesetdonnees.rte-france.com/en/annual-review-2024/keyfindings):
**21.7 gCO2eq/kWh** for generation, **30.2 gCO2eq/kWh** on a lifecycle basis. We use the
lifecycle figure, rounded to 30. (An earlier version of this project used 60, which
overestimated France by ~2×; corrected for the same reason the PUE was corrected — the
number should follow the evidence in whichever direction it points.)

> **Status of the other regions: not individually traced.** For scale, the global average
> was ≈445 gCO2/kWh in 2024
> ([IEA, Electricity 2025](https://www.iea.org/reports/electricity-2025/emissions)),
> which makes our US figure of 370 plausible for a grid below the world average — but we
> have not tied it, nor the two regional US figures nor Ireland, to a specific published
> source. They are the next numbers that deserve attention after §6.

---

## 6. Embodied emissions (`embodiedPerTokenG`)

Values used: **4.9 × 10⁻⁵** gCO2e per token (frontier), 2.0 × 10⁻⁵ (mid),
6.0 × 10⁻⁶ (small) — intended to amortise the manufacturing footprint of the serving
hardware across the tokens it produces in its lifetime.

> ❗ **Status: unsourced.** We have not been able to trace these to a published figure,
> and they are the weakest numbers in the model. They contribute roughly 20% of the
> total for a frontier model, so an error here moves the headline number materially.
> Treat them as placeholders pending a proper hardware-amortisation source.

---

## 7. Input weighting (`INPUT_WEIGHT`)

**Value used: 0.05** — an input token is charged 5% of an output token.

Rationale: prefill (processing the prompt) is batched and parallelised across the
sequence, whereas decode generates one token at a time. Per token, prefill is far
cheaper.

> **Status: reasoning, not measurement.** The direction is well established in the
> inference-performance literature; the specific 5% figure is ours.

---

## 8. Hidden reasoning (`hiddenThinkingMultiplier`)

Reasoning models generate tokens the user never sees. Two cases, per model profile:

- `thinkingVisible: true` (e.g. Claude extended thinking) — the visible reasoning text is
  counted as output tokens, like any other output.
- `thinkingVisible: false` — visible output tokens are multiplied by
  `hiddenThinkingMultiplier`, default **4.0**.

> ❗ **Status: assumption, and the single largest source of error in this tool.**
> The 4.0 multiplier is not measured and not published by any provider. Real hidden
> reasoning volume varies enormously between a trivial prompt and a hard one — plausibly
> by more than an order of magnitude. For a model in this category, this assumption can
> dominate the entire estimate.

---

## 9. Uncertainty range (`uncertaintyFactor`)

**Value used: 3.0** for every profile in the catalogue. The displayed range is
`total / 3` to `total × 3`.

This is a judgement, chosen to be wide enough to cover the spread between the published
per-token energy measurements in §3 (itself close to 4×) without being so wide as to be
meaningless. It does **not** propagate the tokenizer, hidden-reasoning or embodied-carbon
uncertainties formally — a fully propagated range would be wider.

It should be lowered per model where a provider publishes measured figures. None
currently do, so no profile deviates from 3.0.

---

## 10. Car equivalent

**Value used: 125 gCO2e/km**, applied to the 30-day total to produce the dashboard's
"equivalent" figure.

This is a *fleet-average, real-world* figure, not a new-car test figure. For comparison,
the [EEA's monitoring of new passenger cars](https://www.eea.europa.eu/en/analysis/indicators/co2-performance-of-new-passenger)
reports **106.7 gCO₂/km** for cars newly registered in the EU in 2024, measured on the
WLTP test cycle. Our figure is higher because:

- it is meant to represent cars actually on the road, which are older than new
  registrations, and
- WLTP is a test cycle measuring tailpipe emissions only; real-world driving is
  typically higher, and neither fuel production nor vehicle manufacturing is included.

> **Status: defensible, but not traced to a single published fleet-average source.**

---

## Known limitations

In rough order of how much they can distort the result:

1. **Hidden reasoning tokens** (§8) are guessed with a fixed multiplier. For models that
   hide their reasoning, this can dominate the estimate.
2. **Embodied emissions** (§6) are unsourced placeholders contributing ~20% of the total.
3. **Invisible context is not counted.** The extension sees only what is rendered on
   screen. It cannot see the system prompt, retrieved documents, tool definitions, or the
   conversation history that the provider re-sends on *every single turn*. Since that
   history grows with the conversation, **this tool systematically underestimates long
   conversations, and increasingly so as they grow.**
4. **Token counts are estimated from characters** (§2), not produced by the provider's
   tokenizer.
5. **The serving datacentre is unknown** (§5). A model assumed to run in Virginia might
   run in Oregon, a factor of 3 apart in grid intensity.
6. **PUE is a global average** (§4), not measured for the specific facility serving a
   given request - now a slight overestimate for modern AI sites, rather than the
   ~30% underestimate it was before.
7. **Batching effects are ignored.** Real inference serves many requests concurrently;
   per-request energy depends on load, which we cannot observe.
8. **Training emissions are excluded entirely.** Only inference is counted. Amortising
   training across queries is a defensible alternative choice; we do not make it.
9. **Model identification can fail.** When the model cannot be identified from the page,
   the estimate falls back to the provider's default tier and is marked
   `confidence: 'guessed'`. It is still counted, but with less basis.

---

## What would make this better

Roughly in order of impact per unit of effort:

- A sourced figure for embodied emissions per token.
- Any provider publishing measured per-request energy, which would let
  `confidence: 'measured'` and a narrower `uncertaintyFactor` mean something.
- Reading the model identifier from the request payload rather than the rendered page,
  which would remove the largest remaining source of misidentification. This is
  technically feasible but changes the extension's privacy posture materially, and is
  deliberately **not** done in v1.
- An hourly grid-intensity source, which the `GridIntensityProvider` interface already
  accommodates.
