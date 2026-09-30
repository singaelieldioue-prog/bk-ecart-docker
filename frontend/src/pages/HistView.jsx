import React from "react";
import { fmtDate } from "../utils/formatters.js";
import { ROLES } from "../constants.js";
import { WBdg } from "../components/UI.jsx";

export function HistView({ rapports, onOpen, onDelete, role, pagination, onLoadMore, loadingMore }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          📅 Historique des rapports
        </div>
        {pagination && (
          <div style={{ fontSize: 11, color: "#9CA3AF" }}>
            {rapports.length} / {pagination.total || rapports.length} rapport(s)
          </div>
        )}
      </div>
      {rapports.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: 40,
            textAlign: "center",
            color: "#9CA3AF",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          <div>Aucun rapport dans l'historique.</div>
        </div>
      ) : (
        <>
          {rapports.map((rap) => (
            <div
              key={rap.id}
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 9,
                padding: "11px 15px",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onOpen(rap.id)}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{rap.titre}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                  {fmtDate(rap.createdAt)} · {ROLES[rap.createdBy]?.short}
                </div>
              </div>
              <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                <WBdg status={rap.status} />
                {role === "cdg" && (
                  <button
                    onClick={() => onDelete(rap.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#DC2626",
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Bouton "Charger plus" */}
          {pagination?.hasMore && (
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                style={{
                  padding: "9px 24px",
                  borderRadius: 9,
                  border: "1px solid #D1D5DB",
                  background: loadingMore ? "#F3F4F6" : "#fff",
                  color: loadingMore ? "#9CA3AF" : "#374151",
                  cursor: loadingMore ? "default" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {loadingMore ? "⏳ Chargement…" : `Charger plus (${(pagination.total || 0) - rapports.length} restants)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
