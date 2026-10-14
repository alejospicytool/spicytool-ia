// Links directos a un ticket / tarea de dev / tarea: https://<dominio>/?ticket=<id>
// Se usa query string (no hash ni rutas) para que funcione con cualquier servidor estático.

export const LINK_PARAMS = { ticket: "ticket", dev_task: "devtask", task: "task" };

// Qué vista abre cada tipo y qué sección hace falta tener habilitada para verla.
export const LINK_TARGETS = {
  ticket:   { view: "tickets",  section: "Operaciones" },
  task:     { view: "tasks",    section: "Operaciones" },
  dev_task: { view: "devtasks", section: "Devs" },
};

export function entitySearch(type, id) {
  const param = LINK_PARAMS[type];
  return param && id ? `?${param}=${encodeURIComponent(id)}` : "";
}

export function buildEntityLink(origin, type, id) {
  return `${origin}/${entitySearch(type, id)}`;
}

// "?ticket=tk_1" → { type: "ticket", id: "tk_1" }; null si no hay un link reconocible.
export function parseEntityLink(search) {
  const q = new URLSearchParams(search || "");
  for (const [type, param] of Object.entries(LINK_PARAMS)) {
    const v = q.get(param);
    if (v) return { type, id: v };
  }
  return null;
}

// Saca los parámetros de link y conserva cualquier otro (devuelve "" o "?a=b").
export function clearedSearch(search) {
  const q = new URLSearchParams(search || "");
  Object.values(LINK_PARAMS).forEach((p) => q.delete(p));
  const rest = q.toString();
  return rest ? `?${rest}` : "";
}
