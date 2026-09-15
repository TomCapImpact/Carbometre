# Carbomètre

A free, open-source browser extension that shows the estimated greenhouse gas emissions
of your LLM usage, in real time, as a single number.

It is built for people using AI chatbots through their web interface — not for API
developers — and it is deliberately honest about being an **order of magnitude, not a
measurement**. Read [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) before trusting any
number it shows: every coefficient is either sourced or explicitly flagged as an
assumption, including the ones we consider weak.

Supported today: **claude.ai**, **chatgpt.com**, **chat.mistral.ai**.
Interface in French and English, resolved from the browser locale.

---

## Privacy

This matters more than the feature list, so it comes first.

- **No network requests, ever.** The extension never contacts any server, including ours.
  There is no analytics, no crash reporting, no remote configuration.
- **No message content is stored.** Storage holds per-conversation totals, response
  counts, a cumulative total with its reset date, a per-day emissions ledger, and two
  settings (your answer to "mainly in France / mainly elsewhere", and which equivalent
  you picked), plus an all-time total — numbers and identifiers only. Your prompts and the replies never leave
  the page and are never written anywhere.
- **Only what is already on screen is read.** Emissions are estimated from the rendered
  text of an exchange. The extension does not intercept network traffic and therefore
  never sees your full request payload, system prompts, or attachments.
- **Everything stays on your machine**, in `chrome.storage.local`.

