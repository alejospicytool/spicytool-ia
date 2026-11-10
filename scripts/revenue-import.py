#!/usr/bin/env python3
"""Genera el SQL para cargar el histórico mensual de ChartMogul en rev_history_monthly (Supabase).

Uso:  python3 scripts/revenue-import.py                       # lee docs/revenue/chartmogul_historico_mensual.json
      python3 scripts/revenue-import.py otro.json              # usa otro archivo
Escribe _import/revenue-history.sql (carpeta ignorada por git: son ingresos reales y el repo es público).
Pegar el resultado en Supabase -> SQL editor. Es IDEMPOTENTE (on conflict do update), así que se puede correr de nuevo.
Este script no contiene datos.
"""
import json, re, sys, os

src = sys.argv[1] if len(sys.argv) > 1 else "docs/revenue/chartmogul_historico_mensual.json"
d = json.load(open(src, encoding="utf-8"))
meses = d.get("meses")
if not isinstance(meses, list) or not meses:
    sys.exit("El archivo no tiene la lista 'meses'")
if d.get("moneda") != "USD":
    sys.exit("Se esperaba moneda USD, vino: %r" % d.get("moneda"))
seen = set()
for m in meses:
    if not re.fullmatch(r"\d{4}-\d{2}", str(m.get("mes", ""))):
        sys.exit("Mes inválido: %r" % m.get("mes"))
    if m["mes"] in seen:
        sys.exit("Mes duplicado: " + m["mes"])
    seen.add(m["mes"])

def lit(obj):
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    tag = "j"
    while f"${tag}$" in s:
        tag += "x"
    return f"${tag}${s}${tag}$::jsonb"

L = ["begin;"]
for m in meses:
    L.append(f"insert into public.rev_history_monthly (month, data, source) values ('{m['mes']}', {lit(m)}, 'chartmogul') "
             "on conflict (month) do update set data = excluded.data;")
L.append(f"-- {len(meses)} meses, {meses[0]['mes']} a {meses[-1]['mes']}")
L.append("commit;")
os.makedirs("_import", exist_ok=True)
open("_import/revenue-history.sql", "w", encoding="utf-8").write("\n".join(L) + "\n")
print(f"OK: {len(meses)} meses ({meses[0]['mes']} a {meses[-1]['mes']}) -> _import/revenue-history.sql")
