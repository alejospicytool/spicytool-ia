import { describe, it, expect } from "vitest";
import { displayStatus, validateIdea, validateImage, safeFileName, voteCount, hasVoted, sortIdeas, canEditIdea, buildDevTask, typeInfo, IMAGES_MAX, IMAGE_MAX_BYTES } from "./ideasLogic.js";

describe("displayStatus", () => {
  it("las ideas no enviadas se ven en su columna", () => {
    for (const s of ["nueva", "evaluacion", "descartada"]) expect(displayStatus({ status: s }, null)).toEqual({ column: s, detail: null });
  });
  it("enviada: sigue la etapa de su tarea de dev", () => {
    const idea = { status: "enviada", dev_task_id: "dt1" };
    expect(displayStatus(idea, { stage: "Backlog" })).toEqual({ column: "enviada", detail: "En el backlog" });
    expect(displayStatus(idea, { stage: "In Progress" })).toEqual({ column: "enviada", detail: "En desarrollo" });
    expect(displayStatus(idea, { stage: "Testing" })).toEqual({ column: "enviada", detail: "En pruebas" });
  });
  it("cuando la tarea llega a Done, la idea figura como Hecha sola", () => {
    expect(displayStatus({ status: "enviada", dev_task_id: "dt1" }, { stage: "Done" })).toEqual({ column: "hecha", detail: "Terminada" });
  });
  it("si la tarea se borró sigue en Devs y avisa", () => {
    expect(displayStatus({ status: "enviada", dev_task_id: "dt1" }, undefined)).toEqual({ column: "enviada", detail: "La tarea ya no existe en Devs" });
    expect(displayStatus({ status: "enviada", dev_task_id: null }, undefined)).toEqual({ column: "enviada", detail: null });
  });
  it("una tarea que no está enviada nunca figura como hecha aunque se pase una tarea", () => {
    expect(displayStatus({ status: "nueva" }, { stage: "Done" }).column).toBe("nueva");
    expect(displayStatus(null, null).column).toBe("nueva");
  });
});

describe("validateIdea", () => {
  const ok = { title: "  Exportar contactos   a Excel ", description: " Que se pueda bajar la lista ", type: "funcion", requestedBy: " Marcos de Inmo X " };
  it("limpia espacios y devuelve el valor listo para guardar", () => {
    expect(validateIdea(ok)).toEqual({ ok: true, errors: {}, value: { title: "Exportar contactos a Excel", description: "Que se pueda bajar la lista", type: "funcion", requested_by: "Marcos de Inmo X" } });
  });
  it("descripción y pedido por son opcionales (quedan en null)", () => {
    expect(validateIdea({ title: "Idea corta", type: "mejora" }).value).toMatchObject({ description: null, requested_by: null });
  });
  it("exige título, tipo válido y respeta los máximos", () => {
    expect(validateIdea({ ...ok, title: "ab" }).errors.title).toBeTruthy();
    expect(validateIdea({ ...ok, title: "x".repeat(121) }).errors.title).toBeTruthy();
    expect(validateIdea({ ...ok, type: "otra" }).errors.type).toBeTruthy();
    expect(validateIdea({ ...ok, description: "x".repeat(4001) }).errors.description).toBeTruthy();
    expect(validateIdea({ ...ok, requestedBy: "x".repeat(121) }).errors.requestedBy).toBeTruthy();
  });
});

describe("validateImage", () => {
  const f = (type, size = 1000) => ({ type, size, name: "a" });
  it("acepta imágenes y PDF", () => { for (const t of ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]) expect(validateImage(f(t))).toBe(""); });
  it("rechaza otros tipos, archivos enormes y pasarse del máximo", () => {
    expect(validateImage(f("video/mp4"))).toMatch(/Solo se aceptan/);
    expect(validateImage(f("image/png", IMAGE_MAX_BYTES + 1))).toMatch(/20 MB/);
    expect(validateImage(f("image/png"), IMAGES_MAX)).toMatch(/hasta/);
    expect(validateImage(null)).toBeTruthy();
  });
  it("nombre de archivo seguro para guardar", () => {
    expect(safeFileName("Captura de pantalla ñandú (1).png")).toBe("Captura_de_pantalla_nandu_1_.png");
    expect(safeFileName("")).toBe("archivo");
    expect(safeFileName("a".repeat(200)).length).toBe(80);
  });
});

describe("votos y orden", () => {
  const votes = [{ idea_id: "a", user_id: "u1" }, { idea_id: "a", user_id: "u2" }, { idea_id: "b", user_id: "u1" }];
  it("cuenta y detecta el voto propio", () => {
    expect(voteCount(votes, "a")).toBe(2); expect(voteCount(votes, "zzz")).toBe(0); expect(voteCount(undefined, "a")).toBe(0);
    expect(hasVoted(votes, "a", "u1")).toBe(true); expect(hasVoted(votes, "b", "u2")).toBe(false); expect(hasVoted(votes, "a", null)).toBe(false);
  });
  it("más votadas primero; a igual cantidad, las más nuevas; no modifica el original", () => {
    const ideas = [{ id: "c", created_at: "2026-11-01" }, { id: "b", created_at: "2026-11-05" }, { id: "a", created_at: "2026-10-01" }, { id: "d", created_at: "2026-11-10" }];
    expect(sortIdeas(ideas, votes).map((i) => i.id)).toEqual(["a", "b", "d", "c"]);
    expect(ideas[0].id).toBe("c");
  });
});

describe("permisos del autor y tarea de dev", () => {
  it("el autor edita la suya solo mientras sea nueva", () => {
    expect(canEditIdea({ author_id: "u1", status: "nueva" }, "u1")).toBe(true);
    expect(canEditIdea({ author_id: "u1", status: "evaluacion" }, "u1")).toBe(false);
    expect(canEditIdea({ author_id: "u1", status: "nueva" }, "u2")).toBe(false);
    expect(canEditIdea(null, "u1")).toBe(false);
  });
  it("la tarea de dev lleva el título, la explicación y de dónde viene", () => {
    const t = buildDevTask({ title: "Exportar a Excel", description: "Que se pueda bajar la lista", type: "feedback", author_email: "tici@spicytool.net", created_at: "2026-11-20T10:00:00Z", requested_by: "Marcos de Inmo X" }, { votes: 3, images: 2 });
    expect(t.title).toBe("Exportar a Excel");
    expect(t.description).toContain("Que se pueda bajar la lista");
    for (const x of ['Viene de "Ideas y feedback"', "Tipo: Feedback de cliente", "Cargada por: tici el 20/11/2026", "Pedida por: Marcos de Inmo X", "Votos: 3", "Imágenes adjuntas: 2"]) expect(t.description).toContain(x);
  });
  it("sin descripción, pedido por, votos ni imágenes no inventa nada", () => {
    const d = buildDevTask({ title: "X", type: "mejora", author_email: "a@b.c", created_at: "2026-11-20T10:00:00Z" }).description;
    expect(d).not.toMatch(/Pedida por|Votos|Imágenes/);
    expect(d.startsWith("— Viene")).toBe(true);
  });
  it("tipo desconocido no rompe", () => { expect(typeInfo("rara").label).toBe("rara"); });
});
