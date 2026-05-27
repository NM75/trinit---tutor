// Appel à Claude via le proxy serverless (/api/chat).
// Gère les retries et le timeout. Le password sera remplacé par Clerk en Phase 2.

export const callClaude = async (messages, system, password, retries = 2) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, messages, system }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        if (res.status === 401) return "__WRONG_PASSWORD__";
        if (attempt < retries) { await new Promise((r) => setTimeout(r, 1500)); continue; }
        throw new Error(`API ${res.status}`);
      }
      const data = await res.json();
      const text = data.content?.find((b) => b.type === "text")?.text;
      if (text) return text;
      if (attempt < retries) { await new Promise((r) => setTimeout(r, 1500)); continue; }
      throw new Error("Empty");
    } catch (e) {
      if (attempt >= retries) return null;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
};