This posture is a design constraint, not an accident: intercepting requests would give
more accurate model identification, and it was
[considered and deliberately declined](docs/METHODOLOGY.md#what-would-make-this-better)
for v1 because of what it would cost in privacy.

---

## Install

No published store build yet — the listing copy and remaining store assets are tracked in
[`docs/STORE_LISTING.md`](docs/STORE_LISTING.md). For now, load it unpacked:

```bash
git clone https://github.com/TomCapImpact/Carbometre.git
cd Carbometre
pnpm install
pnpm -r run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select `apps/extension/dist`

> The `--load-extension` command-line flag does **not** work on stable Google Chrome
> (it is ignored with a warning). Loading through the UI is the only way.

On first install a page asks one question — are you mainly in France, or mainly
elsewhere? It changes one rule of the calculation (see
[`docs/METHODOLOGY.md` §5](docs/METHODOLOGY.md#5-grid-carbon-intensity)). It can be
changed later from the dashboard, behind a confirmation: past estimates are never
recalculated, so the change only affects the responses that follow.

Open one of the supported sites. A small floating badge appears; drag it wherever you
like — it remembers its position per site. Click it for the dashboard: this
conversation, the cumulative total since you last reset it (with a "details" view of the
all-time and month-to-date totals), and that total expressed as kilometres by car or by
plane.

### Options page

Reachable from the dashboard's "Options" button or from `chrome://extensions`:

- **Interface language** — automatic (browser), French, or English. Applies on the next
  page load: the views bake their strings in at construction.
- **Location** — the onboarding answer, changeable behind the same confirmation.
- **Electricity reference** — *actual server location* (default) or *French grid mix*,
  the comparison mode that charges every model at 30 gCO2e/kWh (and says why that
  understates US-hosted models).
- **Coefficients** — every editable coefficient of every catalogue model, with the
  default as placeholder. Empty means default; a value below the coefficient's floor is
  refused with the model and column named. "Restore defaults" clears them all.
- **Data** — export everything as JSON, conversations as CSV, the daily ledger as CSV
  (ids, counts, totals; never message text); erase all data behind a confirmation.

Calculation settings (location, reference, coefficients) reach open chat tabs
immediately through `chrome.storage.onChanged`; past estimates are never recalculated.

### Development

```bash
pnpm -r run test        # 223 tests, plus the FR/EN catalogue parity check
pnpm --filter @carbometre/extension run typecheck
pnpm -r run build       # rebuild; then hit reload in chrome://extensions
```

After changing extension code you must **reload the extension** in `chrome://extensions`
*and* hard-refresh the page (⌘⇧R). Refreshing the page alone keeps the old content
script.

---

## Architecture

Two packages:

- **`packages/core`** — the calculation engine. Zero runtime dependencies, no browser
  APIs, publishable standalone on npm.
- **`apps/extension`** — the Manifest V3 extension: DOM observation, storage, UI.

The dependency arrow only ever points one way: the extension depends on core, never the
reverse. Core knows nothing about Chrome, the DOM, or any particular site.

### Core

```
CarbometerService                  facade: estimate(EstimateInput) -> Estimate
  ├── Tokenizer                    «interface»  countTokens(text, lang)
  │     └── HeuristicTokenizer     character-ratio implementation
  ├── ModelRegistry                id -> ModelProfile, with a tier fallback
  │     └── models.json            the coefficient catalogue
  └── EmissionModelRegistry        emissionModelId -> EmissionModel
        └── EmissionModel          «interface»  estimate(usage, profile)
              └── TokenBasedEmissionModel
                    └── GridIntensityProvider   «interface»  intensityFor(profile)
                          └── GridReferenceProvider    routes on the "electricity reference" setting
                                ├── UserLocationGridProvider  French mix for EU-hosted models
                                │     └── DatacenterGridProvider  when the user is in France
                                └── FrenchGridProvider        fixed French mix (comparison mode)

registry/
  ModelRegistry        id -> ModelProfile, tier fallback, user coefficient overrides
  CoefficientOverrides the editable subset, floors, validation

domain/
  Estimate        immutable value object; plus() accumulates; carries low/high + confidence
  TokenUsage      immutable; tokensIn / tokensOut / thinkingTokens
  ModelProfile    immutable; every coefficient for one model
  Conversation    entity; id, providerId, running total, addEstimate(), reset()
  UserLocation    'fr' | 'other'; UserLocationSink for things that react to it

equivalence/
  Equivalence         «interface»  unitsFor(gCO2e); FixedFactorEquivalence
  EquivalenceCatalog  id -> Equivalence (car km, plane km)
```

Everything is constructor-injected. There are no singletons and no module-level mutable
state; the only place concrete implementations are chosen is the composition root,
[`apps/extension/src/content.ts`](apps/extension/src/content.ts).

### Extension

```
content.ts                composition root — wires everything, contains no logic
onboarding.ts, options.ts composition roots for the two extension pages
background.ts             service worker: opens onboarding on install, Options on request

calculation/
  CalculationSettingsSink  «interface» ── CalculationSettingsApplier  settings -> grid + registry

export/
  UsageExport             pure builders for the JSON / CSV downloads

adapters/
  SiteAdapter             «abstract»  one class per supported site
    └── TranscriptAdapter «abstract»  shared "transcript of turns" machinery
          ├── ClaudeAdapter
          ├── ChatGptAdapter
          └── MistralAdapter
  AdapterRegistry         resolves an adapter from location.host
  observeUrlChanges       SPA navigation detection (patched history + polling)

storage/
  ConversationRepository       «interface» ── ChromeStorageConversationRepository
  UsageHistoryRepository       «interface» ── ChromeStorageUsageHistoryRepository
  SettingsRepository           «interface» ── ChromeStorageSettingsRepository

ui/
  CarbometerPresenter     holds service + repositories, feeds the views, applies settings
  BadgeView               the floating, draggable bubble
  DashboardView           the panel: numbers, reset, equivalence and location pickers;
                          follows the badge while it is dragged
  Confirmation            «interface» ── ModalConfirmation   the "are you sure?" modal
  OnboardingPage          drives onboarding.html (the install-time location question)
  OptionsPage             drives options.html
  FileSaver               «interface» ── AnchorFileSaver   hands a download to the user

i18n/
  Messages                «interface» ── ChromeMessages (browser locale)
                                      └─ CatalogMessages (forced language, bundled JSON)
```

---

## How to add a site adapter

Adding a fourth site is one new class plus one line — no existing class changes.

1. **Subclass `TranscriptAdapter`** in `apps/extension/src/adapters/`. It already handles
   the parts that are easy to get wrong: debounced detection of a finished reply,
   matching a reply to its prompt, and the MutationObserver lifecycle.

   Implement: `hostPatterns`, `providerId`, `containerSelector`, `turnSelector`,
   `isAssistantTurn()`, `extractExchange()`, `detectModelId()`, `fallbackModel()`,
   `currentConversationId()`. Optionally override `isStillStreaming()` if the site
   exposes a "still generating" flag.

2. **Register it** in `content.ts`'s `AdapterRegistry` array, and add the host to
   `manifest.json` (both `content_scripts.matches` and `web_accessible_resources.matches`).

3. **Keep every selector in one exported constant** at the top of the file, and say in a
   comment which ones are verified against the live site and which are guesses.

Four things cost us days of debugging; the base class handles them, but do not fight it:

- **Turn elements are related by document order, not DOM sibling links.** On chatgpt.com
  each turn sits in its own wrapper and `previousElementSibling` reaches nothing.
- **One reply can span several assistant turns** (a tool/reasoning step, then the answer).
- **URL shapes are unguessable** — `/chat/<id>`, `/c/<id>`, `/uc/<id>`, `/work/<uuid>`.
  Extract the identifier; do not pin the prefix.
- **A model picker you cannot read must not stop the counting.** That is what
  `fallbackModel()` is for: the exchange is counted against a default tier and the
  estimate is marked `confidence: 'guessed'`.

To discover an unknown site's structure, anchor on text you control: send a message
containing a unique marker, then walk up the DOM from it, rather than guessing attribute
names.

## How to add an emission model

The formula itself is replaceable without touching anything that calls it.

1. Implement `EmissionModel` (`estimate(usage, profile) -> Estimate`) in
   `packages/core/src/emissions/`.
2. Register it under a new id in the composition root:
   `new EmissionModelRegistry().register('my-model', new MyEmissionModel(...))`.
3. Point profiles at it by setting their `emissionModelId` in `models.json`.

`CarbometerService` resolves the model per profile, so old and new methodologies can
coexist across different models.

## How to update coefficients

All of them live in two JSON files:

- `packages/core/src/registry/models.json` — per-model `eTokenWh`, `pue`,
  `embodiedPerTokenG`, `hiddenThinkingMultiplier`, `uncertaintyFactor`, `regionId`.
- `packages/core/src/grid/regions.json` — grid intensity per region.

Then:

1. **Update the `sources` array** of every profile you touch, and the matching section of
   `docs/METHODOLOGY.md`. A coefficient without a stated source or an explicit
   "assumption" label does not belong in this project.
2. **Run the tests.** The golden-value tests in
   `packages/core/test/CarbometerService.test.ts` pin exact expected totals and will
   fail loudly — that is deliberate. Update the pinned values *and* the comment saying
   why they moved.
3. Rebuild and reload.

---

## Known limitations

Summarised here, detailed in [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md):

- Hidden reasoning tokens are estimated with a fixed multiplier — the single largest
  source of error.
- Embodied hardware emissions per token are not traceable to a published source.
- The context a provider re-sends on every turn is invisible to the extension, so **long
  conversations are systematically underestimated**.
- Token counts come from character length, not the provider's tokenizer.
- The serving datacentre is unknown; a region is assumed per model.
- Training emissions are excluded entirely.

## Licence

MIT.
