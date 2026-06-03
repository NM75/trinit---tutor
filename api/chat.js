import { verifyToken, createClerkClient } from "@clerk/backend";

// Origines de confiance (production + app Vercel).
const ALLOWED_ORIGINS = [
  "https://trinit-tutor.vercel.app",
  "https://trinitelafee.fr",
  "https://www.trinitelafee.fr",
];

// ─────────────────────────── Quota hebdo ───────────────────────────
// On limite le nombre de DÉMARRAGES de leçon par semaine (génération de la
// leçon, signalée par le client via `kind: "lesson"`). Q&A et quiz ne comptent
// pas. Le tier vient de Clerk (publicMetadata.plan === "premium").
const FREE_LIMIT = 3;
const PREMIUM_LIMIT = 15;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Clé de semaine = date (YYYY-MM-DD) du lundi de la semaine courante en
// Europe/Paris. Pré-calculée côté serveur → comptage trivial et reset propre le
// lundi 00:00 Paris, sans calcul de fuseau/DST dans la requête SQL.
function parisWeekKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const y = Number(get("year")), m = Number(get("month")), d = Number(get("day"));
  const dow = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[get("weekday")];
  // Recule jusqu'au lundi en arithmétique calendaire (UTC pour éviter le DST).
  return new Date(Date.UTC(y, m - 1, d - dow)).toISOString().slice(0, 10);
}

// Compte les démarrages de leçon de la semaine via PostgREST (service role).
async function countLessonStarts(userId, weekKey) {
  const url = `${SUPABASE_URL}/rest/v1/lesson_starts?select=id`
    + `&user_id=eq.${encodeURIComponent(userId)}&week_key=eq.${weekKey}`;
  const r = await fetch(url, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase count ${r.status}`);
  const rows = await r.json();
  return Array.isArray(rows) ? rows.length : 0;
}

// Enregistre un démarrage (service role : bypass RLS, le client ne peut pas écrire).
async function recordLessonStart(userId, weekKey) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/lesson_starts`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ user_id: userId, week_key: weekKey }),
  });
  if (!r.ok) throw new Error(`Supabase insert ${r.status}`);
}

// Lit le tier du parent depuis Clerk ("premium" sinon "free").
async function getPlan(userId) {
  try {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const user = await clerk.users.getUser(userId);
    return user.publicMetadata?.plan === "premium" ? "premium" : "free";
  } catch (e) {
    // En cas d'échec, on applique la limite gratuite (prudence côté business).
    console.error("Clerk getUser error:", e);
    return "free";
  }
}

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

  let sub;
  try {
    ({ sub } = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties,
    }));
  } catch (e) {
    return res.status(401).json({ error: "Session invalide" });
  }

  const { messages, system, kind } = req.body;

  // Quota hebdo : uniquement sur le démarrage d'une leçon (kind === "lesson").
  // weekKey reste défini si le comptage a réussi → on enregistrera après succès.
  let weekKey = null;
  if (kind === "lesson") {
    const plan = await getPlan(sub);
    const limit = plan === "premium" ? PREMIUM_LIMIT : FREE_LIMIT;
    const key = parisWeekKey();
    try {
      const used = await countLessonStarts(sub, key);
      if (used >= limit) {
        return res.status(429).json({ error: "quota", plan, limit });
      }
      weekKey = key; // comptage fiable → on pourra enregistrer le démarrage
    } catch (e) {
      // Comptage indisponible (Supabase down/config manquante) : on laisse passer
      // la leçon plutôt que de bloquer l'enfant, sans enregistrer (weekKey null).
      console.error("Quota count error:", e);
    }
  }

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
    // Leçon réellement générée → on consomme un crédit (await pour que l'insert
    // se termine avant le gel de la fonction serverless ; best-effort).
    if (weekKey) {
      try { await recordLessonStart(sub, weekKey); }
      catch (e) { console.error("Quota record error:", e); }
    }
    return res.status(200).json(data);
  } catch (e) {
    console.error("Anthropic API error:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
