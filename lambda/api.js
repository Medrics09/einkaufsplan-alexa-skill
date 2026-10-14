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

// Bewusst mit dem eingebauten https-Modul statt fetch(): läuft auf jeder
// Node-Version, die Alexa-hosted Skills verwenden.
function request(method, path, { token, body } = {}) {
  const url = new URL(config.baseUrl.replace(/\/+$/, "") + "/api/ext/v1" + path);
  const payload = body ? JSON.stringify(body) : null;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }
  const lib = url.protocol === "http:" ? require("http") : require("https");
  return new Promise((resolve, reject) => {
    const req = lib.request(url, { method, headers, timeout: 6000 }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        if (res.statusCode === 204) return resolve(null);
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (_) {}
        if (res.statusCode >= 400) return reject(new ApiError(res.statusCode, data.message || `HTTP ${res.statusCode}`));
        resolve(data);
      });
    });
    // Alexa wartet max. ~8 s auf die Antwort.
    req.on("timeout", () => req.destroy(new ApiError(504, "Zeitüberschreitung")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = {
  ApiError,
  pair: (code) => request("POST", "/pair", { body: { code, name: "Alexa" } }),
  me: (token) => request("GET", "/me", { token }),
  add: (token, text) => request("POST", "/lists/default/items", { token, body: { text } }),
  remove: (token, name) => request("POST", "/lists/default/items/remove", { token, body: { name } }),
  items: (token) => request("GET", "/lists/default/items", { token }),
};
