// Dünner Client für die Erweiterungs-API (/api/ext/v1/). Die gesamte
// Logik (Zerlegen von „2 l Milch“, Zuordnung zu Zutaten, Zusammenführen,
// Standardliste des Schlüssels) liegt im Backend.
const config = require("./config");

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, { token, body } = {}) {
  const res = await fetch(config.baseUrl.replace(/\/+$/, "") + "/api/ext/v1" + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

module.exports = {
  ApiError,
  pair: (code) => request("POST", "/pair", { body: { code, name: "Alexa" } }),
  me: (token) => request("GET", "/me", { token }),
  add: (token, text) => request("POST", "/lists/default/items", { token, body: { text } }),
  remove: (token, name) => request("POST", "/lists/default/items/remove", { token, body: { name } }),
  items: (token) => request("GET", "/lists/default/items", { token }),
};
