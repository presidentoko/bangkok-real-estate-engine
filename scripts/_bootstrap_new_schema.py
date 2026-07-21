"""Phase 1: bootstrap the fresh Supabase project's schema by replaying the
existing committed .sql files, in dependency order, directly via psycopg2 —
not hand-transcribed, so there's no risk of a manual copy error. This order
was derived by tracing every ALTER/CREATE OR REPLACE across db/*.sql and
supabase/migrations/*.sql (see the migration plan). Two things this order
gets right on purpose:
  - db/schema_phase4_leads.sql (which enables RLS + the anon insert policy
    on `leads`) runs BEFORE supabase/migrations/009_leads.sql (which only
    ALTERs an assumed-existing table and never touches RLS) — replaying
    009 first would silently leave a PII table world-readable.
  - supabase/migrations/002/003/004 are byte-identical to
    db/schema_yields_history.sql / schema_macro.sql / schema_reviews.sql
    and are skipped here to avoid running the same DDL twice.
"""
import os
from pathlib import Path
from urllib.parse import unquote, urlsplit

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "web" / ".env.local")
load_dotenv(ROOT / ".env")

FILES = [
    "db/schema.sql",
    "db/schema_phase2.sql",
    "db/schema_phase2_b.sql",
    "db/schema_phase3_provinces.sql",
    "db/schema_phase4_leads.sql",
    "db/schema_promotions.sql",
    "db/schema_yields_history.sql",
    "db/schema_macro.sql",
    "db/schema_reviews.sql",
    "db/schema_phase6_dom.sql",
    "db/schema_phase7_liquidity.sql",
    "db/schema_phase8_subsidence.sql",
    "db/schema_phase9_developer.sql",
    "db/schema_phase10_developers.sql",
    "db/014_condo_slug.sql",
    "db/schema_alerts.sql",
    "supabase/migrations/001_analysis_pipeline.sql",
    "supabase/migrations/005_source_allowlist.sql",
    "supabase/migrations/006_listing_extras.sql",
    "supabase/migrations/007_air_quality.sql",
    "supabase/migrations/008_reic_reports.sql",
    "supabase/migrations/009_leads.sql",
    "supabase/migrations/010_foreign_quota.sql",
    "supabase/migrations/011_leads_inquiry_type.sql",
    "supabase/migrations/012_leads_relax.sql",
    "supabase/migrations/013_retiree_score.sql",
    "db/016_condo_property_type.sql",
]

for f in FILES:
    if not (ROOT / f).exists():
        print(f"MISSING FILE: {f}")
        raise SystemExit(1)

new_db_url = os.environ["NEW_SUPABASE_DB_URL"]
p = urlsplit(new_db_url)
conn = psycopg2.connect(
    host=p.hostname, port=p.port or 5432,
    user=unquote(p.username), password=unquote(p.password),
    dbname=(p.path or "/postgres").lstrip("/"),
    connect_timeout=10,
)
conn.autocommit = False
cur = conn.cursor()

try:
    for f in FILES:
        sql = (ROOT / f).read_text(encoding="utf-8")
        print(f"Running {f} ...", end=" ")
        cur.execute(sql)
        print("OK")
    conn.commit()
    print("\nAll 26 files applied successfully, committed.")
except Exception as e:
    conn.rollback()
    print(f"\nFAILED — rolled back entire transaction (nothing partially applied).\n{e}")
    raise
finally:
    cur.close()
    conn.close()
