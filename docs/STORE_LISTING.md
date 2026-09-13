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
conversation, the last 30 days, and what that is worth in kilometres driven by an
average car.

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
- Your messages are never stored. Only per-conversation totals, response counts and a
  per-day emissions ledger are saved — numbers, never content.
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
court : cette conversation, les 30 derniers jours, et l'équivalent en kilomètres
parcourus par une voiture moyenne.

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
  le nombre de réponses et un relevé d'émissions par jour — des nombres, jamais du
  contenu.
- Tout reste dans le stockage local de votre navigateur, sur votre machine.

La permission « storage » sert exactement à cela, et à rien d'autre.

Gratuit et open source (licence MIT).
```

---

## Permission justifications

Chrome asks for these in the developer dashboard.

**`storage`**

```
Stores the running emissions total per conversation, the number of responses seen, and a
per-day emissions total, so the badge can show a conversation's total again when the user
returns to it. Numbers only; message content is never stored. Nothing is transmitted.
```

**Host access to claude.ai, chatgpt.com, chat.openai.com, chat.mistral.ai**

```
The extension estimates emissions from the text of an exchange already rendered on these
pages, and injects its badge and dashboard into them. It reads only the visible message
text and the model name shown in the interface. It makes no network requests and sends
nothing anywhere.
```

**Remote code**: none. Everything runs from the bundled `content.js`.

---

## Assets still to produce

- [ ] **Icon.** `apps/extension/icons/` currently holds a plain generated placeholder.
      Run `node scripts/make-icons.mjs path/to/logo.png` from `apps/extension/` to
      replace all three sizes from a real square logo.
- [ ] **Screenshots** (1280×800 or 640×400, up to 5). Suggested: the badge in place on a
      conversation, the dashboard open, and the methodology page. These must be captured
      from a real browser session.
- [ ] **Small promo tile** (440×280), optional but it improves placement.
