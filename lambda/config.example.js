// Kopie als config.js anlegen und ausfüllen. config.js ist per .gitignore
// vom Einkaufsplan-Repo ausgeschlossen und landet nur im (privaten) Code-
// Repository des Alexa-hosted Skills bei Amazon.
module.exports = {
  // Backend-Adresse (Haushalt → API-Schlüssel → „Backend-Adresse“)
  baseUrl: "https://pb.example.de",
  // Eigener Schlüssel nur für Alexa (Haushalt → API-Schlüssel → „Erzeugen“)
  apiKey: "",
  // ID der Liste, in die Alexa schreibt (leer = erste Liste mit Namen listName)
  listId: "",
  listName: "Einkaufsliste",
};
