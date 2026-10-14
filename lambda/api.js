// Dünner Client für die Erweiterungs-API (/api/ext/v1/). Die gesamte
// Logik (Zerlegen von „2 l Milch“, Zuordnung zu Zutaten, Zusammenführen)
// liegt im Backend — hier wird nur aufgerufen.
const config = require("./config");

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const res = await fetch(config.baseUrl.replace(/\/+$/, "") + "/api/ext/v1" + path, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(6000), // Alexa wartet max. ~8 s auf die Antwort
  });
  if (res.status === 204) return null;
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}
  if (!res.ok) throw new ApiError(res.status, data.message || `HTTP ${res.status}`);
  return data;
}

let cachedListId = config.listId || null;

async function listId() {
  if (cachedListId) return cachedListId;
  const { lists } = await request("GET", "/lists");
  const wanted = (config.listName || "").trim().toLowerCase();
  const hit = lists.find((l) => l.name.trim().toLowerCase() === wanted) || lists[0];
  if (!hit) throw new ApiError(404, "Keine Liste gefunden.");
  cachedListId = hit.id;
  return cachedListId;
}

module.exports = {
  ApiError,
  add: async (text) => request("POST", `/lists/${await listId()}/items`, { text }),
  remove: async (name) => request("POST", `/lists/${await listId()}/items/remove`, { name }),
  items: async () => request("GET", `/lists/${await listId()}/items`),
};
