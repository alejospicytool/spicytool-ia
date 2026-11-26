// "Ideas y feedback": sugerencias, feedback de clientes y cosas nuevas para sumar. Lo ve y lo carga cualquier usuario con sesión; ordenar las ideas
// y mandarlas al tablero de Devs ("Enviar a Devs") es solo de admin, dev y editor. Los datos viven en Supabase (ver supabase_ideas.sql).
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { askConfirm } from "../confirmStore.js";
import {
  IDEA_TYPES, IDEA_COLUMNS, MANUAL_STATUSES, IMAGES_MAX, typeInfo, displayStatus, validateIdea, validateImage, safeFileName, voteCount, hasVoted, sortIdeas, canEditIdea, buildDevTask,
} from "./ideasLogic.js";

const RED = "#EF3E3E";
const rid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const lbl = { fontSize: 12, color: "#666", fontWeight: 500 };

const urlCache = new Map(); // ruta → { url, at }: las URLs firmadas duran 1 h; se reutilizan 50 min para que las miniaturas no parpadeen
function Thumb({ sb, path, name, height = 90, onClick }) {
  const [url, setUrl] = useState(() => { const c = urlCache.get(path); return c && Date.now() - c.at < 50 * 60000 ? c.url : null; });
  useEffect(() => {
    if (url) return undefined;
    let alive = true;
    sb.storage.from("attachments").createSignedUrl(path, 3600).then(({ data }) => { if (alive && data) { urlCache.set(path, { url: data.signedUrl, at: Date.now() }); setUrl(data.signedUrl); } });
    return () => { alive = false; };
  }, [path, url, sb]);
  const isPdf = /\.pdf$/i.test(path);
  const box = { width: "100%", height, borderRadius: 8, background: "#EEE", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 12, overflow: "hidden", cursor: onClick ? "pointer" : "default" };
  if (isPdf) return <div style={box} onClick={onClick}>📄 PDF</div>;
  if (!url) return <div style={box} />;
  return <img src={url} alt={name || "Imagen de la idea"} onClick={onClick} style={{ ...box, objectFit: "cover", display: "block" }} />;
}

// Visor de imágenes a pantalla completa: se ve la imagen entera (las miniaturas se recortan), flechas para pasar a la anterior/siguiente
// (también con ← →), Esc o clic afuera para cerrar, y un enlace real para abrirla en otra pestaña (un enlace no lo bloquea el navegador).
function ImageViewer({ sb, images, start = 0, onClose }) {
  const [i, setI] = useState(Math.min(Math.max(0, start), images.length - 1));
  const [urls, setUrls] = useState({});
  const img = images[i];
  useEffect(() => {
    if (!img || urls[img.storage_path]) return undefined;
    let alive = true;
    const c = urlCache.get(img.storage_path);
    if (c && Date.now() - c.at < 50 * 60000) { Promise.resolve().then(() => { if (alive) setUrls((u) => ({ ...u, [img.storage_path]: c.url })); }); return () => { alive = false; }; }
    sb.storage.from("attachments").createSignedUrl(img.storage_path, 3600).then(({ data }) => {
      if (!alive) return;
      if (data) { urlCache.set(img.storage_path, { url: data.signedUrl, at: Date.now() }); setUrls((u) => ({ ...u, [img.storage_path]: data.signedUrl })); } else setUrls((u) => ({ ...u, [img.storage_path]: "error" }));
    });
    return () => { alive = false; };
  }, [img, sb, urls]);
  const n = images.length;
  const go = (d) => setI((x) => (x + d + n) % n);
  useEffect(() => {
    // En fase de captura y frenando el evento: Esc cierra solo el visor (no la ventana de la idea que está abajo).
    const k = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); e.stopImmediatePropagation(); onClose(); }
      else if (e.key === "ArrowLeft" && n > 1) { e.stopPropagation(); setI((x) => (x - 1 + n) % n); }
      else if (e.key === "ArrowRight" && n > 1) { e.stopPropagation(); setI((x) => (x + 1) % n); }
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose, n]);
  if (!img) return null;
  const url = urls[img.storage_path], isPdf = /\.pdf$/i.test(img.storage_path);
  const arrow = (side, d, label) => <button type="button" aria-label={label} onClick={(e) => { e.stopPropagation(); go(d); }} style={{ position: "absolute", top: "50%", [side]: 14, transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 22, border: "none", background: "rgba(255,255,255,0.18)", color: "white", fontSize: 24, cursor: "pointer" }}>{d < 0 ? "‹" : "›"}</button>;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Imagen de la idea" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "56px 70px" }}>
      <div style={{ position: "absolute", top: 12, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, color: "white", fontSize: 13 }} onClick={(e) => e.stopPropagation()}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.file_name}{n > 1 ? `  ·  ${i + 1} de ${n}` : ""}</span>
        <span style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {url && url !== "error" && <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "white", background: "rgba(255,255,255,0.18)", borderRadius: 6, padding: "5px 10px", textDecoration: "none", fontSize: 12 }}>Abrir en otra pestaña</a>}
          <button type="button" aria-label="Cerrar" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 15, border: "none", background: "rgba(255,255,255,0.18)", color: "white", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
        </span>
      </div>
      {n > 1 && arrow("left", -1, "Imagen anterior")}
      {n > 1 && arrow("right", 1, "Imagen siguiente")}
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {url === "error" ? <div style={{ color: "white", fontSize: 14 }}>No se pudo cargar el archivo.</div>
          : !url ? <div style={{ color: "#ccc", fontSize: 14 }}>Cargando…</div>
          : isPdf ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "white", fontSize: 16 }}>📄 Abrir el PDF</a>
          : <img src={url} alt={img.file_name || "Imagen de la idea"} style={{ maxWidth: "100%", maxHeight: "calc(100vh - 112px)", objectFit: "contain", borderRadius: 6, background: "#222" }} />}
      </div>
    </div>,
    document.body,
  );
}

