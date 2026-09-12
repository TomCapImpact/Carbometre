# Carbomètre - Claude Code build prompt

> Paste everything below into Claude Code at the root of an empty repo.
> UI strings are French; code, comments and docs are English.

---

## Context

Build **Carbomètre**, a free, open-source browser extension that shows a user the estimated greenhouse gas emissions of their LLM usage, in real time, as a single number.

Target users: LLM users on the web UI (not API developers), internationally, who want an honest order of magnitude rather than a precise measurement. **French and English are both first-class from v1** - neither is a translation of the other. The interface follows the browser locale and falls back to English. The emission factor is resolved from the real hosting region of the model being queried, independently of the user's own country or language: a French user querying a US-hosted model gets the US grid factor.

**Non-goals for v1:** native mobile apps (no injection is possible into the Claude / ChatGPT iOS and Android apps), desktop apps, measuring anything on the user's own device, monetisation, any form of analytics or telemetry.

---

## Design principles (binding)

The codebase must be object-oriented and built for extension, not modification:

- **Open/closed.** Adding support for a new site, a new model, or a new emission methodology must mean writing one new class and registering it - never editing existing classes.
- **Dependency inversion.** The core depends on interfaces (`Tokenizer`, `EmissionModel`, `ConversationRepository`), never on concrete implementations or on browser APIs.
- **Single responsibility.** Tokenisation, emission calculation, DOM observation, storage and rendering are four separate layers that never call across more than one boundary.
- Constructor injection everywhere. No singletons, no module-level mutable state, no `new` inside business logic.
- Every abstraction listed below must be an actual `interface` or `abstract class` in TypeScript, not a bare function type.

---

## Architecture

pnpm monorepo, TypeScript strict.

```
packages/core/src/
  domain/
    Estimate.ts              # value object, immutable
    ModelProfile.ts          # value object: coefficients for one model
    TokenUsage.ts            # value object: tokensIn / tokensOut / thinkingTokens
    Conversation.ts          # entity: id, provider, running total, addEstimate()
  tokenizer/
    Tokenizer.ts             # interface: countTokens(text, lang): number
    HeuristicTokenizer.ts    # character-ratio implementation
  emissions/
    EmissionModel.ts         # interface: estimate(usage, profile): Estimate
    TokenBasedEmissionModel.ts
    EmissionModelRegistry.ts # id -> EmissionModel
  grid/
    GridIntensityProvider.ts       # interface: intensityFor(profile): number
    FrenchGridProvider.ts          # fixed French mix - v1 default
    DatacenterGridProvider.ts      # per-provider hosting region
  registry/
    ModelRegistry.ts         # id -> ModelProfile, with tier fallback
    models.json
  CarbometerService.ts       # facade used by the extension

apps/extension/src/
  adapters/
    SiteAdapter.ts           # abstract base class
    ClaudeAdapter.ts
    ChatGptAdapter.ts
    MistralAdapter.ts
    AdapterRegistry.ts       # resolves adapter from location.host
  storage/
    ConversationRepository.ts            # interface
    ChromeStorageConversationRepository.ts
  ui/
    BadgeView.ts
    DashboardView.ts
    CarbometerPresenter.ts   # holds the service + repository, feeds the views
  content.ts                 # composition root: wires everything, nothing else

docs/METHODOLOGY.md
```

`packages/core` must be publishable standalone on npm, contain zero runtime dependencies, and import nothing browser-specific.

---

## Calculation engine (packages/core)

### Facade

```ts
class CarbometerService {
  constructor(
    private readonly tokenizer: Tokenizer,
    private readonly models: ModelRegistry,
    private readonly emissions: EmissionModelRegistry,
  ) {}

  estimate(input: EstimateInput): Estimate
}

type EstimateInput = {
  modelId: string;
  promptText: string;
  responseText: string;
  visibleThinkingText?: string;   // Claude extended thinking blocks
  lang?: 'fr' | 'en';
};

class Estimate {                   // immutable value object
  readonly usage: TokenUsage;
  readonly energyWh: number;
  readonly gCO2e: number;
  readonly gCO2eLow: number;       // gCO2e / uncertaintyFactor
  readonly gCO2eHigh: number;      // gCO2e * uncertaintyFactor
  readonly electricityG: number;
  readonly embodiedG: number;
  readonly confidence: 'measured' | 'modelled' | 'guessed';
  plus(other: Estimate): Estimate; // used to accumulate within a conversation
}
```

### Tokenisation

No official tokenizer exists for Claude, so `HeuristicTokenizer` uses a character ratio. It is swappable because it sits behind the `Tokenizer` interface.

