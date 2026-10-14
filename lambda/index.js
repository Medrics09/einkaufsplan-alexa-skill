// Alexa-Skill „Einkaufsplan“: Einträge per Sprache hinzufügen, streichen,
// vorlesen. Spricht direkt mit der Erweiterungs-API der Einkaufsplan-App.
//
//   „Alexa, sag Einkaufsplan, füge zwei Liter Milch und Eier hinzu“
//   „Alexa, sag Einkaufsplan, streiche Tomaten“
//   „Alexa, frag Einkaufsplan, was auf der Liste steht“
//   „Alexa, öffne Einkaufsplan“ → „Was soll auf die Liste?“ → „Butter“ → „Noch etwas?“ …

const Alexa = require("ask-sdk-core");
const api = require("./api");
const { itemPhrase, joinList, splitItems } = require("./speech");

const MAX_READ = 15;

// Eigener Erfolgston vor jeder Bestätigung — Alexas eingebaute Einkaufsliste
// antwortet ohne Ton, so ist sofort hörbar, dass der Einkaufsplan bedient wurde.
const SUCCESS_SOUND = '<audio src="soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_positive_response_01"/>';

// Text für SSML entschärfen (Zutatennamen können &, < usw. enthalten).
function ssml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function slotValue(handlerInput, name) {
  return Alexa.getSlotValue(handlerInput.requestEnvelope, name) || "";
}

// Im offenen Gespräch („öffne Einkaufsplan“) nach jeder Aktion nachfragen,
// bei Einzelbefehlen („sag Einkaufsplan, …“) direkt beenden.
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

const LaunchRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === "LaunchRequest",
  handle(h) {
    h.attributesManager.setSessionAttributes({ dialog: true });
    return h.responseBuilder
      .speak("Einkaufsplan hier. Was soll drauf?")
      .reprompt("Sag zum Beispiel: Milch, oder: was steht auf der Liste.")
      .getResponse();
  },
};

const AddItemIntentHandler = {
  canHandle: (h) => isIntent(h, "AddItemIntent"),
  async handle(h) {
    const parts = splitItems(slotValue(h, "item"));
    if (parts.length === 0) {
      return h.responseBuilder.speak("Was soll ich hinzufügen?").reprompt("Was soll auf die Liste?").getResponse();
    }
    const added = [];
    const merged = [];
    const reactivated = [];
    const failed = [];
    for (const part of parts) {
      try {
        const res = await api.add(part);
        if (res.result === "created") added.push(itemPhrase(res.item));
        else if (res.result === "reactivated") reactivated.push(itemPhrase(res.item));
        else merged.push(res.item);
      } catch (err) {
        console.error("add failed", part, err);
        failed.push(part);
      }
    }
    const sentences = [];
    if (added.length) sentences.push(`${joinList(added)} ${added.length === 1 ? "steht" : "stehen"} jetzt im Einkaufsplan.`);
    if (reactivated.length) sentences.push(`${joinList(reactivated)} ${reactivated.length === 1 ? "steht" : "stehen"} wieder im Einkaufsplan.`);
    if (merged.length) {
      const names = joinList(merged.map((i) => i.name));
      sentences.push(`${names} ${merged.length === 1 ? "war" : "waren"} schon im Einkaufsplan, jetzt ${joinList(merged.map(itemPhrase))}.`);
    }
    if (failed.length) sentences.push(`${joinList(failed)} konnte ich nicht in den Einkaufsplan eintragen.`);
    return respond(h, sentences.join(" "), { success: failed.length < parts.length });
  },
};

const RemoveItemIntentHandler = {
  canHandle: (h) => isIntent(h, "RemoveItemIntent"),
  async handle(h) {
    const parts = splitItems(slotValue(h, "item"));
    if (parts.length === 0) {
      return h.responseBuilder.speak("Was soll ich streichen?").reprompt("Was soll von der Liste?").getResponse();
    }
    const removed = [];
    const missing = [];
    for (const part of parts) {
      try {
        const res = await api.remove(part);
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
  },
};

const ReadListIntentHandler = {
  canHandle: (h) => isIntent(h, "ReadListIntent"),
  async handle(h) {
    const { items } = await api.items();
    const open = items.filter((i) => !i.checked);
    if (open.length === 0) return respond(h, "Der Einkaufsplan ist leer.");
    const read = open.slice(0, MAX_READ).map(itemPhrase);
    const more = open.length > MAX_READ ? ` und ${open.length - MAX_READ} weitere` : "";
    const head = open.length === 1 ? "Im Einkaufsplan steht" : `Im Einkaufsplan stehen ${open.length} Sachen:`;
    return respond(h, `${head} ${joinList(read)}${more}.`);
  },
};

const YesIntentHandler = {
  canHandle: (h) => isIntent(h, "AMAZON.YesIntent"),
  handle(h) {
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
  handle(h) {
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
      .reprompt("Was soll auf die Liste?")
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
    const text =
      error && error.status === 401
        ? "Der API-Schlüssel wird nicht mehr akzeptiert. Bitte in der Einkaufsplan-App einen neuen anlegen."
        : "Der Einkaufsplan ist gerade nicht erreichbar. Versuch es bitte gleich noch einmal.";
    return h.responseBuilder.speak(text).withShouldEndSession(true).getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
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
  .withCustomUserAgent("einkaufsplan/alexa-skill")
  .lambda();