function Modal({ onClose, children, maxWidth = 640 }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 16, width: "100%", maxWidth, maxHeight: "90vh", overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}
const Err = ({ children }) => (children ? <div role="alert" style={{ fontSize: 12, color: "#C42F2F", background: "#FEF0F0", borderRadius: 6, padding: "6px 9px" }}>{children}</div> : null);
const Chip = ({ children, color = "#555", bg = "#F4F4F5", title }) => <span title={title} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5, color, background: bg, whiteSpace: "nowrap" }}>{children}</span>;

// Subir archivos de una idea: ruta ideas/<id>/…, y una fila en idea_images por cada uno. Devuelve los mensajes de error (vacío si salió todo bien).
async function uploadIdeaFiles(sb, ideaId, files, userId) {
  const errors = [];
  for (const file of files) {
    const path = `ideas/${ideaId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeFileName(file.name)}`;
    const { error: upErr } = await sb.storage.from("attachments").upload(path, file, { contentType: file.type });
    if (upErr) { errors.push(`${file.name}: ${upErr.message}`); continue; }
    const { error: dbErr } = await sb.from("idea_images").insert({ id: rid("img"), idea_id: ideaId, file_name: file.name, storage_path: path, content_type: file.type, size_bytes: file.size, uploaded_by_id: userId });
    if (dbErr) { await sb.storage.from("attachments").remove([path]); errors.push(`${file.name}: ${dbErr.message}`); }
  }
  return errors;
}

