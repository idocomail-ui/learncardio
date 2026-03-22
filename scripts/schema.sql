-- LearnCardio Database Schema
-- Run this in Supabase SQL Editor before running the pipeline scripts

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- GUIDELINES
-- ─────────────────────────────────────────────
create table if not exists guidelines (
  id        uuid primary key default uuid_generate_v4(),
  slug      text unique not null,
  name      text not null,
  year      int,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- FIGURES
-- ─────────────────────────────────────────────
create table if not exists figures (
  id                  uuid primary key default uuid_generate_v4(),
  guideline_id        uuid not null references guidelines(id) on delete cascade,
  figure_number       int not null,
  image_url           text not null,
  caption_original    text,
  caption_explanation text,
  page_number         int,
  created_at          timestamptz default now(),
  unique (guideline_id, figure_number)
);

-- ─────────────────────────────────────────────
-- RECOMMENDATIONS
-- ─────────────────────────────────────────────
create table if not exists recommendations (
  id                    uuid primary key default uuid_generate_v4(),
  guideline_id          uuid not null references guidelines(id) on delete cascade,
  recommendation_number int not null,
  class                 text not null check (class in ('I', 'IIa', 'IIb', 'III')),
  loe                   text not null check (loe in ('A', 'B', 'C')),
  original_text         text not null,
  rephrased_text        text,
  explanation           text,
  mini_vignette         text,
  page_number           int,
  created_at            timestamptz default now(),
  unique (guideline_id, recommendation_number)
);

-- ─────────────────────────────────────────────
-- QUESTIONS
-- ─────────────────────────────────────────────
create table if not exists questions (
  id                uuid primary key default uuid_generate_v4(),
  external_id       text unique not null,
  guideline_id      uuid not null references guidelines(id) on delete cascade,
  recommendation_id uuid references recommendations(id) on delete set null,
  figure_id         uuid references figures(id) on delete set null,
  type              text not null check (type in (
    'vignette', 'rec_class', 'rec_loe', 'rec_completion', 'rec_identify',
    'fig_identify', 'fig_step', 'fig_label'
  )),
  difficulty        text not null check (difficulty in ('easy', 'intermediate', 'hard')),
  stem              text not null,
  options           jsonb not null,  -- {A, B, C, D}
  correct_option    text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation       text not null,
  created_at        timestamptz default now()
);

-- ─────────────────────────────────────────────
-- USER PROGRESS
-- ─────────────────────────────────────────────
create table if not exists user_progress (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  item_type       text not null check (item_type in ('figure', 'recommendation', 'question')),
  item_id         uuid not null,
  -- SM-2 spaced repetition fields
  status          text not null default 'unseen' check (status in ('unseen', 'known', 'needs_review')),
  correct_count   int not null default 0,
  incorrect_count int not null default 0,
  ease_factor     float not null default 2.5,
  interval_days   int not null default 0,
  repetitions     int not null default 0,
  next_review_at  timestamptz default now(),
  last_seen_at    timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (user_id, item_type, item_id)
);

-- ─────────────────────────────────────────────
-- STUDY SESSIONS
-- ─────────────────────────────────────────────
create table if not exists sessions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  mode                text not null check (mode in (
    'browse_figures', 'browse_recommendations', 'mcq_vignette',
    'mcq_recommendations', 'mcq_figures'
  )),
  guideline_ids       uuid[] not null default '{}',
  difficulty          text check (difficulty in ('easy', 'intermediate', 'hard', 'mixed')),
  questions_answered  int not null default 0,
  correct_count       int not null default 0,
  started_at          timestamptz default now(),
  ended_at            timestamptz
);

-- ─────────────────────────────────────────────
-- BOOKMARKS
-- ─────────────────────────────────────────────
create table if not exists bookmarks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_type   text not null check (item_type in ('figure', 'recommendation', 'question')),
  item_id     uuid not null,
  notes       text,
  created_at  timestamptz default now(),
  unique (user_id, item_type, item_id)
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

-- Public read on content tables
alter table guidelines enable row level security;
alter table figures enable row level security;
alter table recommendations enable row level security;
alter table questions enable row level security;

create policy "Public read guidelines"        on guidelines        for select using (true);
create policy "Public read figures"           on figures           for select using (true);
create policy "Public read recommendations"  on recommendations   for select using (true);
create policy "Public read questions"         on questions         for select using (true);

-- User-scoped access on progress, sessions, bookmarks
alter table user_progress enable row level security;
alter table sessions       enable row level security;
alter table bookmarks      enable row level security;

create policy "Users manage own progress"   on user_progress for all using (auth.uid() = user_id);
create policy "Users manage own sessions"   on sessions       for all using (auth.uid() = user_id);
create policy "Users manage own bookmarks"  on bookmarks      for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- STORAGE BUCKET FOR FIGURES
-- ─────────────────────────────────────────────
-- Run this separately in Supabase Storage settings or SQL:
insert into storage.buckets (id, name, public)
values ('figures', 'figures', true)
on conflict (id) do nothing;

create policy "Public read figures bucket"
on storage.objects for select
using (bucket_id = 'figures');

create policy "Service role can upload figures"
on storage.objects for insert
with check (bucket_id = 'figures');
