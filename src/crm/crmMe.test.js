import { describe, it, expect } from "vitest";
import { sellerOfUser, effectiveSeller } from "./crmMe.js";

const SELLERS = ["Hernán", "Alejo"];
describe("sellerOfUser", () => {
  it("reconoce al vendedor por nombre (con o sin tilde) o por mail", () => {
    expect(sellerOfUser({ first_name: "Hernan", email: "hernan@spicytool.net" }, SELLERS)).toBe("Hernán");
    expect(sellerOfUser({ first_name: "Alejo", email: "alejo@spicytool.net" }, SELLERS)).toBe("Alejo");
    expect(sellerOfUser({ email: "hernan@spicytool.net" }, SELLERS)).toBe("Hernán");
    expect(sellerOfUser({ first_name: "Hernán" }, SELLERS)).toBe("Hernán");
  });
  it("quien no es vendedor (o no tiene datos) no queda filtrado", () => {
    expect(sellerOfUser({ first_name: "Nico", email: "nicolas@spicytool.net" }, SELLERS)).toBe("");
    expect(sellerOfUser({ first_name: "Tici", email: "marketing@spicytool.net" }, SELLERS)).toBe("");
    expect(sellerOfUser(null, SELLERS)).toBe("");
    expect(sellerOfUser({}, SELLERS)).toBe("");
    expect(sellerOfUser({ first_name: "Hernan" }, [])).toBe("");
    expect(sellerOfUser({ first_name: "Hernan" }, undefined)).toBe("");
  });
  it("con dos coincidencias elige solo si una se llama exactamente así; si no, ninguna", () => {
    expect(sellerOfUser({ first_name: "Ale", email: "ale@x.com" }, ["Alejo", "Alejandra"])).toBe("");
    expect(sellerOfUser({ first_name: "Alejo", email: "alejo@x.com" }, ["Alejo", "Alejandro"])).toBe("Alejo");
  });
});

describe("effectiveSeller", () => {
  it("sin elección usa la propia; si la persona eligió algo (incluso 'todos') se respeta", () => {
    expect(effectiveSeller(null, "Hernán")).toBe("Hernán");
    expect(effectiveSeller(undefined, "Hernán")).toBe("Hernán");
    expect(effectiveSeller("", "Hernán")).toBe("");
    expect(effectiveSeller("Alejo", "Hernán")).toBe("Alejo");
    expect(effectiveSeller(null, "")).toBe("");
  });
});
