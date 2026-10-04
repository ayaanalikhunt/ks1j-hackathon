// The language model behind the guide: Anthropic's Messages API over plain fetch, with retries. The key is a server secret and
// never reaches a browser. `fetchImpl` and the base URL are injectable so tests never touch the network.

const NOT_CONFIGURED = "not-configured";

const configured = (key) => typeof key === "string" && key.length > 8 && key !== NOT_CONFIGURED;

/** Last 12 turns, role and text only, trimmed. Anything else a client sends is dropped. */
function sanitizeHistory(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const { role, content } = item;
    if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) out.push({ role, content: content.trim().slice(0, 4000) });
  }
  return out.slice(-12);
}

/** The API wants alternating turns that start with the user. Merge neighbours, drop a leading assistant turn. */
function toTurns(history, question) {
  const turns = [];
  for (const t of [...history, { role: "user", content: question }]) {
    const last = turns[turns.length - 1];
    if (last && last.role === t.role) last.content += `\n\n${t.content}`;
    else turns.push({ role: t.role, content: t.content });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

/**
 * @param o { apiKey, model, base, system, turns, fetchImpl, retries }
 * @returns the answer text. Throws if the guide cannot answer after the retries.
 */
async function complete({ apiKey, model, base = "https://api.anthropic.com", system, turns, fetchImpl = fetch, retries = 2 }) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(`${base}/v1/messages`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 900, system, messages: turns }),
      });
      if (!res.ok) throw new Error(`The model returned ${res.status}.`);
      const body = await res.json();
      const text = (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (!text) throw new Error("Empty response from the guide.");
      return text;
    } catch (e) {
      last = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, process.env.FUNCTIONS_EMULATOR === "true" ? 5 : 800 * (attempt + 1)));
    }
  }
  throw last instanceof Error ? last : new Error("The guide could not answer just now.");
}

module.exports = { complete, configured, sanitizeHistory, toTurns, NOT_CONFIGURED };
