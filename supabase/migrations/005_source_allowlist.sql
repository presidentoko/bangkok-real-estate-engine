-- Broaden condos.source / listings.source check constraints to cover all
-- currently-ingested portals. Idempotent: drop-if-exists, then re-add.
-- Apply via Supabase SQL editor.

-- condos
alter table condos drop constraint if exists condos_source_check;
alter table condos
    add constraint condos_source_check
    check (source in ('hipflat', 'ddproperty', 'dotproperty', 'fazwaz'));

-- listings (if it has a source check)
alter table listings drop constraint if exists listings_source_check;
alter table listings
    add constraint listings_source_check
    check (source in ('hipflat', 'ddproperty', 'dotproperty', 'fazwaz'));
