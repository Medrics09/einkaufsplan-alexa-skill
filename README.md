# Alexa-Skill „Einkaufsplan“

Privater Alexa-Skill, der direkt mit der Erweiterungs-API (`/api/ext/v1/`) spricht. Amazon hat die Schnittstelle für die eingebaute Alexa-Einkaufsliste 2024 abgeschaltet – deshalb ein eigener Skill mit eigenem Aufrufnamen.

| Sprachbefehl | Wirkung |
|---|---|
| „Alexa, sag Einkaufsplan, füge zwei Liter Milch und Eier hinzu“ | hinzufügen (mehrere mit „und“/Komma) |
| „Alexa, sag Einkaufsplan, streiche Tomaten“ | per Name entfernen |
| „Alexa, frag Einkaufsplan, was auf der Liste steht“ | offene Einträge vorlesen (max. 15) |
| „Alexa, öffne Einkaufsplan“ → „Butter“ → „Noch etwas?“ → „nein“ | Dialog für mehrere Einträge |

Jede erfolgreiche Änderung beginnt mit einem Ton und nennt „Einkaufsplan“ – so ist hörbar, dass nicht Alexas eigene Liste bedient wurde. Zuordnung zu vorhandenen Zutaten (Singular/Plural, Tippfehler) und Zusammenführen macht das Backend.

## Aufbau

- `skill-package/` – Manifest und Sprachmodell (de-DE, Slot `AMAZON.SearchQuery`)
- `lambda/` – Node.js-Code (ask-sdk-core), läuft als **Alexa-hosted Skill** (kostenlos, kein AWS-Konto nötig)
- `lambda/config.js` – Backend-Adresse, API-Schlüssel, Liste. **Nicht im Git** (siehe `config.example.js`); liegt nur im privaten Code-Repository des Skills bei Amazon.

## Einrichtung

1. Amazon-Entwicklerkonto auf <https://developer.amazon.com> mit **demselben Amazon-Konto wie die Echos** anlegen.
2. In der App unter Haushalt → API-Schlüssel einen eigenen Schlüssel „Alexa“ erzeugen.
3. Alexa Developer Console → „Skill erstellen“: Name „Einkaufsplan“, Sprache Deutsch, Modell „Benutzerdefiniert“, Hosting „Alexa-hosted (Node.js)“, Vorlage „Von Grund auf neu“.
4. Sprachmodell: Build → JSON-Editor → Inhalt von `skill-package/interactionModels/custom/de-DE.json` einfügen → Speichern → „Modell erstellen“.
5. Code: Reiter „Code“ → `index.js`, `api.js`, `speech.js`, `package.json` ersetzen bzw. anlegen, `config.js` aus `config.example.js` anlegen und ausfüllen → „Bereitstellen“.
6. Reiter „Test“ → Test auf „Entwicklung“ stellen. Ab jetzt funktioniert der Skill auf allen Echos des Kontos (kein Veröffentlichen nötig).

Alternativ mit der ASK CLI (`npx ask-cli@2 configure`, dann `ask init --hosted-skill-id <id>` und Dateien ins geklonte Repo kopieren, `git push`).

## Lokal testen

`lambda/config.js` auf eine Test-Instanz zeigen lassen, `npm i` in `lambda/`, dann Requests an `exports.handler` schicken (Callback-Stil: `handler(event, context, (err, res) => …)`).
