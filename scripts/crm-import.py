#!/usr/bin/env python3
"""Genera el SQL para importar _import/crm-datos.json al CRM comercial (Supabase).

Uso:  python3 scripts/crm-import.py            # escribe _import/crm-import.sql
      python3 scripts/crm-import.py otro.json   # usa otro archivo de datos

Es IDEMPOTENTE: se puede correr las veces que haga falta (on conflict do update). OJO: pisa los
deals/tareas/config que tengan el mismo id, así que no correrlo sobre un CRM que ya se está usando
en el backoffice sin querer. Los datos reales NO van a git (_import/ está en .gitignore).
Pegar el resultado en Supabase -> SQL editor.
"""
import json, sys, os

src = sys.argv[1] if len(sys.argv) > 1 else "_import/crm-datos.json"
out = "_import/crm-import.sql"
d = json.load(open(src, encoding="utf-8"))
for k in ("config", "deals", "tasks"):
    if k not in d:
        sys.exit(f"Falta '{k}' en {src}")
ids = [x["id"] for x in d["deals"]]
if len(ids) != len(set(ids)):
    sys.exit("Hay ids de deals duplicados")
tids = [x["id"] for x in d["tasks"]]
if len(tids) != len(set(tids)):
    sys.exit("Hay ids de tareas duplicados")

def lit(obj):
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    tag = "j"
    while f"${tag}$" in s:
        tag += "x"
    return f"${tag}${s}${tag}$::jsonb"

L = ["begin;"]
L.append(f"insert into public.crm_config (id, data) values (1, {lit(d['config'])}) "
         "on conflict (id) do update set data = excluded.data, version = public.crm_config.version + 1;")
for x in d["deals"]:
    L.append(f"insert into public.crm_deals (id, data) values ('{x['id']}', {lit(x)}) "
             "on conflict (id) do update set data = excluded.data, version = public.crm_deals.version + 1;")
for x in d["tasks"]:
    L.append(f"insert into public.crm_tasks (id, data) values ('{x['id']}', {lit(x)}) "
             "on conflict (id) do update set data = excluded.data, version = public.crm_tasks.version + 1;")
L.append("commit;")
os.makedirs("_import", exist_ok=True)
open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
print(f"{len(d['deals'])} deals, {len(d['tasks'])} tareas, 1 config -> {out} ({os.path.getsize(out)//1024} KB)")
