// Buscador global (barra arriba, centrada). Busca en lo que la app ya tiene cargado (ver searchLogic.js) y, si la persona tiene Admin Spicy, también
// en los usuarios (consulta al servidor con una pequeña espera para no pedir en cada tecla). Atajos: Ctrl/Cmd+K o "/" para ir a la barra,
// ↑ ↓ para moverse, Enter para abrir, Esc para cerrar. Qué pasa al elegir un resultado lo decide quien lo usa (onPick).
import { useEffect, useMemo, useRef, useState } from "react";
import { searchAll, spicyUserItems, withSpicyGroup, flatItems, queryWords } from "./searchLogic.js";
import { listUsers, probeAdminApi } from "../admin/adminApi.js";
import { userFullName } from "../admin/adminLogic.js";

const ICON = { client: "👥", spicy_user: "🌶️", ticket: "🎫", task: "✅", dev_task: "🛠️", onboarding: "🚀", note: "📝", idea: "💡", view: "➡️" };
const SPICY_WAIT_MS = 300;

export default function GlobalSearch({ data, canSpicy = false, onPick }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [spicy, setSpicy] = useState({ q: "", items: [], more: 0, error: false }); // resultado de Admin Spicy para la consulta `q`
  const box = useRef(null), input = useRef(null), seq = useRef(0), real = useRef(null);
  const query = q.trim(), ok = queryWords(query).length > 0;

  const local = useMemo(() => searchAll(query, data), [query, data]);
  const spicyReady = canSpicy && ok && spicy.q === query && !spicy.error;
  const groups = useMemo(() => (spicyReady ? withSpicyGroup(local.groups, spicy.items, spicy.more) : local.groups), [local, spicyReady, spicy]);
  const flat = useMemo(() => flatItems(groups), [groups]);
  const spicyPending = canSpicy && ok && spicy.q !== query;

  // Usuarios de Admin Spicy: se pide al servidor un instante después de dejar de escribir; las respuestas de una consulta vieja se descartan.
  useEffect(() => {
    if (!canSpicy || !ok) return undefined;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        if (real.current === null) real.current = (await probeAdminApi()) === "real";
        if (!real.current) { if (mine === seq.current) setSpicy({ q: query, items: [], more: 0, error: true }); return; }
        const r = await listUsers({ search: query, page: 1, pageSize: 5 });
        if (mine === seq.current) setSpicy({ q: query, items: spicyUserItems(r.items, userFullName), more: Math.max(0, (r.total || 0) - 5), error: false });
      } catch {
        if (mine === seq.current) setSpicy({ q: query, items: [], more: 0, error: true });
      }
    }, SPICY_WAIT_MS);
    return () => clearTimeout(t);
  }, [query, ok, canSpicy]);

  // Atajos para ir a la barra: Ctrl/Cmd+K, o "/" cuando no se está escribiendo en otro campo.
  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement, typing = el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); input.current && input.current.focus(); }
      else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); input.current && input.current.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Clic afuera cierra la lista.
  useEffect(() => {
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (item) => { if (!item) return; setOpen(false); setQ(""); setActive(0); if (input.current) input.current.blur(); onPick(item); };
  const onKeyDown = (e) => {
    if (e.key === "Escape") { if (q) setQ(""); setOpen(false); e.stopPropagation(); if (!q && input.current) input.current.blur(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, Math.max(0, flat.length - 1))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(flat[Math.min(active, flat.length - 1)]); }
  };

  const showPanel = open;
  // Posición de cada resultado en la lista plana (para marcar el activo con las flechas).
  const starts = groups.reduce((acc, g, i) => [...acc, i === 0 ? 0 : acc[i - 1] + groups[i - 1].items.length], []);
  return (
    <div className="spicy-search-wrap" ref={box}>
      <div className="spicy-search-field">
        <span aria-hidden="true" style={{ fontSize: 14, opacity: 0.55 }}>🔎</span>
        <input ref={input} className="spicy-search-input" type="search" role="combobox" aria-expanded={showPanel} aria-controls="spicy-search-list" aria-label="Buscar en el backoffice" autoComplete="off" spellCheck={false}
          placeholder="Buscar clientes, tickets, tareas, notas…" value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} />
        <kbd className="spicy-search-kbd" aria-hidden="true">Ctrl K</kbd>
      </div>
      {showPanel && (
        <div className="spicy-search-panel" id="spicy-search-list" role="listbox" aria-label="Resultados de la búsqueda">
          {!ok && <div className="spicy-search-hint">Escribí al menos 2 letras. Se busca en clientes, tickets, tareas, onboarding, notas e ideas{canSpicy ? " y en los usuarios de Admin Spicy" : ""}. Podés buscar un teléfono sin espacios ni guiones.</div>}
          {ok && groups.length === 0 && !spicyPending && <div className="spicy-search-hint">No encontré nada para «{query}».</div>}
          {groups.map((g, gi) => (
            <div key={g.type}>
              <div className="spicy-search-group">{g.label}</div>
              {g.items.map((it, ii) => {
                const idx = starts[gi] + ii;
                return (
                  <button type="button" role="option" aria-selected={idx === active} key={g.type + it.id} className={"spicy-search-item" + (idx === active ? " active" : "")}
                    onMouseEnter={() => setActive(idx)} onMouseDown={(e) => { e.preventDefault(); pick(it); }}>
                    <span aria-hidden="true" style={{ width: 22, textAlign: "center" }}>{ICON[it.type]}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="spicy-search-title">{it.title}</span>
                      {it.sub && <span className="spicy-search-sub">{it.sub}</span>}
                    </span>
                  </button>
                );
              })}
              {g.more > 0 && <div className="spicy-search-more">y {g.more} más: escribí algo más para afinar</div>}
            </div>
          ))}
          {spicyPending && <div className="spicy-search-hint">Buscando en Admin Spicy…</div>}
          {canSpicy && ok && spicy.q === query && spicy.error && <div className="spicy-search-hint" style={{ color: "#B45309" }}>No se pudo buscar en Admin Spicy ahora.</div>}
        </div>
      )}
    </div>
  );
}
