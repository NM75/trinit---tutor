import { verifyToken } from "@clerk/backend";

// Origines de confiance (production + app Vercel).
const ALLOWED_ORIGINS = [
  "https://trinit-tutor.vercel.app",
  "https://trinitelafee.fr",
  "https://www.trinitelafee.fr",
];

// Renvoie l'origine si elle est autorisée (liste blanche ou Previews Vercel),
// sinon null. Le header CORS n'accepte qu'une valeur, d'où le renvoi de
// l'origine entrante exacte.
function resolveOrigin(origin) {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol === "https:" && hostname.endsWith(".vercel.app")) return origin; // Previews
  } catch (e) {}
  return null;
}

export default async function handler(req, res) {
  // CORS
  const origin = resolveOrigin(req.headers.origin);
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Auth Clerk : token de session via header Authorization: Bearer <token>
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Non authentifié" });

  // azp doit correspondre à une origine de confiance (+ l'origine résolue le cas échéant).
  const authorizedParties = [...ALLOWED_ORIGINS];
  if (origin && !authorizedParties.includes(origin)) authorizedParties.push(origin);

  try {
    await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties,
    });
  } catch (e) {
    return res.status(401).json({ error: "Session invalide" });
  }

  const { messages, system } = req.body;

  // Forward to Anthropic
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system,
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    return res.status(200).json(data);
  } catch (e) {
    console.error("Anthropic API error:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
