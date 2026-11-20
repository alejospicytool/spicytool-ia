// Cartel de confirmación para acciones que no se pueden deshacer (eliminar, quitar, borrar).
// Uso: `if (!(await askConfirm({ title: "Eliminar ticket", message: "…" }))) return;`
// Devuelve una promesa: true si la persona confirmó, false si canceló (botón, Escape o clic afuera).
// El cartel lo dibuja <ConfirmHost/> (una sola vez, en App.jsx). Acá no hay React, para poder probarlo con vitest.
let state = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function askConfirm({ title = "¿Eliminar?", message = "", confirmLabel = "Eliminar", danger = true } = {}) {
  return new Promise((resolve) => {
    if (state) state.resolve(false); // si ya había un cartel abierto, se cancela
    state = { title, message, confirmLabel, danger, resolve };
    emit();
  });
}
export function settleConfirm(answer) {
  if (!state) return;
  const s = state;
  state = null;
  emit();
  s.resolve(!!answer);
}
export const getConfirmState = () => state;
export function subscribeConfirm(fn) { listeners.add(fn); return () => listeners.delete(fn); }
