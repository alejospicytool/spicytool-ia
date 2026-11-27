import { describe, it, expect } from "vitest";
import { meFirstById, meFirstName } from "./meFirst.js";

const users = [{ user_id: "a", name: "Alejo" }, { user_id: "n", name: "Nico" }, { user_id: "t", name: "Tici" }];
describe("meFirstById", () => {
  it("pone a la persona logueada primera y deja el resto en su orden", () => {
    expect(meFirstById(users, "n").map((u) => u.user_id)).toEqual(["n", "a", "t"]);
    expect(meFirstById(users, "t").map((u) => u.user_id)).toEqual(["t", "a", "n"]);
  });
  it("si ya es la primera, o no está en la lista, o no hay sesión: no cambia nada ni toca la lista original", () => {
    expect(meFirstById(users, "a")).toEqual(users);
    expect(meFirstById(users, "zzz")).toEqual(users);
    expect(meFirstById(users, null)).toEqual(users);
    expect(meFirstById(undefined, "a")).toEqual([]);
    const copy = [...users]; meFirstById(users, "n"); expect(users).toEqual(copy);
  });
});

describe("meFirstName", () => {
  const team = ["Nico", "Ticiana", "Lucas"];
  it("encuentra a la persona por nombre o mail y la sube primera", () => {
    expect(meFirstName(team, { first_name: "Nicolás", email: "nicolas@spicytool.net" })).toEqual(["Nico", "Ticiana", "Lucas"]);
    expect(meFirstName(team, { first_name: "Lucas", email: "escobedolucas123@gmail.com" })).toEqual(["Lucas", "Nico", "Ticiana"]);
    expect(meFirstName(["Hernán", "Alejo"], { first_name: "Alejo", email: "alejo@spicytool.net" })).toEqual(["Alejo", "Hernán"]);
    expect(meFirstName(team, { email: "ticiana@spicytool.net" })).toEqual(["Ticiana", "Nico", "Lucas"]);
  });
  it("si no está en la lista o no hay datos, queda igual", () => {
    expect(meFirstName(team, { first_name: "Joaco", email: "product@spicytool.net" })).toEqual(team);
    expect(meFirstName(team, null)).toEqual(team);
    expect(meFirstName(undefined, { first_name: "Nico" })).toEqual([]);
  });
});