// ── Captura rápida ─────────────────────────────────────────────────────────────────────────────────────────────────
function QuickCapture({ sb, me, onCreated }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "", type: "funcion", requestedBy: "" });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileInput = useRef(null);

  function addFiles(list) {
    const next = [...files]; const problems = [];
    for (const file of list) {
      const err = validateImage(file, next.length);
      if (err) problems.push(err); else next.push(file);
    }
    setFiles(next); setMsg(problems[0] || "");
  }
  // Pegar una captura con Ctrl/Cmd+V en cualquier parte del formulario
  const onPaste = (e) => {
    const imgs = [...(e.clipboardData ? e.clipboardData.files : [])].filter((x) => x.type.startsWith("image/"));
    if (imgs.length) { e.preventDefault(); setOpen(true); addFiles(imgs.map((x, i) => (x.name ? x : new File([x], `captura-${Date.now()}-${i}.png`, { type: x.type })))); }
  };

  async function submit(e) {
    e.preventDefault();
    const v = validateIdea(f);
    setErrors(v.errors); setMsg("");
    if (!v.ok) return;
    setBusy(true);
    try {
      const id = rid("idea");
      const { error } = await sb.from("ideas").insert({ id, ...v.value, status: "nueva", author_id: me.id, author_email: me.email });
      if (error) throw error;
      const upErrors = files.length ? await uploadIdeaFiles(sb, id, files, me.id) : [];
      setF({ title: "", description: "", type: "funcion", requestedBy: "" }); setFiles([]); setOpen(false);
      onCreated(upErrors.length ? `La idea se cargó, pero no se pudieron subir algunos archivos: ${upErrors.join(" · ")}` : "");
    } catch (err) { setMsg("No se pudo guardar la idea: " + (err.message || "error")); } finally { setBusy(false); }
  }

  const field = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#333" };
  const hint = { fontSize: 12, fontWeight: 400, color: "#888" };
  return (
    <form onSubmit={submit} onPaste={onPaste} className="spicy-card" style={{ marginBottom: 16 }}>
      {!open ? (
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 30 }} aria-hidden="true">💡</div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>¿Tenés una idea o un feedback?</div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 2 }}>Contanos qué se te ocurrió y para qué serviría. Podés sumar una captura de pantalla.</div>
          </div>
          <button type="button" className="spicy-btn-primary" style={{ padding: "10px 18px", fontSize: 14 }} onClick={() => setOpen(true)}>+ Cargar una idea</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>💡 Nueva idea o feedback</div>
            <button type="button" aria-label="Cerrar" onClick={() => { setOpen(false); setFiles([]); setMsg(""); setErrors({}); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#bbb", lineHeight: 1 }}>×</button>
          </div>

          <label style={field}>
            <span>1. ¿Cómo se llama la idea? <span style={{ color: RED }}>*</span></span>
            <input className="spicy-input" autoFocus aria-label="Título de la idea" placeholder="Ej: Exportar los contactos a Excel" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={{ width: "100%" }} />
            <span style={hint}>Una frase corta que se entienda sola.</span>
            <Err>{errors.title}</Err>
          </label>

          <label style={field}>
            <span>2. Contanos más <span style={{ fontWeight: 400, color: "#aaa" }}>(opcional)</span></span>
            <textarea className="spicy-input" rows={4} aria-label="Explicación de la idea" placeholder="¿Qué se quiere lograr y para qué sirve? Si podés, un ejemplo de cómo se usaría." value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }} />
            <Err>{errors.description}</Err>
          </label>

          <div style={field}>
            <span>3. ¿Qué tipo de idea es?</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {IDEA_TYPES.map((t) => (
                <button type="button" key={t.key} aria-pressed={f.type === t.key} onClick={() => setF({ ...f, type: t.key })} style={{ padding: "6px 13px", borderRadius: 20, border: `1px solid ${f.type === t.key ? RED : "#E0E0E0"}`, background: f.type === t.key ? "#FEF0F0" : "white", color: f.type === t.key ? RED : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t.emoji} {t.label}</button>
              ))}
            </div>
          </div>

          <label style={field}>
            <span>4. ¿Quién lo pidió? <span style={{ fontWeight: 400, color: "#aaa" }}>(opcional)</span></span>
            <input className="spicy-input" value={f.requestedBy} onChange={(e) => setF({ ...f, requestedBy: e.target.value })} placeholder="Ej: Marcos de Inmobiliaria X, o alguien del equipo" style={{ width: "100%" }} />
            <span style={hint}>Si lo pidió un cliente o alguien más, anotalo acá. Si es una idea tuya, dejalo vacío.</span>
            <Err>{errors.requestedBy}</Err>
          </label>

          <div style={field}>
            <span>5. Imágenes o capturas <span style={{ fontWeight: 400, color: "#aaa" }}>(opcional)</span></span>
            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles([...e.dataTransfer.files]); }}
              style={{ border: `2px dashed ${drag ? RED : "#DDD"}`, borderRadius: 10, padding: "14px 16px", background: drag ? "#FFF6F6" : "#FAFAFA", fontSize: 13, fontWeight: 400, color: "#666", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span>🖼️ <b>Pegá una captura</b> con Ctrl/Cmd+V, arrastrala hasta acá, o</span>
              <button type="button" className="spicy-btn-secondary" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => fileInput.current && fileInput.current.click()}>elegí archivos</button>
              <input ref={fileInput} type="file" multiple accept="image/*,application/pdf" hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} />
              <span style={{ color: "#aaa", fontSize: 12 }}>Hasta {IMAGES_MAX} (imágenes o PDF)</span>
            </div>
          </div>
          {files.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {files.map((file, i) => (
                <div key={i} style={{ position: "relative", width: 72 }}>
                  {file.type.startsWith("image/") ? <img src={URL.createObjectURL(file)} alt={file.name} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 72, height: 72, borderRadius: 8, background: "#EEE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>📄 PDF</div>}
                  <button type="button" aria-label={`Quitar ${file.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "#333", color: "white", cursor: "pointer", fontSize: 12, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <Err>{msg}</Err>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #EEE", paddingTop: 12 }}>
            <button type="button" className="spicy-btn-secondary" disabled={busy} onClick={() => { setOpen(false); setFiles([]); setMsg(""); setErrors({}); }}>Cancelar</button>
            <button type="submit" className="spicy-btn-primary" disabled={busy} style={{ padding: "9px 20px" }}>{busy ? "Enviando…" : "Enviar idea"}</button>
          </div>
        </div>
      )}
    </form>
  );
}

// ── Pantalla principal ──────────────────────────────────────────────────────────────────────────────────────────────
export default function IdeasApp({ sb, ideas, votes, images, devTasks, allUsers, me, canTriage, canDelete, canSeeDevs, onOpenDevTask, onRefresh, renderComments, openId = null, onOpenHandled = null }) {
  const [fType, setFType] = useState(""), [mine, setMine] = useState(false), [q, setQ] = useState("");
  const [detailId, setDetailId] = useState(null);
  // Abrir una idea pedida desde afuera (buscador global).
  useEffect(() => {
    if (!openId) return;
    if (ideas.some((i) => i.id === openId)) setDetailId(openId);
    if (onOpenHandled) onOpenHandled();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Solo debe correr cuando llega un pedido nuevo (openId): si dependiera de ideas reabriría la idea cada vez que cambian los datos.
  }, [openId]);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);

  const nameOf = (idea) => {
    const u = allUsers.find((x) => x.user_id === idea.author_id);
    return u && (u.first_name || u.last_name) ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : String(idea.author_email || "").split("@")[0] || "—";
  };
  const taskOf = (idea) => (idea.dev_task_id ? devTasks.find((t) => t.id === idea.dev_task_id) : null);
  const imagesOf = (id) => images.filter((i) => i.idea_id === id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return sortIdeas(ideas, votes).filter((i) => (!fType || i.type === fType) && (!mine || i.author_id === me.id)
      && (!t || [i.title, i.description, i.requested_by, i.author_email].some((x) => String(x || "").toLowerCase().includes(t))));
  }, [ideas, votes, fType, mine, q, me.id]);
  const byColumn = (col) => shown.filter((i) => displayStatus(i, taskOf(i)).column === col);

  async function toggleVote(idea) {
    const had = hasVoted(votes, idea.id, me.id);
    const { error } = had ? await sb.from("idea_votes").delete().eq("idea_id", idea.id).eq("user_id", me.id) : await sb.from("idea_votes").insert({ idea_id: idea.id, user_id: me.id });
    if (error) setNotice("No se pudo registrar el voto: " + error.message); else onRefresh();
  }

  async function setStatus(idea, status) {
    const { data, error } = await sb.from("ideas").update({ status }).eq("id", idea.id).select("id");
    if (error || !data || !data.length) { setNotice("No se pudo cambiar el estado" + (error ? ": " + error.message : ": tu usuario no tiene permiso para ordenar ideas")); return; }
    onRefresh();
  }

  // Crea la tarea en el Backlog de Devs (con las imágenes copiadas y el que la envía como responsable) y deja la idea vinculada a ella.
  async function sendToDevs(idea) {
    const imgs = imagesOf(idea.id);
    const ok = await askConfirm({ title: "Enviar a Devs", message: `Se va a crear una tarea en el Backlog de Devs con "${idea.title}"${imgs.length ? ` y sus ${imgs.length} imagen${imgs.length === 1 ? "" : "es"}` : ""}. Vos quedás como responsable de la tarea.`, confirmLabel: "Enviar a Devs", danger: false });
    if (!ok) return;
    setBusyId(idea.id); setNotice("");
    try {
      const t = buildDevTask(idea, { votes: voteCount(votes, idea.id), images: imgs.length });
      const taskId = "dt_" + Date.now();
      const { error: e1 } = await sb.from("dev_tasks").insert({ id: taskId, title: t.title, description: t.description, stage: "Backlog" });
      if (e1) throw new Error("no se pudo crear la tarea: " + e1.message);
      await sb.from("dev_task_status_history").insert({ id: rid("dth"), dev_task_id: taskId, stage: "Backlog", changed_by: me.email });
      await sb.from("entity_assignees").insert({ id: rid("ea"), entity_type: "dev_task", entity_id: taskId, user_id: me.id });
      const failed = [];
      for (const img of imgs) {
        // Se COPIA el archivo (no se comparte): si alguien borra el adjunto de la tarea, la imagen de la idea no se pierde.
        const to = `dev_task/${taskId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeFileName(img.file_name)}`;
        const { error: cpErr } = await sb.storage.from("attachments").copy(img.storage_path, to);
        if (cpErr) { failed.push(img.file_name); continue; }
        const { error: dbErr } = await sb.from("attachments").insert({ id: rid("att"), entity_type: "dev_task", entity_id: taskId, file_name: img.file_name, storage_path: to, content_type: img.content_type, size_bytes: img.size_bytes, uploaded_by: me.email });
        if (dbErr) { await sb.storage.from("attachments").remove([to]); failed.push(img.file_name); }
      }
      const { data, error: e2 } = await sb.from("ideas").update({ status: "enviada", dev_task_id: taskId }).eq("id", idea.id).select("id");
      if (e2 || !data || !data.length) throw new Error("la tarea se creó en Devs, pero no se pudo marcar la idea como enviada" + (e2 ? ": " + e2.message : ""));
      setNotice(failed.length ? `Enviada a Devs. No se pudieron copiar estos archivos a la tarea: ${failed.join(", ")} (siguen en la idea).` : "Enviada a Devs: se creó la tarea en el Backlog.");
      onRefresh();
    } catch (err) { setNotice("No se pudo enviar a Devs: " + (err.message || "error")); } finally { setBusyId(null); }
  }

  async function removeIdea(idea) {
    if (!(await askConfirm({ title: "Eliminar idea", message: `Se va a eliminar la idea "${idea.title}" con sus imágenes, votos y comentarios. No se puede deshacer.` }))) return;
    const paths = imagesOf(idea.id).map((i) => i.storage_path);
    const { data, error } = await sb.from("ideas").delete().eq("id", idea.id).select("id");
    if (error || !data || !data.length) { setNotice("No se pudo eliminar la idea" + (error ? ": " + error.message : ": solo se puede borrar una idea propia que siga en 'Nueva'")); return; }
    if (paths.length) await sb.storage.from("attachments").remove(paths);
    setDetailId(null); onRefresh();
  }

  const detail = detailId ? ideas.find((i) => i.id === detailId) : null;
  const card = (idea) => {
    const ds = displayStatus(idea, taskOf(idea)), imgs = imagesOf(idea.id), t = typeInfo(idea.type), voted = hasVoted(votes, idea.id, me.id);
    return (
      <div key={idea.id} onClick={() => setDetailId(idea.id)} style={{ background: "white", border: "1px solid #EBEBEB", borderRadius: 10, padding: 10, marginBottom: 8, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
        {imgs[0] && <div style={{ marginBottom: 8 }}><Thumb sb={sb} path={imgs[0].storage_path} name={imgs[0].file_name} height={86} /></div>}
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111", overflowWrap: "anywhere" }}>{idea.title}</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "6px 0" }}>
          <Chip>{t.emoji} {t.label}</Chip>
          {ds.detail && <Chip color="#533AB7" bg="#F1EEFB">{ds.detail}</Chip>}
          {imgs.length > 1 && <Chip title="Imágenes adjuntas">🖼 {imgs.length}</Chip>}
        </div>
        <div style={{ fontSize: 11, color: "#999" }}>{nameOf(idea)}{idea.requested_by ? ` · pedida por ${idea.requested_by}` : ""}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 6 }}>
          <button onClick={(e) => { e.stopPropagation(); toggleVote(idea); }} aria-pressed={voted} aria-label={voted ? "Quitar mi voto" : "Votar esta idea"} style={{ border: `1px solid ${voted ? RED : "#E0E0E0"}`, background: voted ? "#FEF0F0" : "white", color: voted ? RED : "#666", borderRadius: 14, padding: "2px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>👍 {voteCount(votes, idea.id)}</button>
          {canTriage && (idea.status === "nueva" || idea.status === "evaluacion") && (
            <button className="spicy-btn-secondary" disabled={busyId === idea.id} onClick={(e) => { e.stopPropagation(); sendToDevs(idea); }} style={{ padding: "3px 9px", fontSize: 11 }}>{busyId === idea.id ? "Enviando…" : "Enviar a Devs →"}</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>Ideas y feedback</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Sugerencias, feedback de clientes y cosas nuevas para sumar. Cualquiera puede cargar y votar; el equipo de producto las ordena y las manda a Devs.</div>
      </div>

      <QuickCapture sb={sb} me={me} onCreated={(warn) => { setNotice(warn); onRefresh(); }} />
      {notice && <div role="status" style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "#FEF9E7", border: "1px solid #FCE4A0", fontSize: 13, color: "#92400E", display: "flex", justifyContent: "space-between", gap: 10 }}><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Cerrar aviso" style={{ background: "none", border: "none", cursor: "pointer", color: "#92400E" }}>×</button></div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <select aria-label="Filtrar por tipo" className="spicy-select" value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {IDEA_TYPES.map((t) => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#666" }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Solo las mías</label>
        <input aria-label="Buscar idea" className="spicy-input" placeholder="Buscar idea…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
        <span style={{ fontSize: 12, color: "#aaa" }}>{shown.length} de {ideas.length} ideas</span>
      </div>

      <div style={{ overflowX: "auto", paddingBottom: 8 }}>
        <div style={{ display: "flex", gap: 12, minWidth: IDEA_COLUMNS.length * 236 }}>
          {IDEA_COLUMNS.map((col) => {
            const list = byColumn(col.key);
            return (
              <div key={col.key} style={{ width: 224, flexShrink: 0, background: "#F7F7F8", border: "1px solid #EBEBEB", borderRadius: 12, padding: 10, minHeight: 120 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 10, display: "flex", justifyContent: "space-between" }}><span>{col.label}</span><span style={{ color: "#bbb" }}>{list.length}</span></div>
                {list.map(card)}
                {list.length === 0 && <div style={{ fontSize: 11, color: "#ccc", textAlign: "center", padding: "12px 0" }}>{col.key === "nueva" ? "Todavía no hay ideas nuevas" : "Nada por acá"}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {detail && <IdeaDetail key={detail.id} sb={sb} idea={detail} images={imagesOf(detail.id)} votes={votes} me={me} nameOf={nameOf} task={taskOf(detail)} canTriage={canTriage} canDelete={canDelete} canSeeDevs={canSeeDevs}
        busy={busyId === detail.id} onClose={() => setDetailId(null)} onVote={() => toggleVote(detail)} onSetStatus={(s) => setStatus(detail, s)} onSend={() => sendToDevs(detail)} onRemove={() => removeIdea(detail)}
        onOpenDevTask={() => { setDetailId(null); onOpenDevTask(detail.dev_task_id); }} onChanged={onRefresh} onNotice={setNotice} comments={renderComments(detail.id)} />}
    </>
  );
}

// ── Detalle de una idea ────────────────────────────────────────────────────────────────────────────────────────────
function IdeaDetail({ sb, idea, images, votes, me, nameOf, task, canTriage, canDelete, canSeeDevs, busy, onClose, onVote, onSetStatus, onSend, onRemove, onOpenDevTask, onChanged, onNotice, comments }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ title: idea.title, description: idea.description || "", type: idea.type, requestedBy: idea.requested_by || "" });
  const [errors, setErrors] = useState({}); const [msg, setMsg] = useState(""); const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);
  const ds = displayStatus(idea, task), t = typeInfo(idea.type), voted = hasVoted(votes, idea.id, me.id);
  const mineEditable = canEditIdea(idea, me.id), canAddImages = mineEditable || canTriage;
  const canRemove = mineEditable || canDelete;
  const [viewer, setViewer] = useState(null); // posición de la imagen abierta en el visor (o null)

  async function save() {
    const v = validateIdea(f); setErrors(v.errors); setMsg("");
    if (!v.ok) return;
    setSaving(true);
    const { data, error } = await sb.from("ideas").update(v.value).eq("id", idea.id).select("id");
    setSaving(false);
    if (error || !data || !data.length) { setMsg("No se guardó" + (error ? ": " + error.message : ": solo el autor puede editar mientras la idea siga en 'Nueva'")); return; }
    setEditing(false); onChanged();
  }
  async function addFiles(list) {
    const files = []; const problems = [];
    for (const file of list) { const err = validateImage(file, images.length + files.length); if (err) problems.push(err); else files.push(file); }
    if (problems.length) setMsg(problems[0]);
    if (!files.length) return;
    const errs = await uploadIdeaFiles(sb, idea.id, files, me.id);
    if (errs.length) onNotice("No se pudieron subir algunos archivos: " + errs.join(" · "));
    onChanged();
  }
  async function removeImage(img) {
    if (!(await askConfirm({ title: "Borrar imagen", message: `Se va a borrar "${img.file_name}" de la idea.` , confirmLabel: "Borrar" }))) return;
    const { data, error } = await sb.from("idea_images").delete().eq("id", img.id).select("id");
    if (error || !data || !data.length) { setMsg("No se pudo borrar: solo puede hacerlo quien la subió (o un admin o dev)."); return; }
    await sb.storage.from("attachments").remove([img.storage_path]);
    onChanged();
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? <input className="spicy-input" aria-label="Título" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={{ width: "100%", fontWeight: 700, fontSize: 16 }} />
            : <div style={{ fontSize: 17, fontWeight: 700, color: "#111", overflowWrap: "anywhere" }}>{idea.title}</div>}
          <Err>{errors.title}</Err>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
            <Chip>{t.emoji} {t.label}</Chip>
            <Chip color="#555" bg="#F4F4F5">{{ nueva: "Nueva", evaluacion: "En evaluación", enviada: "En Devs", descartada: "Descartada" }[idea.status]}</Chip>
            {ds.column === "hecha" && <Chip color="#16A34A" bg="#EDFAF3">✓ Hecha</Chip>}
            {ds.detail && ds.column !== "hecha" && <Chip color="#533AB7" bg="#F1EEFB">{ds.detail}</Chip>}
            <span style={{ fontSize: 12, color: "#999" }}>Cargada por {nameOf(idea)} · {new Date(idea.created_at).toLocaleDateString("es-AR")}</span>
          </div>
        </div>
        <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#ccc", lineHeight: 1 }}>×</button>
      </div>

      {editing ? (
        <>
          <textarea className="spicy-input" rows={4} aria-label="Explicación" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{IDEA_TYPES.map((x) => <button type="button" key={x.key} aria-pressed={f.type === x.key} onClick={() => setF({ ...f, type: x.key })} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${f.type === x.key ? RED : "#E0E0E0"}`, background: f.type === x.key ? "#FEF0F0" : "white", color: f.type === x.key ? RED : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{x.emoji} {x.label}</button>)}</div>
          <label style={lbl}>Pedido por<input className="spicy-input" value={f.requestedBy} onChange={(e) => setF({ ...f, requestedBy: e.target.value })} style={{ width: "100%", marginTop: 4 }} /></label>
          <Err>{errors.description || errors.requestedBy}</Err>
          <div style={{ display: "flex", gap: 8 }}><button className="spicy-btn-primary" disabled={saving} onClick={save}>Guardar cambios</button><button className="spicy-btn-secondary" onClick={() => { setEditing(false); setErrors({}); }}>Cancelar</button></div>
        </>
      ) : (
        <>
          {idea.requested_by && <div style={{ fontSize: 13, color: "#555" }}><b>Pedida por:</b> {idea.requested_by}</div>}
          {idea.description ? <div style={{ fontSize: 14, color: "#222", whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.5 }}>{idea.description}</div> : <div style={{ fontSize: 13, color: "#bbb" }}>Sin explicación.</div>}
        </>
      )}

      {viewer !== null && <ImageViewer sb={sb} images={images} start={viewer} onClose={() => setViewer(null)} />}
      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
          {images.map((img) => (
            <div key={img.id}>
              <Thumb sb={sb} path={img.storage_path} name={img.file_name} height={100} onClick={() => setViewer(images.indexOf(img))} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#999", marginTop: 3, gap: 4 }}>
                <span title={img.file_name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.file_name}</span>
                {(img.uploaded_by_id === me.id || canDelete) && <button onClick={() => removeImage(img)} style={{ background: "none", border: "none", cursor: "pointer", color: "#C42F2F", fontSize: 10, padding: 0 }}>Borrar</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {canAddImages && images.length < IMAGES_MAX && (
        <div><button className="spicy-btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => fileInput.current && fileInput.current.click()}>+ Agregar imagen</button>
          <input ref={fileInput} type="file" multiple accept="image/*,application/pdf" hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} /></div>
      )}
      <Err>{msg}</Err>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderTop: "1px solid #EEE", paddingTop: 12 }}>
        <button onClick={onVote} aria-pressed={voted} style={{ border: `1px solid ${voted ? RED : "#E0E0E0"}`, background: voted ? "#FEF0F0" : "white", color: voted ? RED : "#666", borderRadius: 16, padding: "5px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>👍 {voteCount(votes, idea.id)} {voted ? "· votaste" : "· votar"}</button>
        {mineEditable && !editing && <button className="spicy-btn-secondary" onClick={() => setEditing(true)}>Editar</button>}
        {canRemove && <button className="spicy-btn-secondary" style={{ color: "#C42F2F" }} onClick={onRemove}>Eliminar</button>}
      </div>

      {canTriage && (
        <div style={{ background: "#F7F7F8", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Producto y Devs</span>
          {idea.status !== "enviada" ? (
            <>
              <select className="spicy-select" aria-label="Estado de la idea" value={idea.status} onChange={(e) => onSetStatus(e.target.value)}>
                {MANUAL_STATUSES.map((s) => <option key={s} value={s}>{{ nueva: "Nueva", evaluacion: "En evaluación", descartada: "Descartada" }[s]}</option>)}
              </select>
              {idea.status !== "descartada" && <button className="spicy-btn-primary" disabled={busy} onClick={onSend}>{busy ? "Enviando…" : "Enviar a Devs →"}</button>}
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, color: "#533AB7" }}>{task ? `Tarea en Devs · ${ds.detail || task.stage}` : "Enviada a Devs"}</span>
              {task && canSeeDevs && <button className="spicy-btn-secondary" onClick={onOpenDevTask}>Ver la tarea en Devs</button>}
            </>
          )}
        </div>
      )}
      {!canTriage && idea.status === "enviada" && <div style={{ fontSize: 13, color: "#533AB7", background: "#F1EEFB", borderRadius: 8, padding: "8px 12px" }}>🚀 Esta idea ya está en Devs{ds.detail ? ` · ${ds.detail}` : ""}.</div>}

      <div style={{ borderTop: "1px solid #EEE", paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 8 }}>Comentarios</div>
        {comments}
      </div>
    </Modal>
  );
}
