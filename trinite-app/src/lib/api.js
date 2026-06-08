// Appel à Claude via le proxy serverless (/api/chat).
// Authentifie chaque requête avec le token de session Clerk (getToken).
// Gère les retries et le timeout.
// opts.kind : "lesson" sur le démarrage d'une leçon (soumis au quota hebdo serveur).
// Retours : texte (succès) | null (échec/401) | { quota:true, plan, limit } (429 quota atteint).

export const callClaude = async (messages, system, getToken, opts = {}) => {
  const { kind, retries = 2 } = opts;
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
        body: JSON.stringify({ messages, system, kind }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        // Session absente/invalide : inutile de réessayer, on laisse l'écran d'erreur s'afficher.
        if (res.status === 401) return null;
        // Quota hebdo atteint : pas un échec technique, on remonte l'info au front (pas de retry).
        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          return { quota: true, plan: body.plan, limit: body.limit };
        }
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

// Lance le tunnel de paiement Stripe (passage en Premium).
// Crée une session Checkout côté serveur (authentifiée Clerk) puis redirige le
// navigateur vers Stripe. Retourne false si la création a échoué (on reste sur place).
export const startCheckout = async (getToken) => {
  try {
    const token = await getToken();
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return false;
    const { url } = await res.json();
    if (!url) return false;
    window.location.href = url;
    return true;
  } catch (e) {
    return false;
  }
};
