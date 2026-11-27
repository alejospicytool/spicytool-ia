// Quién es "yo" dentro del CRM: la persona logueada se asocia con uno de los vendedores de la lista del CRM (Hernán, Alejo…) por nombre o por mail,
// con la misma regla que el resto del backoffice ("Hernán" coincide con "Hernan" y con hernan@…). Si no coincide con nadie (o con más de uno)
// no se filtra nada: así Nico, que no es vendedor, sigue viendo todo.
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function sellerOfUser(me, sellers) {
  const first = norm(me && me.first_name), local = norm(String((me && me.email) || "").split("@")[0]);
  if (!first && !local) return "";
  const hits = (sellers || []).filter((s) => {
    const n = norm(s);
    if (!n) return false;
    return (!!first && (first === n || first.startsWith(n) || n.startsWith(first))) || (!!local && local.startsWith(n));
  });
  if (hits.length <= 1) return hits[0] || "";
  const exact = hits.filter((s) => norm(s) === first || norm(s) === local);
  return exact.length === 1 ? exact[0] : "";
}

// Filtro efectivo de una pestaña: lo que la persona eligió (incluido "" = todos) o, si todavía no eligió nada (null), sus propios ítems.
export const effectiveSeller = (chosen, mine) => (chosen === null || chosen === undefined ? mine : chosen);
