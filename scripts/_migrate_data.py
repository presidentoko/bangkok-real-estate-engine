"""Phase 2: copy every row from OLD (direct Postgres, since its REST API is
egress-restricted) to NEW (schema already bootstrapped, identical column
defs — see _bootstrap_new_schema.py), using COPY TO STDOUT / COPY FROM STDIN
for speed and to sidestep manual type coercion. Table order is derived from
actual FK constraints (topological sort), not hand-guessed, so nothing can
be missed or ordered wrong.
"""
import io
import os
from pathlib import Path
from urllib.parse import unquote, urlsplit

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "web" / ".env.local")
load_dotenv(ROOT / ".env")


def connect(url_env):
    p = urlsplit(os.environ[url_env])
    return psycopg2.connect(
        host=p.hostname, port=p.port or 5432,
        user=unquote(p.username), password=unquote(p.password),
        dbname=(p.path or "/postgres").lstrip("/"),
        connect_timeout=10,
    )


old_conn = connect("OLD_SUPABASE_DB_URL")
new_conn = connect("NEW_SUPABASE_DB_URL")
new_conn.autocommit = False
old_cur = old_conn.cursor()
new_cur = new_conn.cursor()

# All base tables (views excluded automatically by table_type filter).
old_cur.execute("""
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name;
""")
all_tables = [r[0] for r in old_cur.fetchall()]

# FK edges: child depends on parent, so parent must be loaded first.
old_cur.execute("""
    select tc.table_name as child, ccu.table_name as parent
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
        on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
      and tc.table_name != ccu.table_name;
""")
edges = old_cur.fetchall()

# Kahn's algorithm topological sort.
deps = {t: set() for t in all_tables}
for child, parent in edges:
    deps[child].add(parent)

ordered = []
remaining = set(all_tables)
while remaining:
    ready = sorted(t for t in remaining if deps[t] <= set(ordered))
    if not ready:
        raise SystemExit(f"Circular FK dependency detected among: {remaining}")
    ordered.extend(ready)
    remaining -= set(ready)

print(f"Copy order ({len(ordered)} tables): {ordered}\n")

summary = []
try:
    for table in ordered:
        # Explicit column list (from OLD's own ordinal order) so COPY matches
        # by name, not physical position — ordinal position can differ
        # between the two projects when a column was added out-of-band on
        # OLD (e.g. condos.property_type) vs replayed later on NEW.
        old_cur.execute("""
            select column_name from information_schema.columns
            where table_schema = 'public' and table_name = %s
              and is_generated = 'NEVER'
            order by ordinal_position;
        """, (table,))
        col_list = ", ".join(r[0] for r in old_cur.fetchall())

        old_cur.execute(f"select count(*) from {table};")
        old_count = old_cur.fetchone()[0]
        if old_count == 0:
            print(f"{table}: 0 rows, skipping")
            summary.append((table, 0, 0))
            continue

        buf = io.StringIO()
        old_cur.copy_expert(f"COPY {table} ({col_list}) TO STDOUT WITH CSV", buf)
        buf.seek(0)
        new_cur.copy_expert(f"COPY {table} ({col_list}) FROM STDIN WITH CSV", buf)
        new_cur.execute(f"select count(*) from {table};")
        new_count = new_cur.fetchone()[0]
        print(f"{table}: old {old_count} rows -> new count {new_count}")
        summary.append((table, old_count, new_count))

    new_conn.commit()
    print("\nAll tables copied and committed.")
except Exception as e:
    new_conn.rollback()
    print(f"\nFAILED — rolled back all inserts (nothing partially committed).\n{e}")
    raise
finally:
    old_cur.close()
    new_cur.close()
    old_conn.close()
    new_conn.close()

print("\n--- Summary (old rows copied -> new row count) ---")
for table, old_n, new_n in summary:
    flag = "OK" if old_n == new_n else "MISMATCH"
    print(f"  {table:30s} {old_n:>8} -> {new_n:>8}  {flag}")
