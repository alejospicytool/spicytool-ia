// "Quien está logueado, primero": reordena una lista de personas para que la propia aparezca arriba en los selectores. Solo reordena: no elige nada por nadie.
import { sellerOfUser } from "./crm/crmMe.js";

// Lista de usuarios del backoffice (con user_id): la persona logueada va primera y el resto conserva su orden.
export function meFirstById(users, meId, idOf = (u) => u && u.user_id) {
  const list = users || [];
  if (!meId) return list;
  const mine = list.filter((u) => idOf(u) === meId);
  return mine.length ? [...mine, ...list.filter((u) => idOf(u) !== meId)] : list;
}

// Lista de nombres sueltos (equipo de Onboarding, vendedores del CRM): se encuentra "quién soy" por nombre o por mail ("Nico" ↔ Nicolás, "Hernán" ↔ hernan@…).
// Si no coincide con nadie (o con más de uno) la lista queda igual.
export function meFirstName(names, me) {
  const list = names || [];
  const mine = sellerOfUser(me, list);
  return mine ? [mine, ...list.filter((n) => n !== mine)] : list;
}
