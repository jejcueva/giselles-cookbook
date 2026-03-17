create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  has_seen_birthday boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  ingredients jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  notes text,
  source_url text,
  cook_time integer,
  prep_time integer,
  servings integer,
  calories integer,
  protein numeric(6,2),
  carbs numeric(6,2),
  fat numeric(6,2),
  is_favorite boolean not null default false,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_categories (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (recipe_id, category_id)
);

create table if not exists public.recipe_tags (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  tag text not null
);

create table if not exists public.recipe_photos (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0
);

create index if not exists idx_recipe_tags_recipe_id on public.recipe_tags(recipe_id);
create index if not exists idx_recipe_tags_tag on public.recipe_tags(tag);
create index if not exists idx_recipe_photos_recipe_id on public.recipe_photos(recipe_id);
create index if not exists idx_recipes_is_favorite on public.recipes(is_favorite);
create index if not exists idx_recipes_created_at on public.recipes(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_recipes_set_updated_at on public.recipes;
create trigger trg_recipes_set_updated_at
before update on public.recipes
for each row
execute function public.set_updated_at();

insert into public.categories (name, emoji)
values ('Desserts', null)
on conflict (name) do nothing;
