-- Trinité — Phase 3 : schéma de persistance Supabase
-- Archi : front → Supabase direct, auth Clerk (third-party natif).
-- Isolation par RLS sur l'ID Clerk : auth.jwt()->>'sub'.
-- À exécuter dans Supabase → SQL Editor. Idempotent (réexécutable sans casse).

-- ───────────────────────────── Tables ─────────────────────────────

-- 1. Enfants (rattachés au compte parent Clerk)
create table if not exists public.children (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null default (auth.jwt()->>'sub'),  -- ID Clerk du parent
  name       text not null,
  age        smallint not null,
  created_at timestamptz not null default now()
);

-- 2. Historique des leçons / quiz terminés
create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default (auth.jwt()->>'sub'),
  child_id    uuid not null references public.children(id) on delete cascade,
  theme_id    text not null,           -- clé stable de themes.js (ex. "animals")
  theme_label text not null,           -- libellé lisible (ex. "Les animaux")
  score       smallint not null,
  total       smallint not null,
  created_at  timestamptz not null default now()
);

-- 3. Thèmes vus / favoris (1 ligne par enfant × thème)
create table if not exists public.child_themes (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null default (auth.jwt()->>'sub'),
  child_id   uuid not null references public.children(id) on delete cascade,
  theme_id   text not null,
  seen_count int not null default 1,
  favorite   boolean not null default false,
  last_seen  timestamptz not null default now(),
  unique (child_id, theme_id)
);

-- 4. Compteur de démarrages de leçon (quota hebdo : 3 gratuit / 15 Premium).
-- Distinct de `lessons` (leçons TERMINÉES, modifiables par le client) : ce compteur
-- doit être infalsifiable → écrit UNIQUEMENT par le serveur (service role, bypass RLS),
-- le client n'a que SELECT. week_key = lundi (Europe/Paris) pré-calculé côté serveur :
-- comptage trivial, sans calcul de fuseau/DST dans la requête.
create table if not exists public.lesson_starts (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,              -- sub Clerk (écrit côté serveur)
  week_key   text not null,              -- "YYYY-MM-DD" du lundi en Europe/Paris
  started_at timestamptz not null default now()
);

-- ───────────────────────────── Index ──────────────────────────────

create index if not exists lessons_child_id_idx      on public.lessons (child_id);
create index if not exists lessons_user_created_idx   on public.lessons (user_id, created_at desc);
create index if not exists child_themes_child_id_idx  on public.child_themes (child_id);
create index if not exists children_user_id_idx       on public.children (user_id);
create index if not exists lesson_starts_user_week_idx on public.lesson_starts (user_id, week_key);

-- ───────────────────────────── RLS ────────────────────────────────
-- Chaque ligne n'est lisible/modifiable que par son propriétaire (sub Clerk).
-- user_id est rempli par défaut côté serveur ET verrouillé par with check
-- → impossible d'écrire pour un autre compte même en trafiquant le client.

alter table public.children      enable row level security;
alter table public.lessons       enable row level security;
alter table public.child_themes  enable row level security;
alter table public.lesson_starts enable row level security;

drop policy if exists "own rows" on public.children;
create policy "own rows" on public.children
  for all
  to authenticated
  using      (user_id = auth.jwt()->>'sub')
  with check (user_id = auth.jwt()->>'sub');

drop policy if exists "own rows" on public.lessons;
create policy "own rows" on public.lessons
  for all
  to authenticated
  using      (user_id = auth.jwt()->>'sub')
  with check (user_id = auth.jwt()->>'sub');

drop policy if exists "own rows" on public.child_themes;
create policy "own rows" on public.child_themes
  for all
  to authenticated
  using      (user_id = auth.jwt()->>'sub')
  with check (user_id = auth.jwt()->>'sub');

-- lesson_starts : lecture seule pour le propriétaire (affichage du quota restant).
-- Aucune policy d'écriture ⇒ avec RLS activée, `authenticated` ne peut pas insérer/
-- modifier/supprimer. Seul le service role (bypass RLS) écrit le compteur.
drop policy if exists "read own" on public.lesson_starts;
create policy "read own" on public.lesson_starts
  for select
  to authenticated
  using (user_id = auth.jwt()->>'sub');

-- ──────────────────────────── Grants ──────────────────────────────
-- Seuls les utilisateurs connectés (role authenticated via Clerk) accèdent
-- aux tables ; anon n'a aucun droit. La RLS gate ensuite ligne par ligne.

grant select, insert, update, delete on public.children     to authenticated;
grant select, insert, update, delete on public.lessons      to authenticated;
grant select, insert, update, delete on public.child_themes to authenticated;
-- lesson_starts : lecture seule pour authenticated ; l'écriture passe par le service role.
grant select on public.lesson_starts to authenticated;
