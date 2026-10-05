-- =====================================================================
-- Pusat Solusi IT — skema database Supabase
-- Jalankan sekali di Supabase: SQL Editor > New query > tempel > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tabel admin (siapa yang boleh menulis) ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Tidak ada policy: tabel ini tidak bisa dibaca/ditulis dari browser.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Tabel postingan ----------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  code        bigint generated always as identity unique,   -- nomor KB-0001
  title       text not null check (char_length(title) between 3 and 200),
  kind        text not null default 'solusi' check (kind in ('solusi','software','panduan')),
  category    text not null default 'Umum',
  tags        text[] not null default '{}',
  summary     text,
  content     text,
  links       jsonb not null default '[]'::jsonb,           -- [{ "label": "...", "url": "https://..." }]
  views       integer not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists posts_views_idx   on public.posts (views desc);

-- Perintah / kode siap salin: [{ "label": "...", "code": "..." }]
alter table public.posts add column if not exists snippets jsonb not null default '[]'::jsonb;
create index if not exists posts_created_idx on public.posts (created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
for each row execute function public.touch_updated_at();

-- ---------- Keamanan baris (RLS) ----------
alter table public.posts enable row level security;

drop policy if exists "baca postingan terbit" on public.posts;
create policy "baca postingan terbit" on public.posts
  for select using (published or public.is_admin());

drop policy if exists "admin tambah" on public.posts;
create policy "admin tambah" on public.posts
  for insert with check (public.is_admin());

drop policy if exists "admin ubah" on public.posts;
create policy "admin ubah" on public.posts
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin hapus" on public.posts;
create policy "admin hapus" on public.posts
  for delete using (public.is_admin());

-- ---------- Hitung tayangan (boleh dipanggil tanpa login) ----------
create or replace function public.increment_view(p_id uuid)
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  update public.posts
     set views = views + 1
   where id = p_id and published
  returning views;
$$;
grant execute on function public.increment_view(uuid) to anon, authenticated;

-- ---------- Pencarian ----------
-- Semua kata harus ditemukan (di judul, ringkasan, tag, isi, atau link).
-- Urutan "relevan": cocok di judul > cocok di tag > tayangan.
create or replace function public.search_posts(
  q          text default '',
  p_kind     text default null,
  p_category text default null,
  p_sort     text default 'relevan',
  p_limit    integer default 40
)
returns table (
  id uuid, code bigint, title text, kind text, category text, tags text[],
  summary text, links jsonb, views integer, created_at timestamptz, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with terms as (
    select t
    from unnest(regexp_split_to_array(lower(trim(coalesce(q, ''))), '\s+')) as t
    where t <> ''
  ),
  base as (
    select p.*,
           lower(p.title) as l_title,
           lower(array_to_string(p.tags, ' ') || ' ' || p.category) as l_tags,
           lower(p.title || ' ' || coalesce(p.summary, '') || ' ' ||
                 array_to_string(p.tags, ' ') || ' ' || p.category || ' ' ||
                 coalesce(p.content, '') || ' ' || p.links::text || ' ' || p.snippets::text ||
                 ' kb-' || lpad(p.code::text, 4, '0')) as l_all
    from public.posts p
    where (p_kind is null or p.kind = p_kind)
      and (p_category is null or p.category = p_category)
  )
  select b.id, b.code, b.title, b.kind, b.category, b.tags, b.summary, b.links,
         b.views, b.created_at, b.updated_at
  from base b
  where not exists (select 1 from terms where position(terms.t in b.l_all) = 0)
  order by
    case when p_sort = 'populer' then b.views end desc nulls last,
    case when p_sort = 'terbaru' then b.created_at end desc nulls last,
    (select count(*) from terms where position(terms.t in b.l_title) > 0) * 3
      + (select count(*) from terms where position(terms.t in b.l_tags) > 0) * 2 desc,
    b.views desc,
    b.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;
grant execute on function public.search_posts(text, text, text, text, integer) to anon, authenticated;

-- Daftar kategori yang terpakai (untuk filter di halaman depan)
create or replace function public.list_categories()
returns table (category text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select category, count(*) from public.posts group by category order by category;
$$;
grant execute on function public.list_categories() to anon, authenticated;
