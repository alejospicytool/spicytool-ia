// Hooks de "Admin Spicy".
import { useEffect, useState } from "react";

// Carga asíncrona atada a una clave: mientras la clave cambia devuelve { loading: true }; el resultado viejo nunca se muestra.
export function useAsync(fn, key) {
  const [s, setS] = useState({ key: null });
  useEffect(() => {
    let off = false;
    fn().then((data) => { if (!off) setS({ key, data }); }, (e) => { if (!off) setS({ key, error: e.message || String(e) }); });
    return () => { off = true; };
    // fn se recrea en cada render; la clave es lo que identifica la consulta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return s.key === key ? { loading: false, data: s.data, error: s.error } : { loading: true };
}
