// Datos FICTICIOS para los tests del CRM (no son clientes reales).
export const NOW = new Date("2026-11-10T15:00:00Z"); // martes 10/11/2026 12:00 hora Argentina
export function fixture() {
  const S = {
    config: {
      mrrActual: 1000, metaMrr: 3000, metaMes: "2027-01", ticket: 200, churnPct: 0,
      stages: [
        { id: "lead", name: "Lead", prob: 10, kind: "open", color: "#ccc", rot: 5 },
        { id: "demo", name: "Demo agendada", prob: 30, kind: "open", color: "#bbb", rot: 7 },
        { id: "prop", name: "Propuesta", prob: 60, kind: "open", color: "#aaa", rot: 10 },
        { id: "nego", name: "Negociación", prob: 80, kind: "open", color: "#999", rot: 7 },
        { id: "won", name: "Ganado", prob: 100, kind: "won", color: "#888", rot: 0 },
        { id: "hold", name: "No show", prob: 0, kind: "hold", color: "#777", rot: 0 },
        { id: "lost", name: "Lost", prob: 0, kind: "lost", color: "#666", rot: 0 },
      ],
      tags: [{ id: "t1", name: "Equipo 2–5", group: "Tamaño", color: "#999" }, { id: "t2", name: "Planilla", group: "CRM actual", color: "#999" }],
      sellers: ["Ana", "Beto"], countries: ["Argentina"], types: ["Inmobiliaria", "Otro"], sources: ["Evento"], partners: ["Partner X"],
      lostReasons: ["Precio", "Otro"], churnReasons: ["Precio"], acciones: ["Follow up", "Llamar"],
      waTemplates: { "Follow up": "Hola {nombre}, de {vendedor} para {empresa}", _general: "Hola {nombre}" },
    },
    deals: [
      { id: "a", empresa: "Empresa Alfa", contacto: "Juan Pérez", vendedor: "Ana", stage: "nego", mrr: 400, plan: "Mensual", cierre: "2026-12", proxima: "Follow up", proximaFecha: "2026-11-09", proximaHora: "10:00", proximaTipo: "followup", tags: ["t1"], stageSince: "2026-11-01", trail: [{ s: "lead", at: "2026-10-20" }, { s: "nego", at: "2026-11-01" }], hist: [], telefono: "+54 9 341 555 1234", promoMrr: 0, promoMeses: 0 },
      { id: "b", empresa: "Empresa Beta", contacto: "", vendedor: "Beto", stage: "prop", mrr: 200, plan: "Mensual", cierre: "2026-11", proxima: "", proximaFecha: "", tags: [], stageSince: "2026-11-09", trail: [{ s: "prop", at: "2026-11-09" }], hist: [], promoMrr: 0, promoMeses: 0 },
      { id: "c", empresa: "Empresa Gamma", contacto: "Lu", vendedor: "Ana", stage: "lead", mrr: 100, plan: "Mensual", cierre: "2027-02", proxima: "Llamar", proximaFecha: "2026-11-12", proximaHora: "09:00", proximaTipo: "followup", tags: [], stageSince: "2026-11-10", trail: [{ s: "lead", at: "2026-11-10" }], hist: [], promoMrr: 0, promoMeses: 0 },
      // cliente ganado, ya pagó, con promo de 2 meses (120 → 300) desde nov
      { id: "w1", empresa: "Cliente Uno", contacto: "Ro", vendedor: "Ana", stage: "won", mrr: 300, plan: "Mensual", cierre: "2026-11", estado: "activo", cobro: "Stripe", salud: "bien", promoMrr: 120, promoMeses: 2, cerradoEn: "2026-10-30", stageSince: "2026-10-30", trail: [{ s: "won", at: "2026-10-30" }], hist: [{ t: "2026-11-05T12:00:00.000Z", x: "Estado: Activo" }] },
      // cliente ganado esperando pago
      { id: "w2", empresa: "Cliente Dos", contacto: "", vendedor: "Beto", stage: "won", mrr: 150, plan: "Anual", cierre: "2026-12", estado: "pago", estadoDesde: "2026-11-01", cobro: "Transferencia", salud: "riesgo", promoMrr: 0, promoMeses: 0, cerradoEn: "2026-11-01", stageSince: "2026-11-01", trail: [{ s: "won", at: "2026-11-01" }], hist: [] },
      { id: "l1", empresa: "Perdido Uno", contacto: "", vendedor: "Ana", stage: "lost", mrr: 250, plan: "Mensual", cierre: "2026-12", motivo: "Precio", motivoDetalle: "", cerradoEn: "2026-11-08", stageSince: "2026-11-08", trail: [{ s: "lost", at: "2026-11-08" }], hist: [], promoMrr: 0, promoMeses: 0, proxima: "Llamar", proximaFecha: "2026-11-20" },
    ],
    tasks: [
      { id: "t_1", titulo: "Hacer demo", tipo: "reunion", fecha: "2026-11-10", hora: "16:00", dealId: "a", vendedor: "Ana", notas: "", hecha: false },
      { id: "t_2", titulo: "Mandar contrato", tipo: "tarea", fecha: "2026-11-05", hora: "09:00", dealId: "", vendedor: "Beto", notas: "", hecha: false },
      { id: "t_3", titulo: "Vieja", tipo: "tarea", fecha: "2026-11-01", hora: "09:00", dealId: "", vendedor: "Beto", notas: "", hecha: true, hechaEn: "2026-11-01" },
    ],
  };
  S.deals.forEach((d) => { if (d.notas === undefined) d.notas = ""; });
  return S;
}
