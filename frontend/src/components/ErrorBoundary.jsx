import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(e) {
    return { hasError: true, error: e };
  }
  componentDidCatch(e, info) {
    console.error("ErrorBoundary caught:", e, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, maxWidth: 700, margin: "60px auto", fontFamily: "Arial,sans-serif" }}>
          <div style={{ background: "#FEF2F2", border: "2px solid #FCA5A5", borderRadius: 14, padding: 28, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#DC2626", marginBottom: 8 }}>
              Une erreur s'est produite
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
              L'application a rencontré une erreur lors du traitement. Vos données sont préservées.
            </div>
            <div style={{ background: "#1E1E2E", borderRadius: 8, padding: "12px 16px", textAlign: "left", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontFamily: "Courier New", color: "#F87171", wordBreak: "break-all" }}>
                {this.state.error?.message || "Erreur inconnue"}
              </div>
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                background: "#D4531D",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                padding: "11px 28px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                marginRight: 10,
              }}
            >
              🔄 Réessayer
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#6B7280",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                padding: "11px 28px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ↺ Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
