-- 020: the outreach work queue.
--
-- Backlinks are the half of the ranking problem no amount of page-building
-- fixes, and the only safe way to earn them is a person answering a real
-- question with a real number. So: a daily scout (scripts/outreach_scout.py)
-- finds questions our data answers and drafts the reply; a human edits it,
-- posts it from their own account, and pastes the resulting URL back through
-- /admin/outreach. Nothing posts automatically — automated forum posting gets
-- the account banned and the domain treated as a link scheme, which is the
-- opposite of the goal.
--
-- Run in the Supabase SQL Editor.

create table if not exists outreach_tasks (
    id              uuid primary key default gen_random_uuid(),

    -- 'community' = a forum/Reddit question; 'press' = a journalist or
    -- newsletter pitch for a data asset.
    kind            text not null default 'community',
    source          text not null,            -- 'reddit:r/Thailand', 'aseannow:453'
    source_url      text not null unique,     -- the thread we are answering
    source_title    text,
    source_excerpt  text,
    posted_at       timestamptz,              -- when the thread itself was posted

    -- What the human is asked to send.
    draft_body      text not null,
    facts           jsonb,                    -- the numbers the draft is allowed to use
    topic           text,                     -- yield | flood | quota | price | other

    -- What happened.
    status          text not null default 'new',   -- new | posted | skipped
    result_url      text,                     -- the comment/post the human left
    skip_reason     text,
    handled_at      timestamptz,

    -- Weekly link check (scripts/outreach_scout.py --verify).
    link_checked_at timestamptz,
    link_alive      boolean,

    created_at      timestamptz not null default now()
);

create index if not exists outreach_tasks_status_idx on outreach_tasks (status, created_at desc);
create index if not exists outreach_tasks_source_idx on outreach_tasks (source, created_at desc);

comment on table outreach_tasks is
    'Draft-and-review queue for earned links. The scout writes rows; a human works them in /admin/outreach. Never auto-posted.';
