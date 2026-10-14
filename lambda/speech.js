// Text-Bausteine für die Sprachausgabe.

const UNIT_WORDS = {
  "": ["", ""],
  g: ["Gramm", "Gramm"],
  kg: ["Kilo", "Kilo"],
  ml: ["Milliliter", "Milliliter"],
  l: ["Liter", "Liter"],
  Pckg: ["Packung", "Packungen"],
  Dose: ["Dose", "Dosen"],
  Flasche: ["Flasche", "Flaschen"],
  Glas: ["Glas", "Gläser"],
  Bund: ["Bund", "Bund"],
  EL: ["Esslöffel", "Esslöffel"],
  TL: ["Teelöffel", "Teelöffel"],
  Prise: ["Prise", "Prisen"],
};

function number(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace(".", ",");
}

// „2 Liter Milch“, „Butter“ (1 Stück), „3 Äpfel“
function itemPhrase(item) {
  const amount = Number(item.amount) || 0;
  const [singular, plural] = UNIT_WORDS[item.unit || ""] || [item.unit, item.unit];
  if (!item.unit) return amount > 1 ? `${number(amount)} ${item.name}` : item.name;
  const unit = amount === 1 ? singular : plural;
  return amount > 0 ? `${number(amount)} ${unit} ${item.name}` : `${item.name}`;
}

function joinList(parts) {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
}

// „Milch, Eier und Butter“ → ["Milch", "Eier", "Butter"]
function splitItems(text) {
  return String(text || "")
    .split(/\s*(?:,|;|\bund\b|\bsowie\b|\bplus\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = { itemPhrase, joinList, splitItems };
