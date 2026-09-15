# Chrome Web Store listing

Copy for the store entry, in both listing languages. Keep it in sync with
[`METHODOLOGY.md`](METHODOLOGY.md) — if a claim here is not true there, the claim here is
wrong.

Two rules for this text, both deliberate:

- **Never imply precision.** No "measure", no "track exactly". This extension estimates.
- **State the privacy posture explicitly**, because it is the strongest thing about the
  product and because reviewers will look for it.

---

## English

**Name** (≤75 chars)

```
Carbomètre — CO2 estimate for your AI chats
```

**Short description** (≤132 chars)

```
Shows an estimate of the greenhouse gas emissions of your AI conversations, in real time. Private: nothing leaves your browser.
```

**Detailed description**

```
Carbomètre puts one number on your AI conversations: an estimate of the greenhouse gas
emissions they cause.

A small floating badge shows the running total for the conversation you are in. Drag it
anywhere on the page — it stays where you put it. Click it for a short dashboard: this
conversation, your cumulative total since you last reset it, and what that is worth in
kilometres by car or by plane — your choice.

On install, one question: are you mainly in France, or mainly elsewhere? It adjusts
one rule of the calculation for European-hosted models. It can be changed later from
the dashboard.

Works on claude.ai, chatgpt.com and chat.mistral.ai. Interface in French and English.

AN ESTIMATE, NOT A MEASUREMENT

No browser extension can measure what happens in a datacentre. Carbomètre reads the text
already displayed on your screen, estimates the token count, and applies published
energy and grid-intensity figures. The result is an honest order of magnitude — it shows
an uncertainty range of a factor of 3 for that reason.

It is not suitable for regulatory carbon reporting, and it is not a fair way to compare
one provider against another.

The full methodology is public, including the parts we consider weak: every coefficient
is either sourced or explicitly labelled an assumption. Emissions from training the
models are not counted, and the hidden context a provider re-sends on every turn is
invisible to the extension, so long conversations are underestimated.

PRIVACY

- No network requests at all. The extension never contacts any server, including ours.
- No analytics, no crash reporting, no remote configuration, no account.
- Your messages are never stored. Only per-conversation totals, response counts, a
  cumulative total, a per-day emissions ledger and your two settings (location answer,
  chosen comparison) are saved — numbers, never content.
- Everything stays in your browser's local storage, on your machine.

The "storage" permission is used for exactly that and nothing else.

Free and open source (MIT).
```

---

## Français

**Nom** (≤75 caractères)

```
Carbomètre — estimation CO2 de vos conversations IA
```

**Description courte** (≤132 caractères)

```
Affiche en temps réel une estimation des émissions de gaz à effet de serre de vos conversations avec une IA. Rien ne sort du navigateur.
```

**Description détaillée**

```
Carbomètre met un chiffre sur vos conversations avec une IA : une estimation des
émissions de gaz à effet de serre qu'elles provoquent.

Une petite pastille flottante affiche le total courant de la conversation en cours.
Déplacez-la où vous voulez sur la page, elle y reste. Un clic ouvre un tableau de bord
court : cette conversation, votre total cumulé depuis la dernière remise à zéro, et son
équivalent en kilomètres en voiture ou en avion — au choix.

À l'installation, une seule question : êtes-vous principalement en France, ou
principalement ailleurs ? Elle ajuste une règle du calcul pour les modèles hébergés en
Europe. Modifiable ensuite depuis le tableau de bord.

Fonctionne sur claude.ai, chatgpt.com et chat.mistral.ai. Interface en français et en
anglais.

UNE ESTIMATION, PAS UNE MESURE

Aucune extension de navigateur ne peut mesurer ce qui se passe dans un centre de
données. Carbomètre lit le texte déjà affiché à l'écran, estime le nombre de tokens, et
applique des facteurs d'énergie et d'intensité carbone publiés. Le résultat est un ordre
de grandeur honnête — c'est pourquoi une marge d'incertitude d'un facteur 3 est affichée.

L'outil ne convient pas à un reporting carbone réglementaire, et ne permet pas de
comparer équitablement un fournisseur à un autre.

La méthodologie complète est publique, y compris ses points faibles : chaque coefficient
est soit sourcé, soit explicitement signalé comme une hypothèse. Les émissions liées à
l'entraînement des modèles ne sont pas comptées, et le contexte invisible que le
fournisseur renvoie à chaque tour échappe à l'extension — les longues conversations sont
donc sous-estimées.

CONFIDENTIALITÉ

- Aucune requête réseau. L'extension ne contacte aucun serveur, y compris le nôtre.
- Aucune analyse d'usage, aucun rapport d'erreur, aucune configuration distante, aucun
  compte.
- Vos messages ne sont jamais stockés. Seuls sont conservés les totaux par conversation,
  le nombre de réponses, un total cumulé, un relevé d'émissions par jour et vos deux
  réglages (localisation, équivalent choisi) — des nombres, jamais du contenu.
- Tout reste dans le stockage local de votre navigateur, sur votre machine.

La permission « storage » sert exactement à cela, et à rien d'autre.

Gratuit et open source (licence MIT).
```

