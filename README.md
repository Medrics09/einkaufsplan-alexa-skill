# Alexa-Skill „Einkaufsplan“

Alexa-Skill für die [Einkaufsplan-App](https://ep.wievielbrauchich.de): Einträge per Sprache hinzufügen, streichen und vorlesen. Amazon hat die Schnittstelle zur eingebauten Alexa-Einkaufsliste 2024 abgeschaltet – deshalb ein eigener Skill mit eigenem Aufrufnamen.

| Sprachbefehl | Wirkung |
|---|---|
| „Alexa, sag mein Einkauf, füge zwei Liter Milch und Eier hinzu“ | hinzufügen (mehrere mit „und“/Komma) |
| „Alexa, sag mein Einkauf, streiche Tomaten“ | per Name entfernen |
| „Alexa, frag mein Einkauf, was auf der Liste steht“ | offene Einträge vorlesen (max. 15) |
| „Alexa, öffne mein Einkauf“ → „Butter“ → „Noch etwas?“ → „nein“ | mehrere Einträge nacheinander |
| „Alexa, sag mein Einkauf, Kopplungscode 4 8 1 5 2 3“ | mit dem Haushalt verbinden |

Jede erfolgreiche Änderung beginnt mit einem Ton und nennt „Einkaufsplan“ – so ist hörbar, dass nicht Alexas eigene Liste bedient wurde. Zuordnung zu vorhandenen Zutaten (Singular/Plural, Tippfehler) und Zusammenführen macht das Backend.

## Einrichtung (pro Haushalt, ca. 15 Minuten)

Die ausführliche Anleitung steht in der App unter **Haushalt → API-Schlüssel → Anleitung**. Kurzfassung:

1. Auf <https://developer.amazon.com/alexa/console/ask> mit dem Amazon-Konto der Echos anmelden.
2. „Skill erstellen“ → Name „Einkaufsplan“, Deutsch (DE), Modell „Benutzerdefiniert“, Hosting „Alexa-hosted (Node.js)“, Region EU → Vorlage **„Skill importieren“** mit der Adresse dieses Repositorys.
3. Reiter „Test“ → auf „Entwicklung“ stellen.
4. In der App: Haushalt → API-Schlüssel → **„Alexa koppeln“** → Liste wählen, Code erzeugen und den Kopplungssatz zum Echo sagen.

Es müssen keine Dateien bearbeitet werden: Der Skill enthält keine Zugangsdaten. Beim Koppeln tauscht er den Einmal-Code gegen einen eigenen API-Schlüssel des Haushalts und legt ihn pro Alexa-Konto im Skill-Speicher (DynamoDB des Alexa-hosted Skills) ab. Die Liste wird in der App gewählt; wird der Schlüssel „Alexa“ dort gelöscht, ist der Skill getrennt.

## Aufbau

- `skill-package/` – Manifest und Sprachmodell (de-DE; `AMAZON.SearchQuery` für Einträge, `AMAZON.NUMBER` für den Code)
- `lambda/index.js` – Intents, Kopplung, Antworten
- `lambda/api.js` – Aufrufe der Erweiterungs-API (`/api/ext/v1/pair`, `/lists/default/…`)
- `lambda/persistence.js` – DynamoDB im Alexa-hosted Skill, lokal im Arbeitsspeicher
- `lambda/config.js` – Backend-Adresse (keine Geheimnisse)

## Lokal testen

In `lambda/`: `npm i`, `config.baseUrl` auf eine Test-Instanz setzen und Requests an `exports.handler` schicken (Callback-Stil: `handler(event, context, (err, res) => …)`). Ohne `DYNAMODB_PERSISTENCE_TABLE_NAME` wird die Kopplung im Arbeitsspeicher gehalten.

## Kürzer sprechen

- **Aufrufname:** Vorgabe ist „mein einkauf“ (Amazon verlangt mindestens zwei Wörter, nur Kleinbuchstaben; „mein einkauf“ scheitert, weil Alexa „Einkaufsplan“ immer als ein Wort erkennt). Ändern: Developer Console → Build → Invocations → Skill Invocation Name (z. B. „unser einkauf“), speichern, Modell neu erstellen. Sehr allgemeine Wörter vermeiden.
- **Alexa-Routinen** (feste Sätze, Aktion „Benutzerdefiniert“): „Alexa, Einkaufsliste“ → `öffne mein einkauf` (Dialog: „Was soll drauf?“), „Alexa, was steht auf der Einkaufsliste“ → `frag mein einkauf was auf der liste steht`. Frei gesprochene Artikel kann eine Routine nicht weitergeben.
