// Speicher für die Kopplung pro Alexa-Konto. Alexa-hosted Skills bringen
// eine DynamoDB-Tabelle mit (Umgebungsvariablen DYNAMODB_PERSISTENCE_*).
// Ohne diese Variablen (lokale Tests) wird im Arbeitsspeicher gespeichert.

function memoryAdapter() {
  const data = new Map();
  const key = (env) => env.context.System.user.userId;
  return {
    getAttributes: async (env) => data.get(key(env)) || {},
    saveAttributes: async (env, attrs) => void data.set(key(env), attrs),
    deleteAttributes: async (env) => void data.delete(key(env)),
  };
}

function adapter() {
  const table = process.env.DYNAMODB_PERSISTENCE_TABLE_NAME;
  if (!table) return memoryAdapter();
  // Wie in Amazons Alexa-hosted-Vorlage: Adapter 2.x erwartet den
  // DynamoDB-Client aus aws-sdk v2.
  const { DynamoDbPersistenceAdapter } = require("ask-sdk-dynamodb-persistence-adapter");
  const AWS = require("aws-sdk");
  return new DynamoDbPersistenceAdapter({
    tableName: table,
    createTable: false,
    dynamoDBClient: new AWS.DynamoDB({ apiVersion: "latest", region: process.env.DYNAMODB_PERSISTENCE_REGION }),
  });
}

module.exports = { adapter };