- `tokens = chars / charsPerToken`
- `charsPerToken`: **3.6** for French, **4.0** for English. Detect the language of each message with a cheap stopword ratio; if detection is inconclusive, fall back to the active UI locale. This detection exists for a purely technical reason - French costs more tokens per character - and must not be tied to the interface language or to any assumption about where the user lives. The ratio table lives in one constant so other languages can be added without touching the class.
- Input tokens are counted on the user's visible prompt only. The extension cannot see system prompts, retrieved documents, or the conversation history the provider re-sends on every turn - document this as a known underestimate.

### Hidden reasoning tokens

Reasoning models generate tokens the user never sees. Per `ModelProfile`:

- `thinkingVisible: true` (Claude extended thinking) - count the visible thinking text as output tokens.
- `thinkingVisible: false` with `hiddenThinkingMultiplier` (default **4.0**) - multiply output tokens.

This is the single largest source of error. Surface it in the dashboard tooltip.

### Emission formula (TokenBasedEmissionModel)

```
energyWh      = (tokensOut * eTokenWh + tokensIn * eTokenWh * INPUT_WEIGHT) * pue
electricityG  = energyWh * gridIntensity / 1000
embodiedG     = (tokensOut + tokensIn * INPUT_WEIGHT) * embodiedPerTokenG
gCO2e         = electricityG + embodiedG
```

| Constant | Default | Rationale |
|---|---|---|
| `INPUT_WEIGHT` | 0.05 | prefill is batched and parallelised, far cheaper per token than decode |
| `pue` | 1.12 | typical hyperscaler datacentre |
| `uncertaintyFactor` | 3.0 | per model; lower it where the provider publishes measured figures |

### ModelProfile / models.json

Every field must be sourced in `METHODOLOGY.md`.

```json
{
  "id": "claude-frontier",
  "label": "Claude (modèle avancé)",
  "tier": "frontier",
  "emissionModelId": "token-based",
  "eTokenWh": 5.0e-4,
  "pue": 1.12,
  "gridIntensity": 350,
  "embodiedPerTokenG": 4.9e-5,
  "hiddenThinkingMultiplier": 1.0,
  "thinkingVisible": true,
  "uncertaintyFactor": 3.0,
  "confidence": "modelled",
  "sources": ["..."]
}
```

Default `eTokenWh` by tier, calibrated against published inference measurements:

- `frontier` (>200B total params): **5.0e-4 Wh** per output token
- `mid`: **2.0e-4 Wh**
- `small` / fast: **6.0e-5 Wh**

### Grid intensity

`gridIntensity` is **not** read directly by the emission model. It is resolved through `GridIntensityProvider`, injected into `TokenBasedEmissionModel`.

**The objective is realism:** the factor must reflect where the request actually consumes electricity, not where the user lives. A user in France querying a US-hosted model is charged the US grid factor.

Ship two implementations:

- `DatacenterGridProvider` - **v1 default.** Resolves `ModelProfile.regionId` against `regions.json`.
- `FrenchGridProvider` - returns the French mix for every model. Kept as an optional comparison mode, never the default.

`regions.json`, **location-based** factors in gCO2e/kWh (lifecycle, regional grid average):

| regionId | Factor | Note |
|---|---|---|
| `us-average` | 370 | default assumption for US-hosted frontier models |
| `us-east` | 380 | Virginia cluster |
| `us-west` | 120 | Pacific Northwest hydro |
| `eu-west` | 290 | Ireland |
| `fr` | 60 | French mix |

Three rules the implementation must follow, all restated in `METHODOLOGY.md`:

