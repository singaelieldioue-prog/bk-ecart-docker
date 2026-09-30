import React from "react";
import { fmt, pct } from "../utils/formatters.js";
import { SEUILS } from "../constants.js";
import { KCard, Bdg, TH, TD } from "../components/UI.jsx";

export function RapportMultiRestaurants({ calc }) {
  const pr = calc.parRestaurant || [];
  const seM =
    calc.ecartMatiereP == null
      ? "danger"
      : calc.ecartMatiereP < 0
      ? "danger"
      : calc.ecartMatiereP <= SEUILS.excellent
      ? "excellent"
      : calc.ecartMatiereP <= SEUILS.ameliorer
      ? "warning"
      : "danger";

  return (
    <div>
      {/* Synthèse réseau */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#9CA3AF",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Synthèse réseau — {pr.length} restaurant(s)
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <KCard label="Variation de stock (réseau)" value={fmt(calc.variationStock) + " FCFA"} />
        <KCard label="Transferts AGL → BK (réseau)" value={fmt(calc.totalEntrees) + " FCFA"} />
        <KCard label="Conso. réelle réseau" value={fmt(calc.consoReelle) + " FCFA"} />
        <KCard label="Conso. théorique réseau" value={fmt(calc.consoTheoTotal) + " FCFA"} />
        <KCard
          label="Écart matières réseau"
          value={fmt(calc.ecartMatiere) + " FCFA"}
          sub={pct(calc.ecartMatiereP)}
          s={seM}
        />
        <KCard label="Couverts réseau" value={fmt(calc.couverts, 0)} />
      </div>

      {/* Tableau par restaurant */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#9CA3AF",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Détail par restaurant
      </div>
      <div
        style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 10,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[
                "Restaurant",
                "Conso réelle",
                "Conso théo",
                "Écart FCFA",
                "Écart %",
                "Statut",
                "Couverts",
                "Pertes",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    ...TH,
                    textAlign: [
                      "Conso réelle",
                      "Conso théo",
                      "Écart FCFA",
                      "Écart %",
                      "Couverts",
                      "Pertes",
                    ].includes(h)
                      ? "right"
                      : "left",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pr.map((r, i) => {
              const s =
                r.ecartMatiereP == null
                  ? "danger"
                  : r.ecartMatiereP < 0
                  ? "danger"
                  : r.ecartMatiereP <= SEUILS.excellent
                  ? "excellent"
                  : r.ecartMatiereP <= SEUILS.ameliorer
                  ? "warning"
                  : "danger";
              const bg = i % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
              return (
                <tr key={i} style={{ background: bg }}>
                  <td style={{ ...TD, fontWeight: 700, color: "#D4531D" }}>{r.site}</td>
                  <td style={{ ...TD, textAlign: "right" }}>{fmt(r.consoReelle)}</td>
                  <td style={{ ...TD, textAlign: "right" }}>{fmt(r.consoTheoTotal)}</td>
                  <td
                    style={{
                      ...TD,
                      textAlign: "right",
                      fontWeight: 700,
                      color: r.ecartMatiere > 0 ? "#DC2626" : r.ecartMatiere < 0 ? "#D97706" : "#059669",
                    }}
                  >
                    {fmt(r.ecartMatiere)}
                  </td>
                  <td
                    style={{
                      ...TD,
                      textAlign: "right",
                      fontWeight: 700,
                      color: s === "excellent" ? "#059669" : s === "warning" ? "#D97706" : "#DC2626",
                    }}
                  >
                    {r.ecartMatiereP != null ? pct(r.ecartMatiereP) : "—"}
                  </td>
                  <td style={TD}>
                    <Bdg s={s}>
                      {s === "excellent"
                        ? "✅ Excellent"
                        : s === "warning"
                        ? "⚠️ À améliorer"
                        : "🔴 Non atteint"}
                    </Bdg>
                  </td>
                  <td style={{ ...TD, textAlign: "right" }}>{fmt(r.couverts, 0)}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#DC2626" }}>{fmt(r.totalPertes)}</td>
                </tr>
              );
            })}
            {/* Ligne totaux */}
            <tr
              style={{
                background:
                  seM === "excellent" ? "#ECFDF5" : seM === "warning" ? "#FFFBEB" : "#FEF2F2",
              }}
            >
              <td style={{ ...TD, fontWeight: 800, color: "#D4531D" }}>TOTAL RÉSEAU</td>
              <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{fmt(calc.consoReelle)}</td>
              <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{fmt(calc.consoTheoTotal)}</td>
              <td
                style={{
                  ...TD,
                  textAlign: "right",
                  fontWeight: 800,
                  color: calc.ecartMatiere > 0 ? "#DC2626" : "#059669",
                }}
              >
                {fmt(calc.ecartMatiere)}
              </td>
              <td
                style={{
                  ...TD,
                  textAlign: "right",
                  fontWeight: 800,
                  color: seM === "excellent" ? "#059669" : seM === "warning" ? "#D97706" : "#DC2626",
                }}
              >
                {pct(calc.ecartMatiereP)}
              </td>
              <td style={TD}>
                <Bdg s={seM}>
                  {seM === "excellent"
                    ? "✅ Excellent"
                    : seM === "warning"
                    ? "⚠️ À améliorer"
                    : "🔴 Non atteint"}
                </Bdg>
              </td>
              <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{fmt(calc.couverts, 0)}</td>
              <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: "#DC2626" }}>
                {fmt(calc.totalPertes)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
