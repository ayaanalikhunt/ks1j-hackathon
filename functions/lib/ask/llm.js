// The language model behind the guide, over plain fetch with retries: Anthropic's Messages API or OpenAI's Chat Completions
// API, chosen by `provider`. The key is a server secret and
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

const PROVIDERS = {
  anthropic: {
    base: "https://api.anthropic.com",
    request: ({ apiKey, model, system, turns }) => ({
      path: "/v1/messages",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: { model, max_tokens: 900, system, messages: turns },
    }),
    text: (body) => (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n"),
  },
  openai: {
    base: "https://api.openai.com",
    request: ({ apiKey, model, system, turns }) => ({
      path: "/v1/chat/completions",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      // the system prompt goes first; turns are already user/assistant only
      body: { model, max_completion_tokens: 900, messages: [{ role: "system", content: system }, ...turns] },
    }),
    text: (body) => body.choices?.[0]?.message?.content ?? "",
  },
  // Google's OpenAI-compatible endpoint. Flash models think before answering and that counts against max_tokens, so allow
  // more room and ask for low reasoning effort.
  gemini: {
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    request: ({ apiKey, model, system, turns }) => ({
      path: "/chat/completions",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: { model, max_tokens: 2048, reasoning_effort: "low", messages: [{ role: "system", content: system }, ...turns] },
    }),
    text: (body) => body.choices?.[0]?.message?.content ?? "",
  },
};

/**
 * @param o { provider, apiKey, model, base, system, turns, fetchImpl, retries }
 * @returns the answer text. Throws if the guide cannot answer after the retries.
 */
async function complete({ provider = "anthropic", apiKey, model, base, system, turns, fetchImpl = fetch, retries = 2 }) {
  const p = PROVIDERS[provider];
  if (!p) throw new Error(`Unknown model provider: ${provider}`);
  const req = p.request({ apiKey, model, system, turns });
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(`${base || p.base}${req.path}`, { method: "POST", headers: req.headers, body: JSON.stringify(req.body) });
      if (!res.ok) throw new Error(`The model returned ${res.status}.`);
      const body = await res.json();
      const text = String(p.text(body) ?? "").trim();
      if (!text) throw new Error("Empty response from the guide.");
      return text;
    } catch (e) {
      last = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, process.env.FUNCTIONS_EMULATOR === "true" ? 5 : 800 * (attempt + 1)));
    }
  }
  throw last instanceof Error ? last : new Error("The guide could not answer just now.");
}

module.exports = { complete, configured, sanitizeHistory, toTurns, NOT_CONFIGURED, PROVIDERS };
