// Alexa-Skill „Einkaufsplan“: Einträge per Sprache hinzufügen, streichen,
// vorlesen. Spricht direkt mit der Erweiterungs-API der Einkaufsplan-App.
//
// Jeder Haushalt legt den Skill einmal selbst an (Import dieses Repos) und
// koppelt ihn per Code aus der App: „Alexa, sag mein Einkauf, Kopplungscode
// 4 8 1 5 2 3“. Der dabei erhaltene API-Schlüssel wird pro Alexa-Konto im
// Skill-Speicher abgelegt; die Liste wählt der Haushalt in der App.
//
//   „Alexa, sag mein Einkauf, füge zwei Liter Milch und Eier hinzu“
//   „Alexa, sag mein Einkauf, streiche Tomaten“
//   „Alexa, frag mein Einkauf, was auf der Liste steht“
//   „Alexa, öffne mein Einkauf“ → „Was soll drauf?“ → „Butter“ → „Noch etwas?“ …

const Alexa = require("ask-sdk-core");
const api = require("./api");
const { itemPhrase, joinList, splitItems } = require("./speech");
const persistence = require("./persistence");

const MAX_READ = 15;

// Eigener Erfolgston vor jeder Bestätigung — Alexas eingebaute Einkaufsliste
// antwortet ohne Ton, so ist sofort hörbar, dass der Einkaufsplan bedient wurde.
const SUCCESS_SOUND = '<audio src="soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_positive_response_01"/>';

const NOT_PAIRED =
  "Dieser Skill ist noch nicht mit deinem Einkaufsplan verbunden. " +
  "Öffne in der Einkaufsplan-App Haushalt, API-Schlüssel, Alexa koppeln, und sag dann: " +
  "Alexa, sag mein Einkauf, Kopplungscode, gefolgt von den sechs Ziffern.";

// Text für SSML entschärfen (Zutatennamen können &, < usw. enthalten).
function ssml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function slotValue(handlerInput, name) {
  return Alexa.getSlotValue(handlerInput.requestEnvelope, name) || "";
}

// Im offenen Gespräch („öffne mein Einkauf“) nach jeder Aktion nachfragen,
// bei Einzelbefehlen („sag mein Einkauf, …“) direkt beenden.
function inDialog(handlerInput) {
  return !!handlerInput.attributesManager.getSessionAttributes().dialog;
}

function respond(handlerInput, text, { success = false } = {}) {
  const rb = handlerInput.responseBuilder;
  const speech = `${success ? SUCCESS_SOUND : ""}${ssml(text)}`;
  if (inDialog(handlerInput)) {
    return rb.speak(`${speech} Noch etwas?`).reprompt("Noch etwas für den Einkaufsplan?").getResponse();
  }
  return rb.speak(speech).withShouldEndSession(true).getResponse();
}

const isIntent = (handlerInput, ...names) =>
  Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
  names.includes(Alexa.getIntentName(handlerInput.requestEnvelope));

async function getLink(h) {
  const attrs = (await h.attributesManager.getPersistentAttributes()) || {};
  return attrs.apiToken ? attrs : null;
}

async function saveLink(h, link) {
  h.attributesManager.setPersistentAttributes(link || {});
  await h.attributesManager.savePersistentAttributes();
}

// Führt fn(token) aus, wenn gekoppelt; sonst Kopplungs-Hinweis. Wird der
// Schlüssel in der App gelöscht (401), wird die Kopplung hier vergessen.
async function withToken(h, fn) {
  const link = await getLink(h);
  if (!link) return h.responseBuilder.speak(NOT_PAIRED).withShouldEndSession(true).getResponse();
  try {
    return await fn(link.apiToken, link);
  } catch (err) {
    if (err && err.status === 401) {
      await saveLink(h, null);
      return h.responseBuilder
        .speak("Die Verbindung zum Einkaufsplan wurde in der App getrennt. " + NOT_PAIRED)
        .withShouldEndSession(true)
        .getResponse();
    }
    throw err;
  }
}

const LaunchRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === "LaunchRequest",
  async handle(h) {
    if (!(await getLink(h))) {
      return h.responseBuilder
        .speak(`${NOT_PAIRED} Hast du schon einen Code?`)
        .reprompt("Sag: Kopplungscode, und dann die sechs Ziffern.")
        .getResponse();
    }
    h.attributesManager.setSessionAttributes({ dialog: true });
    return h.responseBuilder
      .speak("Einkaufsplan hier. Was soll drauf?")
      .reprompt("Sag zum Beispiel: Milch, oder: was steht auf der Liste.")
      .getResponse();
  },
};

const PairIntentHandler = {
  canHandle: (h) => isIntent(h, "PairIntent"),
  async handle(h) {
    // AMAZON.NUMBER verschluckt führende Nullen („0 4 8 …“) → auffüllen.
    const digits = slotValue(h, "code").replace(/\D/g, "");
    if (!digits) {
      return h.responseBuilder
        .speak("Wie lautet der Kopplungscode? Sag die sechs Ziffern aus der App.")
        .reprompt("Sag: Kopplungscode, und dann die sechs Ziffern.")
        .getResponse();
    }
    const code = digits.padStart(6, "0");
    try {
      const res = await api.pair(code);
      await saveLink(h, { apiToken: res.token, household: res.household, list: res.list });
      const list = res.list ? ` Ich nutze die Liste ${res.list.name}.` : "";
      return h.responseBuilder
        .speak(`${SUCCESS_SOUND}${ssml(`Verbunden mit dem Einkaufsplan von ${res.household}.${list} Sag zum Beispiel: Alexa, sag mein Einkauf, füge Milch hinzu.`)}`)
        .withShouldEndSession(true)
        .getResponse();
    } catch (err) {
      if (err.status === 404 || err.status === 400) {
        return h.responseBuilder
          .speak("Dieser Code ist ungültig oder abgelaufen. Erzeuge in der App einen neuen und versuch es noch einmal.")
          .withShouldEndSession(true)
          .getResponse();
      }
      if (err.status === 429) {
        return h.responseBuilder
          .speak("Zu viele falsche Codes. Bitte warte eine Viertelstunde und versuch es dann noch einmal.")
          .withShouldEndSession(true)
          .getResponse();
      }
      throw err;
    }
  },
};

// AddItemIntent: „füge Milch hinzu“; ItemOnlyIntent: nur „Milch“ (z. B. als
// Antwort auf „Was soll drauf?“) — beide fügen hinzu.
const AddItemIntentHandler = {
  canHandle: (h) => isIntent(h, "AddItemIntent", "ItemOnlyIntent"),
  handle: (h) =>
    withToken(h, async (token) => {
      const parts = splitItems(slotValue(h, "item") || slotValue(h, "grocery"));
      if (parts.length === 0) {
        return h.responseBuilder.speak("Was soll ich hinzufügen?").reprompt("Was soll in den Einkaufsplan?").getResponse();
      }
      const added = [];
      const merged = [];
      const reactivated = [];
      const failed = [];
      for (const part of parts) {
        try {
          const res = await api.add(token, part);
          // Neu angelegt: so wiederholen, wie es gesagt wurde („zwei Tomaten“).
          if (res.result === "created") added.push({ text: part, plural: (Number(res.item.amount) || 0) > 1 });
          else if (res.result === "reactivated") reactivated.push(itemPhrase(res.item));
          else merged.push(res.item);
        } catch (err) {
          if (err.status === 401) throw err;
          console.error("add failed", part, err);
          failed.push(part);
        }
      }
      const sentences = [];
      if (added.length) {
        const plural = added.length > 1 || added[0].plural;
        sentences.push(`${joinList(added.map((a) => a.text))} ${plural ? "stehen" : "steht"} jetzt im Einkaufsplan.`);
      }
      if (reactivated.length) sentences.push(`${joinList(reactivated)} ${reactivated.length === 1 ? "steht" : "stehen"} wieder im Einkaufsplan.`);
      if (merged.length) {
        const names = joinList(merged.map((i) => i.name));
        sentences.push(`${names} ${merged.length === 1 ? "war" : "waren"} schon im Einkaufsplan, jetzt ${joinList(merged.map(itemPhrase))}.`);
      }
      if (failed.length) sentences.push(`${joinList(failed)} konnte ich nicht in den Einkaufsplan eintragen.`);
      return respond(h, sentences.join(" "), { success: failed.length < parts.length });
    }),
};

