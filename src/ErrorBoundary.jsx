// Red de seguridad: si una pantalla falla al dibujarse, el error queda contenido ahí (con un mensaje y un botón para reintentar)
// en vez de dejar TODA la app en blanco. `resetKey` hace que se limpie solo al cambiar de pantalla.
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Pantalla con error:", error, info && info.componentStack); }
  componentDidUpdate(prev) { if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    const full = !!this.props.fullPage;
    return (
      <div role="alert" style={{ padding: full ? "4rem 1.5rem" : "2.5rem 1rem", textAlign: "center", minHeight: full ? "100vh" : undefined, boxSizing: "border-box", background: full ? "#F7F7F8" : undefined }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#111", marginBottom: 8 }}>Esta pantalla tuvo un problema</div>
        <div style={{ fontSize: 13, color: "#666", maxWidth: 460, margin: "0 auto 16px", lineHeight: 1.5 }}>
          {full ? "Algo falló y no se pudo mostrar la aplicación." : "El resto del backoffice sigue funcionando: podés cambiar de sección desde el menú."} Si se repite, mandanos una captura con este mensaje.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="spicy-btn-primary" onClick={() => (full ? window.location.reload() : this.setState({ error: null }))}>{full ? "Recargar" : "Reintentar"}</button>
        </div>
        <details style={{ marginTop: 18, fontSize: 12, color: "#999" }}>
          <summary style={{ cursor: "pointer" }}>Detalle técnico</summary>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "left", maxWidth: 560, margin: "8px auto 0", color: "#888" }}>{String((this.state.error && this.state.error.message) || this.state.error)}</pre>
        </details>
      </div>
    );
  }
}
