import React, { useState, useEffect } from "react";
import XLSX from "xlsx-js-style";
import JSZip from "jszip";
import * as api from "../api.js";
import { buildModelesWb, genererModelesSuivi } from "../utils/excelExporter.js";
import { injecterLogoXlsx, telechargerXlsx } from "../utils/xlsxLogo.js";
import { sortArticles } from "../utils/articleSorter.js";
import { orderArticlesByReference } from "../utils/inventaireReference.js";
import { loadRatiosParsed } from "../utils/storage.js";
import { enrichirAvecBaseLocale } from "../utils/parsers.js";

const normalizeInventoryValue = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");

async function orderArticlesByInventoryExample(articles) {
  const response = await fetch("/exemple inventaire.xlsx", { cache: "no-store" });
  if (!response.ok) throw new Error("Le fichier exemple inventaire.xlsx est indisponible.");
  const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets.inventaire;
  if (!sheet) throw new Error("L’onglet inventaire est absent du fichier exemple.");
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const referenceRows = rows
    .slice(6)
    .filter((row) => row[3] && row[14])
    .map((row) => ({
      name: row[3],
      code: row[14],
      categorie: row[1] || "",
      conditionnement: typeof row[4] === "number" ? row[4] : 1,
      qteInner: typeof row[5] === "number" ? row[5] : 0,
      unite: row[10] || "",
    }));
  if (referenceRows.length === 0) throw new Error("Aucun article trouvé dans le fichier exemple.");
  const byCode = new Map();
  const byName = new Map();
  articles.forEach((article) => {
    if (article.code) byCode.set(normalizeInventoryValue(article.code), article);
    if (article.nom) byName.set(normalizeInventoryValue(article.nom), article);
  });
  return referenceRows.map((reference) => {
    const source =
      byCode.get(normalizeInventoryValue(reference.code)) ||
      byName.get(normalizeInventoryValue(reference.name));
    return {
      ...(source || {}),
      nom: reference.name,
      code: reference.code,
      categorie: reference.categorie,
      conditionnement: reference.conditionnement,
      qteInner: reference.qteInner,
      unite: reference.unite || source?.unite || "",
    };
  });
}