1. **Location-based, never market-based.** Providers buy renewable energy certificates and sign power purchase agreements; crediting those would push the displayed number towards zero without describing the electricity physically consumed. Use the regional grid average.
2. **The serving region is an assumption, not a fact.** No provider discloses which datacentre answers a given request. Carry `regionConfidence: 'stated' | 'assumed'` on each profile and widen `uncertaintyFactor` when it is `assumed`.
3. Adding a live carbon-intensity source later (an hourly grid API, the user's own country) must require only a new class implementing `GridIntensityProvider`. Not in v1 - v1 makes no network calls.

Options page label: "Référence électrique : localisation réelle des serveurs (défaut) / mix français".

### Tests

Vitest in `packages/core`. Golden-value tests: a 500-token frontier response lands near 0.12 gCO2e, a 500-token Mistral response near 0.04 gCO2e. Tests must fail loudly if a coefficient changes without expected values being updated. Also test `Estimate.plus()` accumulation and `Conversation` reset semantics.

---

## Extension

### Site adapters

```ts
abstract class SiteAdapter {
  abstract readonly hostPatterns: string[];
  abstract readonly providerId: string;
  abstract observeResponses(onResponse: (r: RawResponse) => void): Unsubscribe;
  abstract detectModelId(): string | null;
  abstract currentConversationId(): string | null;
  abstract badgeAnchor(): HTMLElement | null;   // where the number is injected
}
```

Ship `ClaudeAdapter`, `ChatGptAdapter`, `MistralAdapter`. Adding a fourth site must require only a new subclass plus one line in `AdapterRegistry`.

Detect a finished assistant message with `MutationObserver`: streaming is complete when the message node has not mutated for 800 ms.

Selectors are fragile and will break on UI updates, so per adapter:

- keep every selector in a single exported constant,
- implement a structural fallback (e.g. last message block in the conversation container),
- if both fail, render `--` in the badge rather than a wrong number.

### Badge - the whole v1 UI

**One number, nothing else.**

- Injected into the conversation header, **top right**, immediately left of the existing overflow menu, using `badgeAnchor()`. It must sit inline with the site's own header controls and inherit their size and spacing so it reads as part of the interface, not as an overlay.
- Displays the **running total for the current conversation**: `0,12 g` (use `mg` below 1 g, locale-aware decimal separator via `Intl.NumberFormat`, two significant figures max).
- Each new response in the same conversation is added to the total.
- **Reset to 0 when the conversation changes.** Detect via `currentConversationId()` plus a `history.pushState` / URL observer. A brand-new chat starts at 0. Returning to a previously visited conversation restores that conversation's stored total - it does not start from 0 and does not double-count.
- No label, no icon clutter, no range, no colour coding in v1.
- Click or tap opens the dashboard.
- Respect dark mode and `prefers-reduced-motion`. Must never overlap or displace the site's own controls.

### Dashboard

A floating panel anchored below the badge, dismissed by clicking outside or pressing Escape. **Three numbers maximum, all about this user's own consumption:**

1. **Cette conversation** - total gCO2e, with its uncertainty range in small type.
2. **30 derniers jours** - total gCO2e across all providers.
3. **Équivalent** - the 30-day total converted to kilometres driven by an average car (125 gCO2e/km).

Plus a single discreet link to the methodology. No charts, no per-model breakdown, no comparisons with other users in v1.

Tooltip on the first number: "Estimation. Méthode : tokens × facteur d'émission. Marge d'incertitude d'un facteur 3."

### Storage and privacy

- `chrome.storage.local` only, behind the `ConversationRepository` interface so it can be swapped.
- Store **per-conversation totals, counts and timestamps - never message content**.
- No network requests at all in v1. No analytics, no crash reporting, no remote config.
- Options page: edit coefficients, choose grid factor, reset data, export JSON/CSV.
- State this privacy posture in the store listing and the README.

### i18n

French and English via `chrome.i18n`, complete in both from the first shipped build - no English-only strings, no untranslated placeholders. **Resolve the locale from the browser and fall back to English** when it is neither French nor English. A manual override lives in the options page. English is a fallback only, never imposed on a French-locale user.

Number formatting follows the active locale through `Intl.NumberFormat`: `0,12 g` in French, `0.12 g` in English. Never format numbers by string concatenation.

The equivalence shown in the dashboard is locale-aware too: kilometres in French, miles when the locale is `en-US`.

A CI check must fail the build if the FR and EN message catalogues do not contain exactly the same set of keys.

---

## Documentation

`docs/METHODOLOGY.md` is a hard deliverable. It must:

- state the full formula,
- justify every default constant with a citation,
- list known limitations explicitly: hidden reasoning tokens, invisible context re-sent by the provider, unknown datacentre locations, character-based tokenisation, batching effects, training emissions excluded,
- state plainly that the tool gives an order of magnitude and must not be used for regulatory carbon reporting.

`README.md`: install instructions, class diagram of the core, how to add a site adapter, how to add an emission model, how to update coefficients.

---

## Build order

1. `packages/core` with all interfaces and tests passing - no UI, no extension.
2. Extension shell + `ClaudeAdapter` + badge with per-conversation accumulation and reset. **FR and EN catalogues from this step onward** - never write a literal UI string inside a component.
3. Dashboard.
4. `ChatGptAdapter` and `MistralAdapter`.
5. Options page, including the language override and the electricity reference switch.
6. `METHODOLOGY.md` + README + store assets.

**Stop after step 1** and show me the class structure and the golden test values before building any UI.

## Constraints

- MIT licence.
- Zero dependencies in `packages/core`.
- Extension bundle under 200 kB.
- Accessible: the badge is a real `<button>` with an ARIA label, the dashboard is keyboard-navigable and traps focus, contrast ratio 4.5:1 minimum.
