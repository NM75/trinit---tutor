// Appel à Claude via le proxy serverless (/api/chat).
// Authentifie chaque requête avec le token de session Clerk (getToken).
// Gère les retries et le timeout.

export const callClaude = async (messages, system, getToken, retries = 2) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const token = await getToken();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages, system }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        // Session absente/invalide : inutile de réessayer, on laisse l'écran d'erreur s'afficher.
        if (res.status === 401) return null;
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
