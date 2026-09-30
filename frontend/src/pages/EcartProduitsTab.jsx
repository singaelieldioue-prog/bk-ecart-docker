import React, { useState } from "react";
import { fmt } from "../utils/formatters.js";
import { TH, TD } from "../components/UI.jsx";

export function EcartProduitsTab({ arts, cats }) {
  const [search, setSearch] = useState("");
  const [catF, setCatF] = useState("Toutes");
  const [showFCFA, setShowFCFA] = useState(false);
  const [sortKey, setSortKey] = useState("nom"); // nom | ecart | categorie
  const [sortDir, setSortDir] = useState(1); // 1 asc / -1 desc

  const filtered = arts
    .filter((a) => {
      if (catF !== "Toutes" && a.categorie !== catF) return false;
      if (search && !a.nom.toUpperCase().includes(search.toUpperCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "nom") return sortDir * a.nom.localeCompare(b.nom);
      if (sortKey === "categorie") return sortDir * (a.categorie || "").localeCompare(b.categorie || "");
      if (sortKey === "ecart") return sortDir * ((a.ecartPieces || 0) - (b.ecartPieces || 0));
      if (sortKey === "ecartVal") return sortDir * ((a.ecartVal || 0) - (b.ecartVal || 0));
      return 0;
    });

  const toggle = (key) => {
    if (sortKey === key) setSortDir((d) => -d);
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const SortBtn = ({ k, label }) => (
    <span
      onClick={() => toggle(k)}
      style={{
        cursor: "pointer",
        userSelect: "none",
        color: sortKey === k ? "#D4531D" : "inherit",
        fontWeight: sortKey === k ? 700 : 600,
      }}
    >
      {label}
      {sortKey === k ? (sortDir === 1 ? " ↑" : " ↓") : ""}
    </span>
  );

  return (
    <div>
      {/* Barre d'outils */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Rechercher un article..."
          style={{
            flex: "1 1 180px",
            padding: "6px 10px",
            border: "1px solid #D1D5DB",
            borderRadius: 7,
            fontSize: 12,
            outline: "none",
          }}
        />
        <select
          value={catF}
          onChange={(e) => setCatF(e.target.value)}
          style={{
            padding: "6px 9px",
            border: "1px solid #D1D5DB",
            borderRadius: 7,
            fontSize: 12,
            background: "#fff",
          }}
        >
          <option>Toutes</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {/* Bouton FCFA optionnel (R-03) */}
        <button
          onClick={() => setShowFCFA((p) => !p)}
          style={{
            padding: "6px 12px",
            border: `1px solid ${showFCFA ? "#D4531D" : "#D1D5DB"}`,
            borderRadius: 7,
            fontSize: 12,
            background: showFCFA ? "#FFF3EE" : "#fff",
            color: showFCFA ? "#D4531D" : "#374151",
            cursor: "pointer",
            fontWeight: showFCFA ? 700 : 400,
          }}
        >
          {showFCFA ? "✅ FCFA affiché" : "Afficher FCFA"}
        </button>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginLeft: "auto" }}>
          {filtered.length} article(s)
        </div>
      </div>

      {/* Note explicative (R-07 v3.0) */}
      <div
        style={{
          background: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderRadius: 8,
          padding: "8px 12px",
          marginBottom: 10,
          fontSize: 11,
          color: "#1D4ED8",
        }}
      >
        📌 <strong>RG-07 v3.0</strong> — Stock théorique = Ini + Transferts − Ventes théoriques (PMIX × recette) − Pertes déclarées · Écart = Stock théo − Inventaire final réel
      </div>

      {/* Tableau principal */}
      <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...TH, fontSize: 10 }}>
                <SortBtn k="categorie" label="Cat." />
              </th>
              <th style={{ ...TH, fontSize: 10 }}>
                <SortBtn k="nom" label="Article" />
              </th>
              <th style={{ ...TH, fontSize: 10, textAlign: "right" }}>CDT</th>
              {showFCFA && <th style={{ ...TH, fontSize: 10, textAlign: "right" }}>PU pièce</th>}
              <th style={{ ...TH, fontSize: 10, textAlign: "right" }}>Ini</th>
              <th style={{ ...TH, fontSize: 10, textAlign: "right" }}>Transferts</th>
              <th style={{ ...TH, fontSize: 10, textAlign: "right", color: "#C4B5FD" }}>
                Ventes théo
              </th>
              <th style={{ ...TH, fontSize: 10, textAlign: "right", color: "#FCA5A5" }}>
                Pertes
              </th>
              <th style={{ ...TH, fontSize: 10, textAlign: "right" }}>Stock Théo</th>
              <th style={{ ...TH, fontSize: 10, textAlign: "right" }}>Réel</th>
              <th style={{ ...TH, fontSize: 10, textAlign: "right" }}>
                <SortBtn k="ecart" label="Écart (pcs)" />
              </th>
              {showFCFA && (
                <th style={{ ...TH, fontSize: 10, textAlign: "right" }}>
                  <SortBtn k="ecartVal" label="Écart FCFA" />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => {
              const ep = a.ecartPieces || 0;
              const ev = a.ecartVal || 0;
              const rowBg = i % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
              return (
                <tr key={i} style={{ background: rowBg }}>
                  <td style={{ ...TD, fontSize: 10, color: "#9CA3AF", whiteSpace: "nowrap" }}>
                    {a.categorie?.split(" - ")[1] || a.categorie || "—"}
                  </td>
                  <td style={{ ...TD, fontWeight: 500, maxWidth: 200 }}>{a.nom}</td>
                  <td style={{ ...TD, textAlign: "right", fontSize: 11 }}>{fmt(a.qteCdt, 0) || "—"}</td>
                  {showFCFA && <td style={{ ...TD, textAlign: "right", fontSize: 11 }}>{fmt(a.puPiece, 2)}</td>}
                  <td style={{ ...TD, textAlign: "right", fontSize: 11 }}>{fmt(a.iniPieces, 1)}</td>
                  <td style={{ ...TD, textAlign: "right", fontSize: 11 }}>{fmt(a.entreesPieces, 1)}</td>
                  <td style={{ ...TD, textAlign: "right", fontSize: 11, color: "#7C3AED" }}>
                    {fmt(a.ventesPieces, 2)}
                  </td>
                  <td style={{ ...TD, textAlign: "right", fontSize: 11, color: "#DC2626" }}>
                    {fmt(a.pertesPieces, 1)}
                  </td>
                  <td style={{ ...TD, textAlign: "right", fontSize: 11, fontWeight: 600 }}>
                    {fmt(a.stockTheo, 2)}
                  </td>
                  <td style={{ ...TD, textAlign: "right", fontSize: 11 }}>{fmt(a.finPieces, 1)}</td>
                  <td
                    style={{
                      ...TD,
                      textAlign: "right",
                      fontWeight: 700,
                      color: ep < 0 ? "#DC2626" : ep > 0 ? "#D97706" : "#059669",
                    }}
                  >
                    {fmt(ep, 2)}
                  </td>
                  {showFCFA && (
                    <td
                      style={{
                        ...TD,
                        textAlign: "right",
                        fontWeight: 700,
                        color: ev < 0 ? "#DC2626" : ev > 0 ? "#D97706" : "#059669",
                      }}
                    >
                      {fmt(ev, 0)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
