// Roles de la app y qué puede hacer cada uno en las tablas de trabajo (tickets, tareas, tareas de devs, onboarding).
// La protección REAL está en la base (supabase_roles_editor.sql: can_write_ops / can_delete_ops); esto solo decide qué botones se muestran.
//   admin   todo.
//   dev     crea, edita y borra.
//   editor  crea y edita, no borra.
//   reader  solo lee.
export const ROLES = ["admin", "dev", "editor", "reader"];
export const ROLE_HELP = {
  admin: "Todo",
  dev: "Crea, edita y borra tickets, tareas y onboarding",
  editor: "Crea y edita tickets, tareas y onboarding, sin borrar",
  reader: "Solo lectura",
};
export const canWriteOps = (role) => role === "admin" || role === "dev" || role === "editor";
export const canDeleteOps = (role) => role === "admin" || role === "dev";
