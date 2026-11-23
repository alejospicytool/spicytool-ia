// Lógica pura de "Ideas y feedback" (sin React ni Supabase), para poder probarla con vitest.
// Estados guardados: nueva | evaluacion | enviada | descartada. "Hecha" NO se guarda: se calcula cuando la tarea de dev vinculada llega a Done.

export const IDEA_TYPES = [
  { key: "funcion", label: "Nueva función", emoji: "✨" },
  { key: "mejora", label: "Mejora", emoji: "🔧" },
  { key: "feedback", label: "Feedback de cliente", emoji: "💬" },
  { key: "problema", label: "Problema o duda", emoji: "⚠️" },
];
export const IDEA_COLUMNS = [
  { key: "nueva", label: "Nueva" },
  { key: "evaluacion", label: "En evaluación" },
  { key: "enviada", label: "En Devs" },
  { key: "hecha", label: "Hecha" },
  { key: "descartada", label: "Descartada" },
];
// Estados que puede poner a mano quien ordena las ideas (los otros dos salen de enviar a Devs y de la tarea de dev).
export const MANUAL_STATUSES = ["nueva", "evaluacion", "descartada"];

export const typeInfo = (k) => IDEA_TYPES.find((t) => t.key === k) || { key: k, label: k || "—", emoji: "•" };

export const TITLE_MIN = 3, TITLE_MAX = 120, DESC_MAX = 4000, REQ_MAX = 120;
export const IMAGE_MAX_BYTES = 20 * 1024 * 1024, IMAGES_MAX = 5;
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

// Etapas de la tarea de dev (ver DEV_TASK_STAGES en App.jsx): Backlog, In Progress, Testing, Done.
const STAGE_LABEL = { Backlog: "En el backlog", "In Progress": "En desarrollo", Testing: "En pruebas", Done: "Terminada" };

// En qué columna se ve la idea y, si está en Devs, cómo va su tarea. Si la tarea llegó a Done, la idea figura como Hecha sola.
export function displayStatus(idea, devTask) {
  if (!idea) return { column: "nueva", detail: null };
  if (idea.status === "enviada") {
    if (!devTask) return { column: "enviada", detail: idea.dev_task_id ? "La tarea ya no existe en Devs" : null };
    if (devTask.stage === "Done") return { column: "hecha", detail: STAGE_LABEL.Done };
    return { column: "enviada", detail: STAGE_LABEL[devTask.stage] || devTask.stage || null };
  }
  return { column: idea.status, detail: null };
}

export function validateIdea({ title, description, type, requestedBy }) {
  const errors = {};
  const t = String(title ?? "").replace(/\s+/g, " ").trim();
  if (t.length < TITLE_MIN) errors.title = `Poné un título (mínimo ${TITLE_MIN} caracteres).`;
  else if (t.length > TITLE_MAX) errors.title = `El título es demasiado largo (máximo ${TITLE_MAX}).`;
  const d = String(description ?? "").trim();
  if (d.length > DESC_MAX) errors.description = `La descripción es demasiado larga (máximo ${DESC_MAX}).`;
  if (!IDEA_TYPES.some((x) => x.key === type)) errors.type = "Elegí el tipo de idea.";
  const r = String(requestedBy ?? "").replace(/\s+/g, " ").trim();
  if (r.length > REQ_MAX) errors.requestedBy = `Demasiado largo (máximo ${REQ_MAX}).`;
  return { ok: Object.keys(errors).length === 0, errors, value: { title: t, description: d || null, type, requested_by: r || null } };
}

// Una imagen (o PDF) para adjuntar. `already` = cuántas ya tiene la idea o están elegidas.
export function validateImage(file, already = 0) {
  if (!file) return "No hay archivo.";
  if (already >= IMAGES_MAX) return `Se pueden adjuntar hasta ${IMAGES_MAX} archivos por idea.`;
  if (!IMAGE_MIME_TYPES.includes(file.type)) return "Solo se aceptan imágenes (JPG, PNG, GIF, WebP) o PDF.";
  if (file.size > IMAGE_MAX_BYTES) return "El archivo supera el límite de 20 MB.";
  return "";
}
export const safeFileName = (name) => String(name || "archivo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || "archivo";

export const voteCount = (votes, ideaId) => (votes || []).filter((v) => v.idea_id === ideaId).length;
export const hasVoted = (votes, ideaId, userId) => !!userId && (votes || []).some((v) => v.idea_id === ideaId && v.user_id === userId);

// Más votadas primero; a igual cantidad, las más nuevas.
export function sortIdeas(ideas, votes) {
  return [...ideas].sort((a, b) => voteCount(votes, b.id) - voteCount(votes, a.id) || String(b.created_at).localeCompare(String(a.created_at)));
}

// El autor edita o borra la suya solo mientras esté en 'nueva' (lo hace cumplir también la base).
export const canEditIdea = (idea, userId) => !!idea && !!userId && idea.author_id === userId && idea.status === "nueva";

const fmt = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : "—");
// La tarea que se crea en Devs al enviar la idea: mismo título y la explicación, más de dónde viene.
export function buildDevTask(idea, { votes = 0, images = 0 } = {}) {
  const lines = [];
  if (idea.description) lines.push(idea.description.trim(), "");
  lines.push(`— Viene de "Ideas y feedback"`);
  lines.push(`Tipo: ${typeInfo(idea.type).label}`);
  lines.push(`Cargada por: ${String(idea.author_email || "").split("@")[0] || "—"} el ${fmt(idea.created_at)}`);
  if (idea.requested_by) lines.push(`Pedida por: ${idea.requested_by}`);
  if (votes > 0) lines.push(`Votos: ${votes}`);
  if (images > 0) lines.push(`Imágenes adjuntas: ${images} (copiadas a esta tarea)`);
  return { title: idea.title, description: lines.join("\n") };
}
