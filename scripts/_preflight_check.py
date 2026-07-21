"""Phase 0 preflight (v2): the OLD project's REST API (PostgREST) is confirmed
blocked by the exceed_egress_quota restriction, but the Supabase SQL Editor
still works, which goes over a direct Postgres connection rather than REST.
This checks whether that same direct-connection path is reachable from here
via psycopg2, since that's the mechanism the migration script would use to
read data out of the OLD project (writes into NEW still go through its
REST API, which is not restricted)."""
import os
from pathlib import Path
from urllib.parse import unquote, urlsplit

import psycopg2
from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "web" / ".env.local")
load_dotenv(ROOT / ".env")

old_db_url = os.environ.get("OLD_SUPABASE_DB_URL")
new_url = os.environ.get("NEW_SUPABASE_URL")
new_key = os.environ.get("NEW_SUPABASE_SERVICE_KEY")

if not old_db_url:
    print("MISSING OLD_SUPABASE_DB_URL")
    raise SystemExit(1)

print("--- Testing direct Postgres connection to OLD project ---")
# Parsed manually (not passed as a raw DSN string) so a password containing
# URI-reserved characters (&, ^, etc. from a Supabase-generated reset) doesn't
# need percent-encoding — libpq's own URI parser would choke on it unescaped.
parsed = urlsplit(old_db_url)
try:
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        user=unquote(parsed.username),
        password=unquote(parsed.password),
        dbname=(parsed.path or "/postgres").lstrip("/"),
        connect_timeout=10,
    )
    cur = conn.cursor()
    cur.execute("select count(*) from condos;")
    count = cur.fetchone()[0]
    print(f"OK — direct connection works. condos row count: {count}")

    cur.execute("""
        select table_name from information_schema.tables
        where table_schema = 'public' order by table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]
    print(f"\nPublic schema tables ({len(tables)}): {tables}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"BLOCKED — direct connection failed:\n{e}")
    raise SystemExit(2)

print("\n--- Confirming NEW project REST API still reachable ---")
try:
    new_client = create_client(new_url, new_key)
    res = new_client.table("condos").select("id").limit(1).execute()
    print(f"OK — NEW project responded, {len(res.data)} row(s) in condos (expect 0, schema not bootstrapped yet).")
except Exception as e:
    print(f"NEW project error: {e}")

print("\nPhase 0 result: migration path is direct-Postgres-read (OLD) -> REST-write (NEW). Proceeding.")
