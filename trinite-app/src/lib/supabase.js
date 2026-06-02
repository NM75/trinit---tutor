// Client Supabase authentifié par Clerk (third-party auth natif).
// On passe le token de session Clerk via l'option `accessToken` : Supabase
// l'accepte comme JWT et les policies RLS filtrent sur auth.jwt()->>'sub'.
// La clé anon est publique par design — c'est la RLS qui protège les données.
import { createClient } from "@supabase/supabase-js";
import { useSession } from "@clerk/clerk-react";
import { useMemo } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Config Supabase manquante (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
}

// Hook : renvoie un client mémoïsé lié à la session Clerk courante.
export function useSupabase() {
  const { session } = useSession();
  return useMemo(
    () =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        accessToken: async () => (session ? await session.getToken() : null),
      }),
    [session]
  );
}