---

## Permission justifications

Chrome asks for these in the developer dashboard.

**`storage`**

```
Stores the running emissions total per conversation, the number of responses seen, a
cumulative total with its reset date, an all-time total, a per-day emissions total, and
two user settings
(location answer, chosen comparison unit), so the badge can show a conversation's total
again when the user returns to it. Numbers only; message content is never stored.
Nothing is transmitted.
```

**Host access to claude.ai, chatgpt.com, chat.openai.com, chat.mistral.ai**

```
The extension estimates emissions from the text of an exchange already rendered on these
pages, and injects its badge and dashboard into them. It reads only the visible message
text and the model name shown in the interface. It makes no network requests and sends
nothing anywhere.
```

**Background service worker**: registers one listener, `chrome.runtime.onInstalled`, to
open the onboarding page once on first install. No alarms, no messaging, no network.
Opening the tab uses `chrome.tabs.create`, which needs no `tabs` permission.

**Remote code**: none. Everything runs from the bundled `content.js`, `background.js`
and `onboarding.js`.

---

## Assets

- [x] **Icon.** Source of truth: `apps/extension/assets/logo.png` — the cloud logo with the
      painted checkerboard removed (the delivered file had no alpha channel), cropped and
      squared with an 8% margin. `node scripts/make-icons.mjs assets/logo.png` regenerates
      the three sizes. At 16 px the wordmark is unreadable; that size only appears in
      `chrome://extensions` since the extension has no toolbar button.
- [x] **Small promo tile** (440×280): `apps/extension/assets/store/promo-tile-440x280.png`,
      the logo centred on white.
- [ ] **Screenshots** (1280×800, PNG/JPEG, no transparency, 1 to 5). To capture from a real
      session — see "Screenshots to take" below.

### Screenshots to take

Same window size for all of them, light theme, French interface, a real conversation (not
lorem ipsum, but nothing personal — the message text will be public).

1. **The badge in place** on claude.ai, bottom right of a conversation, showing a non-zero
   total. This is the one people see first: it should say "small, unobtrusive".
2. **The dashboard open**, on the same page, with a few responses counted so the numbers
   and the uncertainty range are meaningful. Equivalent set to "Voiture (km)".
3. **The same dashboard on chatgpt.com**, to show it is not tied to one site.
4. **The methodology page** (the link in the dashboard), scrolled to the formula — the
   honesty is the pitch.
5. Optional: **the onboarding question**.

Capturing at exactly 1280×800 on macOS: in Chrome, open DevTools (⌥⌘I), toggle the device
toolbar (⇧⌘M), set "Responsive" to 1280 × 800, then ⇧⌘P → "Capture screenshot". The
extension's content script runs inside the emulated view like anywhere else. Check the
result with `sips -g pixelWidth -g pixelHeight <file>`.
