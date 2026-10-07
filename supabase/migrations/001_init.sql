-- Run once in a fresh Supabase project's SQL editor.
-- auth.users and storage.* are managed by Supabase; do not recreate them.
begin;

create table public.artisans (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null,
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,15}$'),
  logo_url text,
  location text,
  created_at timestamptz default now()
);

create sequence public.product_sku_seq;
create function public.next_product_sku() returns text
language sql volatile set search_path = '' as $$
  select 'SR-' || lpad(value, greatest(3, length(value)), '0')
  from (select nextval('public.product_sku_seq')::text as value) seq
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null,
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  name text not null,
  description text,
  category text,
  sku text default public.next_product_sku(),
  photo_urls text[] default '{}',
  model_url text,
  parts jsonb not null default '[]',
  finishes jsonb not null default '[]',
  base_price integer not null check (base_price > 0),
  currency text not null default 'NGN',
  dimensions text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  view_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index products_artisan_id_idx on public.products (artisan_id);
-- UNIQUE(public_id) already creates the required public_id index.

create function public.protect_product_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id
     or new.public_id is distinct from old.public_id
     or new.artisan_id is distinct from old.artisan_id
     or new.sku is distinct from old.sku then
    raise exception 'Product identity cannot be changed' using errcode = '22023';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger products_identity_and_timestamp
before update on public.products
for each row execute function public.protect_product_identity();

alter table public.artisans enable row level security;
alter table public.products enable row level security;

create policy artisans_select_own on public.artisans
for select to authenticated using ((select auth.uid()) = id);
create policy artisans_insert_own on public.artisans
for insert to authenticated with check ((select auth.uid()) = id);
create policy artisans_update_own on public.artisans
for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy products_owner_access on public.products
for all to authenticated
using ((select auth.uid()) = artisan_id)
with check ((select auth.uid()) = artisan_id);
create policy products_published_read on public.products
for select to anon, authenticated using (status = 'published');

revoke all on public.artisans, public.products from anon, authenticated;
grant select, insert, update on public.artisans to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select on public.products to anon;
grant all on public.artisans, public.products to service_role;
grant usage on sequence public.product_sku_seq to authenticated, service_role;
revoke all on function public.next_product_sku() from public;
grant execute on function public.next_product_sku() to authenticated, service_role;
-- No signup trigger: onboarding creates the artisan only after WhatsApp is valid.
-- No database publish-completeness guard: the approved API validates publishing.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-photos', 'product-photos', true, 3145728, array['image/jpeg','image/png','image/webp']),
  ('models', 'models', true, 2097152, array['model/gltf-binary','application/octet-stream']),
  ('textures', 'textures', true, 1048576, array['image/jpeg','image/png','image/webp']),
  ('logos', 'logos', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Supabase already enables RLS on storage.objects.
create policy showroom_assets_public_read on storage.objects
for select to anon, authenticated
using (bucket_id in ('product-photos','models','textures','logos'));

create policy showroom_assets_insert_own on storage.objects
for insert to authenticated with check (
  bucket_id in ('product-photos','models','textures','logos')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy showroom_assets_update_own on storage.objects
for update to authenticated using (
  bucket_id in ('product-photos','models','textures','logos')
  and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id in ('product-photos','models','textures','logos')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy showroom_assets_delete_own on storage.objects
for delete to authenticated using (
  bucket_id in ('product-photos','models','textures','logos')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
