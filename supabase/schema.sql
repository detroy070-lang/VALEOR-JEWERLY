-- =====================================================================
-- VALÉOR / AUREON · Base de datos real (Supabase)
-- Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin dañar nada.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Joyerías ----------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  whatsapp text,
  gold_price_18k integer,
  gold_price_updated_at timestamptz,
  settings jsonb not null default '{}'::jsonb,   -- dirección, horario, instagram, pagos, PANELES (settings.categories)
  owner_id uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Joyas ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  ref text not null,
  name text not null,
  category text not null,                          -- nombre del panel (Collares, Anillos, Topitos…)
  gender text not null default 'unisex',           -- mujer | hombre | unisex
  material text,
  weight_g numeric(8,2),
  size text,
  stone text,
  description text,
  price_mode text not null default 'fijo',         -- fijo | gramo | consultar
  price bigint,
  labor bigint not null default 0,
  discount_pct integer not null default 0,
  availability text not null default 'disponible', -- disponible | bajo_pedido | agotado
  status text not null default 'publicado',        -- publicado | oculto | borrador
  featured boolean not null default false,
  images jsonb not null default '[]'::jsonb,
  bundle jsonb not null default '[]'::jsonb,       -- paquetes: ids de las joyas que incluye
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_ref_unique unique (store_id, ref),
  constraint products_name_check check (char_length(name) between 2 and 80),
  constraint products_gender_check check (gender in ('mujer','hombre','unisex')),
  constraint products_mode_check check (price_mode in ('fijo','gramo','consultar')),
  constraint products_avail_check check (availability in ('disponible','bajo_pedido','agotado')),
  constraint products_status_check check (status in ('publicado','oculto','borrador')),
  constraint products_discount_check check (discount_pct between 0 and 90),
  constraint products_price_ok check (
    (price_mode <> 'fijo' or price is not null) and (price_mode <> 'gramo' or weight_g is not null)
  )
);
-- Si la tabla ya existía de antes, se le agrega la columna de género:
alter table public.products add column if not exists gender text not null default 'unisex';
alter table public.products add column if not exists bundle jsonb not null default '[]'::jsonb;
create index if not exists products_store_idx on public.products (store_id, status);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

-- ---------- Visitas / clics (estadísticas) y ventas ----------
create table if not exists public.events (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  type text not null check (type in ('visita','vista_pieza','whatsapp')),
  created_at timestamptz not null default now()
);
create index if not exists events_store_idx on public.events (store_id, type, created_at);

create table if not exists public.sales (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  amount bigint not null,
  created_at timestamptz not null default now()
);

-- ---------- Seguridad: cada dueño solo toca SU joyería ----------
create or replace function public.is_owner(p_store uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stores s where s.id = p_store and s.owner_id = auth.uid());
$$;

alter table public.stores   enable row level security;
alter table public.products enable row level security;
alter table public.events   enable row level security;
alter table public.sales    enable row level security;

drop policy if exists stores_read   on public.stores;
drop policy if exists stores_update on public.stores;
create policy stores_read   on public.stores for select using (active or owner_id = auth.uid());
create policy stores_update on public.stores for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists products_public on public.products;
drop policy if exists products_owner  on public.products;
create policy products_public on public.products for select
  using (status = 'publicado' and exists (select 1 from public.stores s where s.id = store_id and s.active));
create policy products_owner on public.products for all
  using (public.is_owner(store_id)) with check (public.is_owner(store_id));

drop policy if exists events_insert on public.events;
drop policy if exists events_owner  on public.events;
create policy events_insert on public.events for insert
  with check (exists (select 1 from public.stores s where s.id = store_id and s.active));
create policy events_owner on public.events for select using (public.is_owner(store_id));

drop policy if exists sales_owner on public.sales;
create policy sales_owner on public.sales for all using (public.is_owner(store_id)) with check (public.is_owner(store_id));

-- ---------- Subir/bajar precios fijos en bloque ----------
create or replace function public.adjust_fixed_prices(p_store uuid, p_pct numeric) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_owner(p_store) then raise exception 'no autorizado'; end if;
  if p_pct is null or p_pct < -50 or p_pct > 100 then raise exception 'El porcentaje debe estar entre -50%% y 100%%'; end if;
  update public.products
     set price = greatest(1000, round(price * (1 + p_pct / 100.0) / 1000) * 1000)
   where store_id = p_store and price_mode = 'fijo' and price is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- Fotos (Storage) ----------
insert into storage.buckets (id, name, public) values ('joyas', 'joyas', true)
on conflict (id) do update set public = true;

drop policy if exists joyas_read   on storage.objects;
drop policy if exists joyas_write  on storage.objects;
drop policy if exists joyas_delete on storage.objects;
create policy joyas_read on storage.objects for select using (bucket_id = 'joyas');
create policy joyas_write on storage.objects for insert to authenticated
  with check (bucket_id = 'joyas' and public.is_owner(((storage.foldername(name))[1])::uuid));
create policy joyas_delete on storage.objects for delete to authenticated
  using (bucket_id = 'joyas' and public.is_owner(((storage.foldername(name))[1])::uuid));

-- =====================================================================
-- DESPUÉS DE CORRER LO DE ARRIBA (una sola vez por joyería):
-- 1) Authentication → Users → Add user: correo y contraseña del dueño.
-- 2) Copia el "User UID" de ese usuario y pégalo abajo. Corre solo esto:
--
-- insert into public.stores (slug, name, whatsapp, gold_price_18k, settings, owner_id)
-- values ('valeor', 'Valeor', '573005466740', null,
--   '{"city":"Medellín","categories":[{"id":"Collares"},{"id":"Anillos"},{"id":"Topitos"},{"id":"Aretes"},{"id":"Manillas"}],"trust":["Oro 18K","Asesoría por WhatsApp"],"payments":{"plan_separe":true,"transferencia":true,"efectivo":true}}'::jsonb,
--   'PEGA-AQUI-EL-USER-UID');
--
-- 3) En js/config.js: backend:"supabase", supabaseUrl y supabaseAnonKey
--    (Project Settings → API). storeSlug debe ser 'valeor'.
-- =====================================================================
