import Stripe from "stripe";
import { createClerkClient } from "@clerk/backend";

// Webhook Stripe : source de vérité du tier d'abonnement.
// Stripe appelle cette route (serveur→serveur, pas de CORS) à chaque event ;
// on vérifie la signature avec le secret de l'endpoint, puis on synchronise
// publicMetadata.plan côté Clerk (lu par api/chat.js pour le quota hebdo).

// Vercel ne doit PAS parser le body : la vérification de signature exige le corps
// brut exact (octet pour octet) tel qu'envoyé par Stripe.
export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Lit le corps brut depuis le stream (bodyParser désactivé).
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Met à jour le plan sans écraser les autres clés de metadata.
// Le tier public (lu par le quota) va dans publicMetadata ; les identifiants
// Stripe (pour un futur portail de gestion) restent en privateMetadata.
async function setPlan(clerk, userId, plan, stripeIds = {}) {
  const user = await clerk.users.getUser(userId);
  await clerk.users.updateUser(userId, {
    publicMetadata: { ...user.publicMetadata, plan },
    privateMetadata: { ...user.privateMetadata, ...stripeIds },
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const sig = req.headers["stripe-signature"];
  let event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error("Webhook signature error:", e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  try {
    switch (event.type) {
      // Paiement initial validé → activation Premium.
      case "checkout.session.completed": {
        const s = event.data.object;
        const userId = s.metadata?.clerkUserId || s.client_reference_id;
        if (userId) {
          await setPlan(clerk, userId, "premium", {
            stripeCustomerId: s.customer,
            stripeSubscriptionId: s.subscription,
          });
        }
        break;
      }
      // Changement d'état de l'abonnement (renouvellement, pause, annulation programmée…).
      // On resynchronise : actif/essai → premium, sinon → free.
      case "customer.subscription.updated": {
        const subObj = event.data.object;
        const userId = subObj.metadata?.clerkUserId;
        if (userId) {
          const active = subObj.status === "active" || subObj.status === "trialing";
          await setPlan(clerk, userId, active ? "premium" : "free");
        }
        break;
      }
      // Abonnement réellement terminé → retour au gratuit.
      case "customer.subscription.deleted": {
        const subObj = event.data.object;
        const userId = subObj.metadata?.clerkUserId;
        if (userId) await setPlan(clerk, userId, "free");
        break;
      }
      default:
        break; // events non gérés : on acquitte quand même (évite les retries Stripe).
    }
  } catch (e) {
    console.error("Webhook handler error:", e);
    // 500 → Stripe réessaiera l'event (idempotent : setPlan est sûr à rejouer).
    return res.status(500).json({ error: "Handler error" });
  }

  return res.status(200).json({ received: true });
}
