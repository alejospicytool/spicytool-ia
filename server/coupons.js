// Cupones de Stripe que se pueden elegir en "Asignar plan". Se crean en Stripe (modo producción); sus ids no son secretos.
// Cada uno es: { id, code, label, percentOff | amountOff (centavos de USD), duration: "repeating" | "once" | "forever", months (si es "repeating") }.
//  · id   = el id del CÓDIGO PROMOCIONAL de Stripe (promo_…): es lo que se manda al webhook de Spicytool en el campo "coupon" (confirmado por Jonathan).
//  · code = el código corto que se ve en Stripe, solo como referencia para quien lo reconoce.
// Esta lista es lo ÚNICO que el formulario deja elegir: un cupón que no esté acá se rechaza, aunque exista en Stripe.
export const COUPONS = [
  { id: "promo_1Ub4mzJdCZldzCmGY6aZHFAE", code: "bJPgbdTg", label: "25% por 1 mes", percentOff: 25, duration: "repeating", months: 1 },
  { id: "promo_1Ub4pgJdCZldzCmGSZNkXcft", code: "inoWdr2i", label: "25% por 2 meses", percentOff: 25, duration: "repeating", months: 2 },
  { id: "promo_1Ub4taJdCZldzCmGwOPtV33o", code: "Tw11Cwyc", label: "50% por 1 mes", percentOff: 50, duration: "repeating", months: 1 },
  { id: "promo_1Ub57yJdCZldzCmGhSI4ccc6", code: "2ErId6OD", label: "50% por 2 meses", percentOff: 50, duration: "repeating", months: 2 },
  { id: "promo_1Ub5HCJdCZldzCmGkFIsN4SR", code: "wpdTyq50", label: "100% por 1 mes", percentOff: 100, duration: "repeating", months: 1 },
  { id: "promo_1Ub5IdJdCZldzCmGDGo3fVU9", code: "u0HHWiyp", label: "100% ilimitado (gratis para siempre)", percentOff: 100, duration: "forever" },
];