const RemoveItemIntentHandler = {
  canHandle: (h) => isIntent(h, "RemoveItemIntent"),
  handle: (h) =>
    withToken(h, async (token) => {
      const parts = splitItems(slotValue(h, "item"));
      if (parts.length === 0) {
        return h.responseBuilder.speak("Was soll ich streichen?").reprompt("Was soll aus dem Einkaufsplan?").getResponse();
      }
      const removed = [];
      const missing = [];
      for (const part of parts) {
        try {
          const res = await api.remove(token, part);
          removed.push(res.removed.name);
        } catch (err) {
          if (err.status === 404) missing.push(part);
          else throw err;
        }
      }
      const sentences = [];
      if (removed.length) sentences.push(`${joinList(removed)} habe ich aus dem Einkaufsplan gestrichen.`);
      if (missing.length) sentences.push(`${joinList(missing)} ${missing.length === 1 ? "steht" : "stehen"} nicht im Einkaufsplan.`);
      return respond(h, sentences.join(" "), { success: removed.length > 0 });
    }),
};

const ReadListIntentHandler = {
  canHandle: (h) => isIntent(h, "ReadListIntent"),
  handle: (h) =>
    withToken(h, async (token) => {
      const { items } = await api.items(token);
      const open = items.filter((i) => !i.checked);
      if (open.length === 0) return respond(h, "Der Einkaufsplan ist leer.");
      const read = open.slice(0, MAX_READ).map(itemPhrase);
      const more = open.length > MAX_READ ? ` und ${open.length - MAX_READ} weitere` : "";
      const head = open.length === 1 ? "Im Einkaufsplan steht" : `Im Einkaufsplan stehen ${open.length} Sachen:`;
      return respond(h, `${head} ${joinList(read)}${more}.`);
    }),
};

const YesIntentHandler = {
  canHandle: (h) => isIntent(h, "AMAZON.YesIntent"),
  async handle(h) {
    if (!(await getLink(h))) {
      return h.responseBuilder.speak("Dann sag: Kopplungscode, und die sechs Ziffern.").reprompt("Wie lautet der Code?").getResponse();
    }
    h.attributesManager.setSessionAttributes({ dialog: true });
    return h.responseBuilder.speak("Was noch?").reprompt("Was soll in den Einkaufsplan?").getResponse();
  },
};

const StopIntentHandler = {
  canHandle: (h) => isIntent(h, "AMAZON.NoIntent", "AMAZON.StopIntent", "AMAZON.CancelIntent", "AMAZON.NavigateHomeIntent"),
  handle: (h) => h.responseBuilder.speak("Okay.").withShouldEndSession(true).getResponse(),
};

const HelpIntentHandler = {
  canHandle: (h) => isIntent(h, "AMAZON.HelpIntent"),
  async handle(h) {
    if (!(await getLink(h))) return h.responseBuilder.speak(NOT_PAIRED).withShouldEndSession(true).getResponse();
    h.attributesManager.setSessionAttributes({ dialog: true });
    return h.responseBuilder
      .speak("Sag zum Beispiel: füge zwei Liter Milch hinzu. Streiche Tomaten. Oder: was steht auf der Liste.")
      .reprompt("Was möchtest du tun?")
      .getResponse();
  },
};

const FallbackIntentHandler = {
  canHandle: (h) => isIntent(h, "AMAZON.FallbackIntent"),
  handle(h) {
    return h.responseBuilder
      .speak("Das habe ich nicht verstanden. Sag zum Beispiel: füge Milch hinzu.")
      .reprompt("Was soll in den Einkaufsplan?")
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === "SessionEndedRequest",
  handle: (h) => h.responseBuilder.getResponse(),
};

const ErrorHandler = {
  canHandle: () => true,
  handle(h, error) {
    console.error("Fehler", error);
    return h.responseBuilder
      .speak("Der Einkaufsplan ist gerade nicht erreichbar. Versuch es bitte gleich noch einmal.")
      .withShouldEndSession(true)
      .getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    PairIntentHandler,
    AddItemIntentHandler,
    RemoveItemIntentHandler,
    ReadListIntentHandler,
    YesIntentHandler,
    StopIntentHandler,
    HelpIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withPersistenceAdapter(persistence.adapter())
  .withCustomUserAgent("einkaufsplan/alexa-skill")
  .lambda();
