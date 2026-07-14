create table if not exists public.legal_norms (
  id text primary key,
  urn text unique,
  type text not null,
  number text,
  year integer not null,
  title text not null,
  popular_name text not null,
  ementa text not null,
  status text not null,
  publication_date date not null,
  official_source_url text not null,
  current_version_id text,
  last_verified_at timestamptz not null
);
create table if not exists public.legal_versions (
  id text primary key,
  norm_id text not null references public.legal_norms(id) on delete cascade,
  version_date date not null,
  source_hash text not null,
  source_url text not null,
  is_current boolean not null default false,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (id, norm_id)
);
create unique index if not exists legal_versions_one_current_per_norm_idx on public.legal_versions (norm_id) where is_current = true;
alter table public.legal_norms drop constraint if exists legal_norms_current_version_id_fkey;
alter table public.legal_norms drop constraint if exists legal_norms_current_version_same_norm_fkey;
alter table public.legal_norms add constraint legal_norms_current_version_same_norm_fkey foreign key (current_version_id, id) references public.legal_versions(id, norm_id);
create table if not exists public.legal_units (
  id text primary key,
  norm_id text not null references public.legal_norms(id) on delete cascade,
  version_id text not null,
  parent_id text,
  kind text not null check (kind in ('preambulo','parte','livro','titulo','capitulo','secao','subsecao','artigo','paragrafo','inciso','alinea','item','disposicao_transitoria')),
  label text not null,
  canonical_path text not null,
  heading text,
  text text not null default '',
  sort_order integer not null check (sort_order >= 0),
  status text not null,
  unique (norm_id, version_id, canonical_path),
  unique (id, norm_id, version_id),
  foreign key (version_id, norm_id) references public.legal_versions(id, norm_id) on delete cascade,
  foreign key (parent_id, norm_id, version_id) references public.legal_units(id, norm_id, version_id)
);
create index if not exists legal_units_norm_version_sort_order_idx on public.legal_units (norm_id, version_id, sort_order);
create index if not exists legal_units_parent_id_idx on public.legal_units (parent_id);
create table if not exists public.legal_collections (
  id text primary key,
  slug text unique not null,
  title text not null,
  sort_order integer not null
);
create table if not exists public.legal_collection_items (
  collection_id text not null references public.legal_collections(id) on delete cascade,
  norm_id text not null references public.legal_norms(id) on delete cascade,
  sort_order integer not null,
  primary key (collection_id, norm_id)
);
create table if not exists public.codice_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  target_key text not null,
  norm_id text not null,
  canonical_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, target_key)
);
alter table public.legal_norms enable row level security;
alter table public.legal_versions enable row level security;
alter table public.legal_units enable row level security;
alter table public.legal_collections enable row level security;
alter table public.legal_collection_items enable row level security;
alter table public.codice_favorites enable row level security;
drop policy if exists "legal_norms_public_select" on public.legal_norms;
create policy "legal_norms_public_select" on public.legal_norms for select using (true);
drop policy if exists "legal_versions_public_select" on public.legal_versions;
create policy "legal_versions_public_select" on public.legal_versions for select using (true);
drop policy if exists "legal_units_public_select" on public.legal_units;
create policy "legal_units_public_select" on public.legal_units for select using (true);
drop policy if exists "legal_collections_public_select" on public.legal_collections;
create policy "legal_collections_public_select" on public.legal_collections for select using (true);
drop policy if exists "legal_collection_items_public_select" on public.legal_collection_items;
create policy "legal_collection_items_public_select" on public.legal_collection_items for select using (true);
drop policy if exists "codice_favorites_owner_select" on public.codice_favorites;
create policy "codice_favorites_owner_select" on public.codice_favorites for select using (user_id = auth.uid());
drop policy if exists "codice_favorites_owner_insert" on public.codice_favorites;
create policy "codice_favorites_owner_insert" on public.codice_favorites for insert with check (user_id = auth.uid());
drop policy if exists "codice_favorites_owner_update" on public.codice_favorites;
create policy "codice_favorites_owner_update" on public.codice_favorites for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "codice_favorites_owner_delete" on public.codice_favorites;
create policy "codice_favorites_owner_delete" on public.codice_favorites for delete using (user_id = auth.uid());
insert into public.legal_collections (id, slug, title, sort_order) values
  ('essential','essencial','Essencial',10),
  ('constitutional','constitucional','Constitucional',20),
  ('civil-procedure','processo-civil','Processo Civil',30)
on conflict (id) do update set slug=excluded.slug, title=excluded.title, sort_order=excluded.sort_order;
