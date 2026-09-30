import React, { useState } from "react";
import { ROLES, WORKFLOW } from "../constants.js";
import { nowt, fmtDate } from "../utils/formatters.js";
import { WBdg, CModal } from "./UI.jsx";

export function WFPanel({ rapport, role, onAction }) {
  const [modal, setModal] = useState(null);
  const s = rapport.status;
  const canSDaf = role === "cdg" && s === "draft";
  const canADaf = role === "daf" && s === "submitted_to_daf";
  const canRDaf = role === "daf" && s === "submitted_to_daf";
  const canSDg = role === "daf" && s === "daf_approved";
  const canADg = role === "dg" && s === "submitted_to_dg";
  const canRDg = role === "dg" && s === "submitted_to_dg";
  const canRev = role === "cdg" && (s === "daf_rejected" || s === "dg_rejected");

  const doAct = (next, comm) => {
    onAction({ status: next, commentaire: comm, actor: role, at: nowt() });
    setModal(null);
  };

  const BS = (c) => ({
    padding: "7px 13px",
    border: "none",
    borderRadius: 7,
    background: c,
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  });

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13 }}>Circuit de validation</div>
        <WBdg status={s} />
      </div>

      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        {[
          {
            key: "cdg",
            label: "CDG",
            done: [
              "submitted_to_daf",
              "daf_approved",
              "daf_rejected",
              "submitted_to_dg",
              "dg_approved",
              "dg_rejected",
            ].includes(s),
          },
          {
            key: "daf",
            label: "DAF",
            done: ["daf_approved", "submitted_to_dg", "dg_approved", "dg_rejected"].includes(s),
            rej: s === "daf_rejected",
          },
          {
            key: "dg",
            label: "DG",
            done: s === "dg_approved",
            rej: s === "dg_rejected",
          },
        ].map((st, i, arr) => {
          const rc = ROLES[st.key];
          return (
            <div key={st.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: st.rej ? "#DC2626" : st.done ? "#059669" : rc.color,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {st.rej ? "✕" : st.done ? "✓" : st.label}
                </div>
                <div style={{ fontSize: 10, color: "#6B7280", marginTop: 3, textAlign: "center" }}>
                  <div style={{ fontWeight: 600 }}>{ROLES[st.key].short}</div>
                </div>
              </div>
              {i < arr.length - 1 && (
                <div
                  style={{
                    height: 2,
                    flex: 0.3,
                    background: st.done ? "#059669" : "#E5E7EB",
                    marginBottom: 16,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: 7,
          flexWrap: "wrap",
          marginBottom: rapport.history?.length ? 12 : 0,
        }}
      >
        {canSDaf && (
          <button
            onClick={() =>
              setModal({
                title: "Soumettre au DAF",
                placeholder: "Note...",
                actionLabel: "📤 Soumettre",
                color: "#2563EB",
                next: "submitted_to_daf",
              })
            }
            style={BS("#2563EB")}
          >
            📤 Soumettre au DAF
          </button>
        )}
        {canADaf && (
          <button
            onClick={() =>
              setModal({
                title: "Approuver",
                placeholder: "Commentaire...",
                actionLabel: "✅ Approuver",
                color: "#059669",
                next: "daf_approved",
              })
            }
            style={BS("#059669")}
          >
            ✅ Approuver
          </button>
        )}
        {canRDaf && (
          <button
            onClick={() =>
              setModal({
                title: "Rejeter",
                placeholder: "Motif du rejet...",
                actionLabel: "❌ Rejeter",
                color: "#DC2626",
                next: "daf_rejected",
              })
            }
            style={BS("#DC2626")}
          >
            ❌ Rejeter
          </button>
        )}
        {canSDg && (
          <button
            onClick={() =>
              setModal({
                title: "Soumettre au DG",
                placeholder: "Note DG...",
                actionLabel: "📤 Soumettre",
                color: "#7C3AED",
                next: "submitted_to_dg",
              })
            }
            style={BS("#7C3AED")}
          >
            📤 Soumettre au DG
          </button>
        )}
        {canADg && (
          <button
            onClick={() =>
              setModal({
                title: "Validation DG",
                placeholder: "Commentaire...",
                actionLabel: "✅ Valider",
                color: "#059669",
                next: "dg_approved",
              })
            }
            style={BS("#059669")}
          >
            ✅ Valider DG
          </button>
        )}
        {canRDg && (
          <button
            onClick={() =>
              setModal({
                title: "Rejeter DG",
                placeholder: "Motif...",
                actionLabel: "❌ Rejeter",
                color: "#DC2626",
                next: "dg_rejected",
              })
            }
            style={BS("#DC2626")}
          >
            ❌ Rejeter
          </button>
        )}
        {canRev && (
          <button onClick={() => doAct("draft", "Remis en brouillon.")} style={BS("#6B7280")}>
            ✏️ Corriger
          </button>
        )}
        {!canSDaf &&
          !canADaf &&
          !canRDaf &&
          !canSDg &&
          !canADg &&
          !canRDg &&
          !canRev && (
            <div style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>
              {s === "dg_approved"
                ? "✅ Validé définitivement."
                : "Aucune action pour votre rôle."}
            </div>
          )}
      </div>

      {rapport.history?.length > 0 && (
        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#9CA3AF",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Historique
          </div>
          {rapport.history.map((h, i) => (
            <div
              key={i}
              style={{ display: "flex", gap: 7, marginBottom: 5, alignItems: "flex-start" }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: ROLES[h.actor]?.color || "#9CA3AF",
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <div>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 11,
                    color: ROLES[h.actor]?.color,
                  }}
                >
                  {ROLES[h.actor]?.short}
                </span>
                <span style={{ fontSize: 11, color: "#6B7280" }}>
                  {" "}
                  — {WORKFLOW[h.status]?.label} — {fmtDate(h.at)}
                </span>
                {h.commentaire && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#374151",
                      marginTop: 1,
                      background: "#F9FAFB",
                      borderRadius: 4,
                      padding: "3px 7px",
                    }}
                  >
                    "{h.commentaire}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && <CModal {...modal} onConfirm={(c) => doAct(modal.next, c)} onCancel={() => setModal(null)} />}
    </div>
  );
}
