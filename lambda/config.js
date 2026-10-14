// Gemeinsame Einstellungen für alle Haushalte. Keine Geheimnisse: der
// API-Schlüssel jedes Haushalts entsteht beim Koppeln („Kopplungscode …“)
// und liegt im Skill-Speicher (DynamoDB des Alexa-hosted Skills).
module.exports = {
  // Backend der Einkaufsplan-App
  baseUrl: "https://pb.ep.wievielbrauchich.de",
};
