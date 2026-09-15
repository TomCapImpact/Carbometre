# Politique de confidentialité — Carbomètre

*Dernière mise à jour : 15 septembre 2026. English version below.*

Carbomètre est une extension de navigateur qui estime les émissions de gaz à effet de
serre de vos conversations avec une IA (claude.ai, chatgpt.com, chat.mistral.ai).

## Ce que l'extension ne fait pas

- **Aucune requête réseau.** L'extension ne contacte aucun serveur, y compris le nôtre.
  Elle n'a pas de serveur.
- **Aucune collecte.** Pas d'analyse d'usage, pas de rapport d'erreur, pas de
  configuration distante, pas de compte, pas d'identifiant publicitaire.
- **Aucun stockage du contenu de vos messages.** Le texte d'une conversation est lu à
  l'écran pour en estimer la longueur, puis oublié. Il n'est jamais écrit nulle part.
- **Aucune transmission ni vente de données**, à quiconque, pour quelque raison que ce
  soit.

## Ce que l'extension conserve, sur votre appareil uniquement

Dans le stockage local du navigateur (`chrome.storage.local`), des nombres et des
identifiants, jamais du contenu :

- le total estimé et le nombre de réponses par conversation, avec l'identifiant de la
  conversation tel qu'il figure dans l'URL ;
- un total cumulé et sa date de dernière remise à zéro, un total depuis l'installation,
  et un relevé d'émissions par jour ;
- vos réglages : langue de l'interface, réponse à la question « principalement en
  France / hors de France », équivalent choisi ;
- la position de la pastille sur la page.

Vous pouvez tout effacer en supprimant l'extension.

## Permissions demandées

- `storage` : pour conserver les totaux et réglages ci-dessus.
- Accès aux pages claude.ai, chatgpt.com, chat.openai.com et chat.mistral.ai : pour
  lire le texte affiché et y afficher la pastille et le tableau de bord.

## Contact

Le code source est public sous licence MIT :
<https://github.com/TomCapImpact/Carbometre>. Toute question peut être posée via les
*issues* du dépôt.

---

# Privacy policy — Carbomètre

*Last updated: 15 September 2026.*

Carbomètre is a browser extension that estimates the greenhouse gas emissions of your
conversations with an AI chatbot (claude.ai, chatgpt.com, chat.mistral.ai).

## What the extension does not do

- **No network requests.** The extension never contacts any server, including ours.
  It has no server.
- **No collection.** No analytics, no crash reporting, no remote configuration, no
  account, no advertising identifier.
- **No storage of message content.** A conversation's text is read on screen to
  estimate its length, then forgotten. It is never written anywhere.
- **No transmission or sale of data**, to anyone, for any reason.

## What the extension keeps, on your device only

In the browser's local storage (`chrome.storage.local`), numbers and identifiers, never
content:

- the estimated total and response count per conversation, with the conversation
  identifier as it appears in the URL;
- a cumulative total with its last reset date, an all-time total, and a per-day
  emissions ledger;
- your settings: interface language, your answer to "mainly in France / mainly
  elsewhere", chosen equivalent;
- the badge's position on the page.

Removing the extension erases all of it.

## Permissions requested

- `storage`: to keep the totals and settings above.
- Access to claude.ai, chatgpt.com, chat.openai.com and chat.mistral.ai pages: to read
  the displayed text and show the badge and dashboard there.

## Contact

The source code is public under the MIT licence:
<https://github.com/TomCapImpact/Carbometre>. Questions can be raised through the
repository's issues.
