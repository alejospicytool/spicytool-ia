// Preferencias del menú lateral de cada usuario: en qué orden ve las secciones y cuáles dejó plegadas.
// Solo ordena y esconde NADA: qué secciones puede ver cada uno lo deciden los permisos (allowed_sections), no esto.
// Funciones puras (sin React ni Supabase): se prueban en menuPrefs.test.js.

export const MAX_LABELS = 40;
export const MAX_LABEL_LEN = 40;

// Deja solo textos razonables, sin repetir y respetando el orden en que vienen.
export function cleanLabels(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set(), out = [];
  for (const x of list) {
    if (typeof x !== "string") continue;
    const s = x.trim();
    if (!s || s.length > MAX_LABEL_LEN || seen.has(s)) continue;
    seen.add(s); out.push(s);
    if (out.length >= MAX_LABELS) break;
  }
  return out;
}

// Lo que llega de la base o del navegador puede venir roto: se normaliza siempre.
export function readPrefs(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return { order: cleanLabels(r.section_order ?? r.order), collapsed: cleanLabels(r.collapsed_sections ?? r.collapsed) };
}

// Ordena las secciones según lo guardado: primero las que están en el orden guardado (en ese orden) y después las demás
// (por ejemplo una sección nueva) en su orden de siempre. Una etiqueta guardada que ya no existe se ignora.
export function orderSections(sections, savedOrder) {
  const saved = cleanLabels(savedOrder), byLabel = new Map(sections.map((s) => [s.label, s]));
  const first = saved.filter((l) => byLabel.has(l)).map((l) => byLabel.get(l));
  const taken = new Set(first.map((s) => s.label));
  return [...first, ...sections.filter((s) => !taken.has(s.label))];
}

// Sube (-1) o baja (+1) una sección entre las que el usuario ve. Devuelve el nuevo orden completo de las visibles.
export function moveLabel(visibleLabels, label, dir) {
  const a = [...visibleLabels], i = a.indexOf(label), j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= a.length) return a;
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}

export const toggleLabel = (list, label) => (list.includes(label) ? list.filter((x) => x !== label) : [...list, label]);
