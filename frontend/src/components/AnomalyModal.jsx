import React from "react";

export function AnomalyModal({ alertes, onContinue, onCancel }) {
  if (!alertes || alertes.length === 0) return null;

  const nbCritiques = alertes.filter((a) => a.niveau === "critique").length;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.65)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          maxWidth: 680,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(220, 38, 38, 0.35)",
          border: "2px solid #EF4444",
          overflow: "hidden",
        }}
      >
        {/* En-tête Rouge Alerte */}
        <div
          style={{
            background: "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)",
            color: "#fff",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 36, lineHeight: 1 }}>🚨</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.3px" }}>
              ANOMALIE(S) DÉTECTÉE(S) DANS VOS FICHIERS
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 3 }}>
              {alertes.length} point(s) d'attention identifié(s) avant calcul
              {nbCritiques > 0 ? ` (dont ${nbCritiques} bloquant${nbCritiques > 1 ? "s" : ""})` : ""}
            </div>
          </div>
        </div>

        {/* Corps avec la liste des anomalies */}
        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 14, fontWeight: 500 }}>
            Pour garantir la justesse du calcul des écarts matières, veuillez vérifier et corriger les anomalies ci-dessous dans votre fichier Excel :
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {alertes.map((a, idx) => {
              const isCritique = a.niveau === "critique";
              return (
                <div
                  key={idx}
                  style={{
                    background: isCritique ? "#FEF2F2" : "#FFFBEB",
                    border: isCritique ? "1.5px solid #F87171" : "1.5px solid #FBBF24",
                    borderRadius: 10,
                    padding: "13px 15px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span
                      style={{
                        background: isCritique ? "#DC2626" : "#D97706",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "2px 7px",
                        borderRadius: 5,
                        textTransform: "uppercase",
                      }}
                    >
                      {isCritique ? "🛑 CRITIQUE" : "⚠️ ATTENTION"}
                    </span>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: isCritique ? "#991B1B" : "#92400E",
                      }}
                    >
                      {a.titre}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: isCritique ? "#7F1D1D" : "#78350F", lineHeight: 1.5 }}>
                    {a.detail}
                  </div>

                  {a.emplacement && (
                    <div
                      style={{
                        marginTop: 8,
                        background: isCritique ? "#FEE2E2" : "#FEF3C7",
                        borderRadius: 6,
                        padding: "7px 10px",
                        fontSize: 12,
                        color: "#1F2937",
                        lineHeight: 1.5,
                        borderLeft: "3px solid #6B7280",
                      }}
                    >
                      <strong style={{ fontWeight: 700, color: "#374151" }}>
                        📍 Emplacement exact :
                      </strong>{" "}
                      {a.emplacement}
                    </div>
                  )}

                  {a.solution && (
                    <div
                      style={{
                        marginTop: 8,
                        background: "rgba(255, 255, 255, 0.8)",
                        borderRadius: 6,
                        padding: "7px 10px",
                        fontSize: 12,
                        color: "#1F2937",
                        lineHeight: 1.6,
                        borderLeft: isCritique ? "3px solid #DC2626" : "3px solid #D97706",
                      }}
                    >
                      <strong style={{ fontWeight: 700, color: isCritique ? "#DC2626" : "#D97706", whiteSpace: "nowrap" }}>
                        💡 Solution :
                      </strong>{" "}
                      {a.solution}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pied de modale / Boutons d'action */}
        <div
          style={{
            background: "#F9FAFB",
            borderTop: "1px solid #E5E7EB",
            padding: "14px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <button
            onClick={onContinue}
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              border: "1px solid #D1D5DB",
              background: "#fff",
              color: "#6B7280",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ⚠️ Ignorer et continuer quand même
          </button>

          <button
            onClick={onCancel}
            style={{
              padding: "10px 22px",
              borderRadius: 8,
              border: "none",
              background: "#DC2626",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 4px rgba(220, 38, 38, 0.25)",
            }}
          >
            <span>❌</span>
            <span>Annuler pour corriger mon fichier Excel</span>
          </button>
        </div>
      </div>
    </div>
  );
}