// Accès données Supabase pour Trinité. Toutes les fonctions prennent le client
// `sb` (issu de useSupabase) en 1er argument. user_id est rempli côté serveur
// par défaut (auth.jwt()->>'sub') et verrouillé par RLS — jamais envoyé d'ici.

// ───────────────────────────── Enfants ─────────────────────────────

export async function listChildren(sb) {
  const { data, error } = await sb
    .from("children")
    .select("id, name, age")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addChild(sb, { name, age }) {
  const { data, error } = await sb
    .from("children")
    .insert({ name: name.trim(), age: Number(age) })
    .select("id, name, age")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChild(sb, id) {
  const { error } = await sb.from("children").delete().eq("id", id);
  if (error) throw error;
}

// Réconcilie la liste désirée (issue de l'écran Setup) avec la base :
// - enfant avec id → update (name/age) ; sans id → insert ;
// - id présent en base mais absent de `desired` → delete (cascade leçons/thèmes).
// Préserve l'historique des enfants conservés (pas de delete/reinsert global).
export async function reconcileChildren(sb, desired, existing) {
  const keptIds = new Set(desired.filter((c) => c.id).map((c) => c.id));

  for (const e of existing) {
    if (!keptIds.has(e.id)) await deleteChild(sb, e.id);
  }
  for (const c of desired) {
    if (c.id) {
      const { error } = await sb
        .from("children")
        .update({ name: c.name.trim(), age: Number(c.age) })
        .eq("id", c.id);
      if (error) throw error;
    } else {
      await addChild(sb, c);
    }
  }
  return listChildren(sb);
}

// ──────────────────────── Leçons & progression ─────────────────────

export async function recordLesson(sb, { childId, theme, score, total }) {
  const { error } = await sb.from("lessons").insert({
    child_id: childId,
    theme_id: theme.id,
    theme_label: theme.label,
    score,
    total,
  });
  if (error) throw error;
}

// Marque un thème comme vu pour un enfant (incrémente seen_count).
// Pas d'incrément atomique côté SQL (appli familiale, faible concurrence) :
// read-modify-write suffit, avec insert au 1er passage.
export async function markThemeSeen(sb, { childId, themeId }) {
  const { data, error } = await sb
    .from("child_themes")
    .select("id, seen_count")
    .eq("child_id", childId)
    .eq("theme_id", themeId)
    .maybeSingle();
  if (error) throw error;

  if (data) {
    const { error: upErr } = await sb
      .from("child_themes")
      .update({ seen_count: data.seen_count + 1, last_seen: new Date().toISOString() })
      .eq("id", data.id);
    if (upErr) throw upErr;
  } else {
    const { error: insErr } = await sb
      .from("child_themes")
      .insert({ child_id: childId, theme_id: themeId });
    if (insErr) throw insErr;
  }
}

// Progression d'un enfant : meilleur ratio score/total par thème + thèmes vus.
// Renvoie { best: { theme_id: ratio 0..1 }, seen: Set(theme_id) }.
export async function getChildProgress(sb, childId) {
  const [themesRes, lessonsRes] = await Promise.all([
    sb.from("child_themes").select("theme_id").eq("child_id", childId),
    sb.from("lessons").select("theme_id, score, total").eq("child_id", childId),
  ]);
  if (themesRes.error) throw themesRes.error;
  if (lessonsRes.error) throw lessonsRes.error;

  const best = {};
  for (const l of lessonsRes.data ?? []) {
    const ratio = l.total ? l.score / l.total : 0;
    if (!(l.theme_id in best) || ratio > best[l.theme_id]) best[l.theme_id] = ratio;
  }
  const seen = new Set((themesRes.data ?? []).map((t) => t.theme_id));
  return { best, seen };
}
