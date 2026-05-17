-- Google Reviews enrichment. Apply via Supabase SQL editor. Idempotent.

alter table condos
    add column if not exists google_place_id           text,
    add column if not exists google_rating             numeric(2, 1),
    add column if not exists google_review_count       integer,
    add column if not exists google_reviews_fetched_at timestamptz;

create index if not exists condos_google_rating_idx
    on condos (google_rating)
    where google_rating is not null;

create table if not exists condo_reviews (
    id              bigserial primary key,
    condo_id        uuid not null references condos(id) on delete cascade,
    source          text not null default 'google',
    source_review_id text,                    -- optional per-source review id
    rating          smallint,
    review_text     text,
    author          text,
    published_at    timestamptz,
    fetched_at      timestamptz not null default now()
);

create index if not exists condo_reviews_condo_idx
    on condo_reviews (condo_id, published_at desc);
