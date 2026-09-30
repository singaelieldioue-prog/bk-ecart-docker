import React, { useState, useEffect } from "react";
import { fmt, pct, fmtDate } from "../utils/formatters.js";
import { TH, TD } from "../components/UI.jsx";
import * as api from "../api.js";

export function ComparaisonTab({ rapport, rapports }) {
  const [compareId, setCompareId] = useState("");
  const [calcN1, setCalcN1] = useState(null);
  const [loadingN1, setLoadingN1] = useState(false);
  const [loadErr, setLoadErr] = useState(null);

  const rapportsPrecedents = rapports.filter(
    (r) => r.id !== rapport.id && r.data?.calc?.ecartMatiereP != null && r.status === "dg_approved"
  );
  const calcN = rapport.data?.calc;

  useEffect(() => {
    if (!compareId) {
      setCalcN1(null);
      setLoadErr(null);
      return;
    }
    const cached = rapports.find((r) => String(r.id) === String(compareId));
    const lean = cached?.data?.calc;
    const hasFullKpis = lean && lean.totalValIni != null && lean.totalPertes != null;
    if (hasFullKpis) {
      setCalcN1(lean);
      setLoadErr(null);
      return;
    }
    let cancelled = false;
    setLoadingN1(true);
    setLoadErr(null);
    api
      .getReport(compareId)
      .then((full) => {
        if (!cancelled) setCalcN1(full?.data?.calc || null);
      })
      .catch((e) => {
        if (!cancelled) {
          setCalcN1(null);
          setLoadErr(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingN1(false);
      });
    return () => {
      cancelled = true;
    };
  }, [compareId, rapports]);

  const delta = (vN, vN1) => (vN != null && vN1 != null ? vN - vN1 : null);
  const DeltaBdg = ({ v, invert = false }) => {
    if (v == null) return <span style={{ color: "#9CA3AF" }}>—</span>;
    const pos = invert ? v < 0 : v > 0;
    return (
      <span style={{ fontWeight: 700, color: pos ? "#DC2626" : "#059669" }}>
        {v > 0 ? "+" : ""}
        {(v * 100).toFixed(2)} pts
      </span>
    );
  };

  return (
    <div>
      <div
        style={{
          background: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 14,
          fontSize: 11,
          color: "#1D4ED8",
        }}
      >
        📊 Comparez ce rapport avec un rapport précédent <strong>validé DG</strong> pour suivre l'évolution de votre performance.
      </div>

      {rapportsPrecedents.length === 0 ? (
        <div
          style={{
            background: "#F9FAFB",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            padding: 24,
            textAlign: "center",
            color: "#9CA3AF",
            fontSize: 12,
          }}
        >
          Aucun rapport précédent validé DG disponible pour comparaison.<br />
          Les rapports apparaîtront ici une fois validés par le DG.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Comparer avec :</div>
            <select
              value={compareId}
              onChange={(e) => setCompareId(e.target.value)}
              style={{
                flex: 1,
                padding: "7px 10px",
                border: "1px solid #D1D5DB",
                borderRadius: 7,
                fontSize: 12,
                background: "#fff",
                outline: "none",
              }}
            >
              <option value="">-- Sélectionner un rapport --</option>
              {rapportsPrecedents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.titre} · {fmtDate(r.createdAt)}
                </option>
              ))}
            </select>
          </div>

          {loadingN1 && (
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>Chargement du rapport N-1…</div>
          )}

          {compareId && !loadingN1 && calcN && calcN1 && (
            <div>
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
                      <th style={TH}>Indicateur</th>
                      <th style={{ ...TH, textAlign: "right", color: "#D4531D" }}>
                        Période N (actuel)
                      </th>
                      <th style={{ ...TH, textAlign: "right", color: "#7C3AED" }}>Période N-1</th>
                      <th style={{ ...TH, textAlign: "right" }}>Évolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Consommation réelle (FCFA)", vN: calcN.consoReelle, vN1: calcN1.consoReelle, pct: false },
                      { label: "Consommation théorique (FCFA)", vN: calcN.consoTheoTotal, vN1: calcN1.consoTheoTotal, pct: false },
                      { label: "Écart matières (FCFA)", vN: calcN.ecartMatiere, vN1: calcN1.ecartMatiere, pct: false, invert: true },
                      { label: "Écart matières (%)", vN: calcN.ecartMatiereP, vN1: calcN1.ecartMatiereP, pct: true, invert: true },
                      { label: "Couverts vendus", vN: calcN.couverts, vN1: calcN1.couverts, pct: false },
                      { label: "Stock initial (FCFA)", vN: calcN.totalValIni, vN1: calcN1.totalValIni, pct: false },
                      { label: "Transferts AGL (FCFA)", vN: calcN.totalEntrees, vN1: calcN1.totalEntrees, pct: false },
                      { label: "Pertes valorisées (FCFA)", vN: calcN.totalPertes, vN1: calcN1.totalPertes, pct: false, invert: true },
                      { label: "PLU matchés", vN: calcN.ficheMatchees, vN1: calcN1.ficheMatchees, pct: false },
                    ].map(({ label, vN, vN1, pct: isPct, invert }, i) => {
                      const d = delta(vN, vN1);
                      const dPct = vN1 && vN1 !== 0 ? d / Math.abs(vN1) : null;
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F9FAFB" }}>
                          <td style={{ ...TD, fontWeight: 500 }}>{label}</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: "#D4531D" }}>
                            {isPct ? pct(vN) : fmt(vN, 0)}
                          </td>
                          <td style={{ ...TD, textAlign: "right", color: "#7C3AED" }}>
                            {isPct ? pct(vN1) : fmt(vN1, 0)}
                          </td>
                          <td style={{ ...TD, textAlign: "right" }}>
                            {isPct ? (
                              <DeltaBdg v={d} invert={invert} />
                            ) : d != null ? (
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: (invert ? d < 0 : d > 0) ? "#059669" : "#DC2626",
                                }}
                              >
                                {d > 0 ? "+" : ""}
                                {fmt(d, 0)}
                                {dPct != null ? ` (${dPct > 0 ? "+" : ""}${(dPct * 100).toFixed(1)}%)` : ""}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: 10,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: "#059669", marginBottom: 8 }}>
                  🔍 Analyse automatique N vs N-1
                </div>
                {calcN.ecartMatiereP != null &&
                  calcN1.ecartMatiereP != null &&
                  (() => {
                    const d = (calcN.ecartMatiereP - calcN1.ecartMatiereP) * 100;
                    return (
                      <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.7 }}>
                        {d < 0
                          ? `✅ L'écart matières s'est amélioré de ${Math.abs(d).toFixed(2)} points par rapport à la période précédente.`
                          : d > 0
                          ? `⚠️ L'écart matières s'est dégradé de ${d.toFixed(2)} points. Une analyse des articles en écart est recommandée.`
                          : "➡️ L'écart matières est stable par rapport à la période précédente."}
                        {calcN.couverts > calcN1.couverts
                          ? ` Le volume de couverts a augmenté (+${fmt(calcN.couverts - calcN1.couverts, 0)} couverts).`
                          : calcN.couverts < calcN1.couverts
                          ? ` Le volume de couverts a diminué (${fmt(calcN.couverts - calcN1.couverts, 0)} couverts).`
                          : ""}
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}

          {compareId && !loadingN1 && (!calcN || !calcN1) && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 11,
                color: "#DC2626",
              }}
            >
              {loadErr
                ? `Impossible de charger les données de comparaison : ${loadErr}`
                : "Impossible de charger les données de comparaison. Le rapport sélectionné ne contient pas de calculs."}
            </div>
          )}
        </>
      )}
    </div>
  );
}