export function BaseArticlesTab({ role, produits, localArticles }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [actif, setActif] = useState("1");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 50 });
  const [err, setErr] = useState(null);
  const [restos, setRestos] = useState([]);
  const [newCode, setNewCode] = useState("");
  const [newNom, setNewNom] = useState("");
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  const [selResto, setSelResto] = useState("all");
  const [dateInv, setDateInv] = useState("");

  const isCdg = role === "cdg" || role === "admin";
  const loadRestos = () => api.restaurantsList().then(setRestos).catch(() => {});

  const loadArticles = async (targetPage = page) => {
    try {
      setErr(null);
      const res = await api.articlesList({ actif, search, page: targetPage, limit: pageSize });
      const rows = Array.isArray(res) ? res : res.items || [];
      const meta = Array.isArray(res)
        ? { page: 1, totalPages: 1, total: rows.length, limit: pageSize }
        : { page: res.page || 1, totalPages: res.totalPages || 1, total: res.total || 0, limit: res.limit || pageSize };
      setItems(rows);
      setPagination(meta);
    } catch (e) {
      setErr(e.message);
      setItems([]);
      setPagination({ page: 1, totalPages: 1, total: 0, limit: pageSize });
    }
  };

  useEffect(() => {
    loadRestos();
  }, []);

  useEffect(() => { setPage(1); }, [actif, search]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadArticles(page);
    }, 250);
    return () => clearTimeout(t);
  }, [actif, search, page, pageSize]);

  const addResto = async () => {
    if (!newCode.trim() || !newNom.trim()) {
      alert("Code et nom du restaurant requis.");
      return;
    }
    try {
      await api.restaurantCreate(newCode.trim(), newNom.trim());
      setNewCode("");
      setNewNom("");
      loadRestos();
    } catch (e) {
      alert(e.message);
    }
  };

  const toggleResto = async (r) => {
    try {
      await api.restaurantUpdate(r.id, { actif: r.actif ? 0 : 1 });
      loadRestos();
    } catch (e) {
      alert(e.message);
    }
  };

  const genGenerate = async () => {
    if (!period.trim()) {
      alert("Indiquez la période (ex. « Juin 2026 »).");
      return;
    }
    setBusy(true);
    try {
      const arts = await api.articlesListAll({ actif: "1" });
      if (!arts.length) {
        alert("Base articles vide. Chargez d'abord un Ratio.");
        return;
      }
      const orderedArts = enrichirAvecBaseLocale(await orderArticlesByInventoryExample(arts), localArticles);
      const prods = produits?.length ? produits : (await loadRatiosParsed())?.allProducts || [];
      const d = dateInv ? new Date(dateInv + "T00:00:00") : "";
      const clean = (s) => s.replace(/[^a-zA-Z0-9]/g, "_");
      if (selResto === "all") {
        const rs = (await api.restaurantsList()).filter((x) => x.actif);
        if (!rs.length) {
          alert("Aucun restaurant actif. Ajoutez-en d'abord ci-dessus.");
          return;
        }
        const zip = new JSZip();
        const codes = rs.map((x) => x.code);
        for (const r of rs) {
          const wb = buildModelesWb(orderedArts, prods, r.code, period.trim(), d, codes);
          const buf = await injecterLogoXlsx(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
          zip.file(
            `Suivi_${clean(r.code)}_${clean(period.trim())}.xlsx`,
            buf
          );
        }
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Suivi_Stock_${clean(period.trim())}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const r = restos.find((x) => String(x.id) === String(selResto));
        if (!r) {
          alert("Restaurant introuvable.");
          return;
        }
        await genererModelesSuivi(orderedArts, prods, r.code, period.trim(), d, restos.filter((x) => x.actif).map((x) => x.code)); // fichier unique
      }
    } catch (e) {
      alert("Génération impossible : " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const exportXlsx = async () => {
    try {
      const res = await api.articlesList({ actif, search, page: 1, limit: 5000 });
      const list = sortArticles(enrichirAvecBaseLocale(Array.isArray(res) ? res : res.items || [], localArticles)) || [];
      const H = [
        "Désignation",
        "Code",
        "Catégorie",
        "Conditionnement",
        "Prix carton (FCFA)",
        "Prix pièce (FCFA)",
        "Correspondance",
        "Statut",
      ];
      const m = [
        ["", "", "", { v: "BASE ARTICLES — référentiel", s: { font: { bold: true, sz: 14 } } }],
        H.map((h) => ({ v: h, s: { font: { bold: true } } })),
      ];
      list.forEach((a) => {
        m.push([
          a.nom,
          a.code || "",
          a.categorie || "",
          a.conditionnement || 0,
          a.pu_carton || 0,
          a.pu_piece || 0,
          a.corresp || "",
          a.actif ? "Actif" : "Inactif",
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(m);
      ws["!rows"] = [{ hpt: 80 }];
      ws["!merges"] = [{ s: { r: 0, c: 3 }, e: { r: 0, c: 7 } }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Base articles");
      await telechargerXlsx(wb, "base_articles.xlsx");
    } catch (e) {
      alert("Export impossible : " + e.message);
    }
  };

  const genModeles = async () => {
    try {
      const arts = await api.articlesListAll({ actif: "1" });
      if (!arts.length) {
        alert("Base articles vide. Chargez d'abord un fichier Ratio (« Mettre à jour les Ratios »).");
        return;
      }
      const orderedArts = enrichirAvecBaseLocale(await orderArticlesByInventoryExample(arts), localArticles);
      const prods = produits?.length ? produits : (await loadRatiosParsed())?.allProducts || [];
      await genererModelesSuivi(orderedArts, prods, "");
    } catch (e) {
      alert("Génération impossible : " + e.message);
    }
  };

  return (
    <div>
      {isCdg && (
        <div
          style={{
            background: "#FFF7F5",
            border: "1px solid #F5D5C8",
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, color: "#D4531D", marginBottom: 8 }}>
            🏪 Restaurants & génération mensuelle
          </div>

          {/* Liste des restaurants */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {restos.length === 0 && (
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>Aucun restaurant enregistré.</span>
            )}
            {restos.map((r) => (
              <span
                key={r.id}
                onClick={() => toggleResto(r)}
                title="Cliquer pour activer/désactiver"
                style={{
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: "1px solid #F5D5C8",
                  background: r.actif ? "#fff" : "#F3F4F6",
                  color: r.actif ? "#D4531D" : "#9CA3AF",
                  fontWeight: 600,
                  opacity: r.actif ? 1 : 0.6,
                }}
              >
                {r.code} — {r.nom}
                {r.actif ? "" : " (inactif)"}
              </span>
            ))}
          </div>

          {/* Ajout d'un restaurant */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <input
              placeholder="Code (ex. BK Cocody)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", width: 160 }}
            />
            <input
              placeholder="Nom du restaurant"
              value={newNom}
              onChange={(e) => setNewNom(e.target.value)}
              style={{
                padding: 8,
                borderRadius: 8,
                border: "1px solid #E5E7EB",
                flex: 1,
                minWidth: 160,
              }}
            />
            <button
              onClick={addResto}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #D4531D",
                background: "#fff",
                color: "#D4531D",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + Ajouter
            </button>
          </div>

          {/* Génération */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={selResto}
              onChange={(e) => setSelResto(e.target.value)}
              style={{ padding: 9, borderRadius: 8, border: "1px solid #E5E7EB" }}
            >
              <option value="all">Tous les restaurants (ZIP)</option>
              {restos
                .filter((r) => r.actif)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.nom}
                  </option>
                ))}
            </select>
            <input
              placeholder="Période (ex. Juin 2026)"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{
                padding: 9,
                borderRadius: 8,
                border: "1px solid #E5E7EB",
                width: 170,
              }}
            />
            <input
              type="date"
              value={dateInv}
              onChange={(e) => setDateInv(e.target.value)}
              title="Date d'inventaire (optionnelle)"
              style={{ padding: 9, borderRadius: 8, border: "1px solid #E5E7EB" }}
            />
            <button
              onClick={genGenerate}
              disabled={busy}
              style={{
                padding: "9px 14px",
                borderRadius: 8,
                border: "none",
                background: busy ? "#E5E7EB" : "#D4531D",
                color: busy ? "#9CA3AF" : "#fff",
                fontWeight: 700,
                cursor: busy ? "default" : "pointer",
              }}
            >
              {busy
                ? "Génération…"
                : selResto === "all"
                ? "📦 Générer (tous, ZIP)"
                : "📄 Générer ce restaurant"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
            Estampillé site + période. La date d'inventaire, si renseignée, pré-remplit l'en-tête ;
            sinon le restaurant la saisit.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input
          placeholder="Rechercher un article…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: 9,
            borderRadius: 8,
            border: "1px solid #E5E7EB",
            flex: 1,
            minWidth: 200,
          }}
        />
        <select
          value={actif}
          onChange={(e) => setActif(e.target.value)}
          style={{ padding: 9, borderRadius: 8, border: "1px solid #E5E7EB" }}
        >
          <option value="1">Actifs</option>
          <option value="0">Inactifs</option>
          <option value="all">Tous</option>
        </select>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          style={{ padding: 9, borderRadius: 8, border: "1px solid #E5E7EB" }}
        >
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
        <button
          onClick={exportXlsx}
          disabled={!items.length}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            border: "none",
            background: items.length ? "#D4531D" : "#E5E7EB",
            color: items.length ? "#fff" : "#9CA3AF",
            fontWeight: 700,
            cursor: items.length ? "pointer" : "default",
          }}
        >
          ⬇️ Exporter Excel
        </button>
        <button
          onClick={genModeles}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid #D4531D",
            background: "#fff",
            color: "#D4531D",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          🏭 Modèle vierge
        </button>
      </div>
      {err && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", fontSize: 12, color: "#6B7280", marginBottom: 8, flexWrap: "wrap" }}>
        <span>{pagination.total} article(s)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: page <= 1 ? "#F3F4F6" : "#fff",
              color: page <= 1 ? "#9CA3AF" : "#111827",
              cursor: page <= 1 ? "default" : "pointer",
            }}
          >
            Précédent
          </button>
          <span>
            Page {pagination.page || page} / {pagination.totalPages || 1}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
            disabled={page >= (pagination.totalPages || 1)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: page >= (pagination.totalPages || 1) ? "#F3F4F6" : "#fff",
              color: page >= (pagination.totalPages || 1) ? "#9CA3AF" : "#111827",
              cursor: page >= (pagination.totalPages || 1) ? "default" : "pointer",
            }}
          >
            Suivant
          </button>
        </div>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #F3F4F6", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["Désignation", "Code", "Catégorie", "Cond.", "Prix carton", "Prix pièce", "Statut"].map(
                (h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: "8px 10px",
                      fontWeight: 700,
                      color: "#374151",
                      borderBottom: "1px solid #F3F4F6",
                      textAlign: i > 2 ? "right" : "left",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {sortArticles(items).map((a) => (
              <tr key={a.ref} style={{ borderBottom: "1px solid #F9FAFB", opacity: a.actif ? 1 : 0.5 }}>
                <td style={{ padding: "7px 10px" }}>{a.nom}</td>
                <td style={{ padding: "7px 10px", color: "#6B7280" }}>{a.code || "—"}</td>
                <td style={{ padding: "7px 10px", color: "#6B7280" }}>{a.categorie || "—"}</td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}>{a.conditionnement ?? "—"}</td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}>
                  {a.pu_carton != null ? Math.round(a.pu_carton).toLocaleString("fr-FR") : "—"}
                </td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}>
                  {a.pu_piece != null
                    ? a.pu_piece.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
                    : "—"}
                </td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}>
                  <span style={{ color: a.actif ? "#059669" : "#DC2626", fontWeight: 600 }}>
                    {a.actif ? "Actif" : "Inactif"}
                  </span>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#9CA3AF" }}>
                  Base vide — chargez un fichier Ratio (« Mettre à jour les Ratios ») pour l'alimenter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
