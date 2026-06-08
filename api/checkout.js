import Stripe from "stripe";
import { verifyToken, createClerkClient } from "@clerk/backend";

// Origines de confiance (production + app Vercel). Identique à api/chat.js :
// sert au CORS, au contrôle de l'azp du token Clerk, et au calcul des URLs de retour.
const ALLOWED_ORIGINS = [
  "https://trinit-tutor.vercel.app",
  "https://trinitelafee.fr",
  "https://www.trinitelafee.fr",
];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Renvoie l'origine si elle est autorisée (liste blanche ou Previews Vercel), sinon null.
function resolveOrigin(origin) {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol === "https:" && hostname.endsWith(".vercel.app")) return origin; // Previews
  } catch (e) {}
  return null;
}

// Récupère l'email principal du parent (pré-remplit Checkout, confort utilisateur).
async function getEmail(userId) {
  try {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const user = await clerk.users.getUser(userId);
    const primary = user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId);
    return primary?.emailAddress || user.emailAddresses?.[0]?.emailAddress || undefined;
  } catch (e) {
    return undefined; // pas bloquant : Stripe demandera l'email
  }
}

export default async function handler(req, res) {
  // CORS (même logique que api/chat.js)
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

  // URLs de retour : on revient sur l'app d'où vient la requête (ou prod par défaut).
  const appUrl = origin || ALLOWED_ORIGINS[0];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      // client_reference_id + metadata : le webhook retrouve le compte Clerk à activer.
      client_reference_id: sub,
      metadata: { clerkUserId: sub },
      // Propage l'ID Clerk sur l'abonnement → les events de résiliation le portent aussi.
      subscription_data: { metadata: { clerkUserId: sub } },
      customer_email: await getEmail(sub),
      allow_promotion_codes: true,
      success_url: `${appUrl}/?upgrade=success`,
      cancel_url: `${appUrl}/?upgrade=cancel`,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error("Stripe checkout error:", e);
    return res.status(500).json({ error: "Erreur Stripe" });
  }
}
