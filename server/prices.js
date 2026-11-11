// Precios ESTÁNDAR de los cuatro planes (Stripe, cuenta Spicytool LLC, modo real, consultados el 2026-11-11).
// Los ids de precio no son secretos y el monto de un precio de Stripe no se puede editar (si cambia, se crea otro precio y se actualiza acá).
// Los precios negociados o de promoción no están acá: se pegan a mano en el formulario ("Otro precio"). El webhook valida cualquier precio.
export const STANDARD_PRICES = [
  { id: "price_1UTlMwJdCZldzCmGANZ9ocnQ", plan: "SpicyOne", nickname: "Estándar", amount: 10000, currency: "usd", interval: "month", active: true },
  { id: "price_1UTMSbJdCZldzCmG6aBKTABw", plan: "SpicyStart", nickname: "Estándar", amount: 20000, currency: "usd", interval: "month", active: true },
  { id: "price_1UTMSrJdCZldzCmGg8bgtWwm", plan: "SpicyPro", nickname: "Estándar", amount: 40000, currency: "usd", interval: "month", active: true },
  { id: "price_1UTMTAJdCZldzCmG7PiPkQb7", plan: "SpicyProMax", nickname: "Estándar", amount: 60000, currency: "usd", interval: "month", active: true },
];
