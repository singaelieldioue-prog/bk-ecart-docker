import React, { useState } from "react";
import * as XLSX from "xlsx";
import { DropZone } from "./UI.jsx";
import { parseBaseArticle, parseCorrespondance } from "../utils/parsers.js";

export function BaseArticleManager({ baseArtMap, corrMap, onLoadInitial, onManualSave, onClose }) {
  const [fB, setFB] = useState(null);
  const [fC, setFC] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    code: "",
    categorie: "",
    unite: "",
    conditionnement: "",
    puCarton: "",
    puPiece: "",
    corresp: "",
  });

  const readWb = (f) =>
    new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = (e) => {
        try {
          res(XLSX.read(e.target.result, { type: "array", cellDates: true }));
        } catch (err) {
          rej(err);
        }
      };
      fr.onerror = rej;
      fr.readAsArrayBuffer(f);
    });

  const hasBase = baseArtMap && Object.keys(baseArtMap).length > 0;
  const nbArt = hasBase ? Object.keys(baseArtMap).length : 0;
  const nbCode = hasBase ? Object.values(baseArtMap).filter((a) => a.codeBollore).length : 0;
  const nbCorr = corrMap ? Object.keys(corrMap.map || corrMap).length : 0;

  const doLoad = async () => {
    if (!fB) {
      alert("Sélectionnez le fichier base article.");
      return;
    }
    setBusy(true);
    try {
      const bMap = parseBaseArticle(await readWb(fB));
      const cMap = fC ? parseCorrespondance(await readWb(fC)) : null;
      await onLoadInitial(bMap, cMap);
      setFB(null);
      setFC(null);
    } catch (e) {
      alert("Erreur de lecture : " + e.message);
    }
    setBusy(false);
  };

  const doSave = async () => {
    if (!form.nom.trim()) {
      alert("Le nom de l'article est requis.");
      return;
    }
    setBusy(true);
    const article = {
      ref: form.nom.trim().toUpperCase(),
      nom: form.nom.trim(),
      code: form.code || null,
      categorie: form.categorie || null,
      unite: form.unite || null,
      conditionnement: form.conditionnement ? Number(form.conditionnement) : null,
      puCarton: form.puCarton ? Number(form.puCarton) : null,
      puPiece: form.puPiece ? Number(form.puPiece) : null,
      corresp: form.corresp || null,
      actif: 1,
      source: "manuel",
    };
    await onManualSave(article);
    setForm({
      nom: "",
      code: "",
      categorie: "",
      unite: "",
      conditionnement: "",
      puCarton: "",
      puPiece: "",
      corresp: "",
    });
    setBusy(false);
  };

  return (
    <div
      style={{
        background: "#ECFEFF",
        border: "1px solid #A5F3FC",
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 3,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0E7490" }}>
          🏷️ Gestion du base article
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#0E7490",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ✕
        </button>
      </div>

      {!hasBase ? (
        <>
          <div style={{ fontSize: 11, color: "#0891B2", marginBottom: 10 }}>
            Aucun base article mémorisé. Chargez-le <b>une seule fois</b> : il servira ensuite de
            référentiel permanent, enrichi à chaque nouveau Ratio.
          </div>
          <DropZone
            label="Fichier base article (obligatoire, une fois)"
            icon="🏷️"
            onFile={setFB}
            fileName={fB?.name}
            required
          />
          <div style={{ marginTop: 8 }}>
            <DropZone
              label="Fichier Correspondance (statut + prix) — optionnel"
              icon="🔗"
              onFile={setFC}
              fileName={fC?.name}
            />
          </div>
          <button
            onClick={doLoad}
            disabled={busy || !fB}
            style={{
              width: "100%",
              marginTop: 10,
              padding: 11,
              borderRadius: 8,
              border: "none",
              background: fB ? "#0891B2" : "#E5E7EB",
              color: fB ? "#fff" : "#9CA3AF",
              cursor: fB ? "pointer" : "not-allowed",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {busy ? "⏳ Chargement..." : "✅ Charger et mémoriser le référentiel"}
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 11, color: "#0891B2", marginBottom: 10 }}>
            Référentiel mémorisé : <b>{nbArt}</b> articles, <b>{nbCode}</b> avec code, <b>{nbCorr}</b>{" "}
            entrées de correspondance. Le Ratio (bouton « 🔄 Ratios ») enrichit automatiquement les
            prix — inutile de recharger ce fichier à chaque fois.
          </div>
          <details style={{ marginBottom: 12 }}>
            <summary
              style={{ cursor: "pointer", fontSize: 11, color: "#0E7490", fontWeight: 600 }}
            >
              🔁 Remplacer entièrement le base article / la correspondance
            </summary>
            <div style={{ marginTop: 8 }}>
              <DropZone
                label="Nouveau fichier base article (remplace l'existant)"
                icon="🏷️"
                onFile={setFB}
                fileName={fB?.name}
              />
              <div style={{ marginTop: 8 }}>
                <DropZone
                  label="Nouveau fichier Correspondance — optionnel"
                  icon="🔗"
                  onFile={setFC}
                  fileName={fC?.name}
                />
              </div>
              <button
                onClick={doLoad}
                disabled={busy || !fB}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: 9,
                  borderRadius: 8,
                  border: "none",
                  background: fB ? "#0891B2" : "#E5E7EB",
                  color: fB ? "#fff" : "#9CA3AF",
                  cursor: fB ? "pointer" : "not-allowed",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {busy ? "⏳..." : "Remplacer le référentiel"}
              </button>
            </div>
          </details>

          <div style={{ borderTop: "1px solid #A5F3FC", paddingTop: 10 }}>
            <div
              style={{ fontWeight: 700, fontSize: 12, color: "#0E7490", marginBottom: 6 }}
            >
              ➕ Ajouter / modifier un article manuellement
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <input
                placeholder="Nom / désignation *"
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                style={{
                  gridColumn: "1 / -1",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #A5F3FC",
                  fontSize: 12,
                }}
              />
              <input
                placeholder="Code Bolloré"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                style={{ padding: 8, borderRadius: 6, border: "1px solid #A5F3FC", fontSize: 12 }}
              />
              <input
                placeholder="Catégorie"
                value={form.categorie}
                onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
                style={{ padding: 8, borderRadius: 6, border: "1px solid #A5F3FC", fontSize: 12 }}
              />
              <input
                placeholder="Unité (Carton, kg…)"
                value={form.unite}
                onChange={(e) => setForm((f) => ({ ...f, unite: e.target.value }))}
                style={{ padding: 8, borderRadius: 6, border: "1px solid #A5F3FC", fontSize: 12 }}
              />
              <input
                placeholder="Conditionnement"
                type="number"
                value={form.conditionnement}
                onChange={(e) => setForm((f) => ({ ...f, conditionnement: e.target.value }))}
                style={{ padding: 8, borderRadius: 6, border: "1px solid #A5F3FC", fontSize: 12 }}
              />
              <input
                placeholder="Prix carton (FCFA)"
                type="number"
                value={form.puCarton}
                onChange={(e) => setForm((f) => ({ ...f, puCarton: e.target.value }))}
                style={{ padding: 8, borderRadius: 6, border: "1px solid #A5F3FC", fontSize: 12 }}
              />
              <input
                placeholder="Prix pièce (FCFA)"
                type="number"
                value={form.puPiece}
                onChange={(e) => setForm((f) => ({ ...f, puPiece: e.target.value }))}
                style={{ padding: 8, borderRadius: 6, border: "1px solid #A5F3FC", fontSize: 12 }}
              />
              <input
                placeholder="Correspondance Ratio"
                value={form.corresp}
                onChange={(e) => setForm((f) => ({ ...f, corresp: e.target.value }))}
                style={{
                  gridColumn: "1 / -1",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #A5F3FC",
                  fontSize: 12,
                }}
              />
            </div>
            <div style={{ fontSize: 10, color: "#0891B2", marginTop: 4 }}>
              Si l'article existe déjà (même nom), il sera modifié. Sinon, il sera ajouté.
            </div>
            <button
              onClick={doSave}
              disabled={busy || !form.nom.trim()}
              style={{
                width: "100%",
                marginTop: 8,
                padding: 9,
                borderRadius: 8,
                border: "none",
                background: form.nom.trim() ? "#059669" : "#E5E7EB",
                color: form.nom.trim() ? "#fff" : "#9CA3AF",
                cursor: form.nom.trim() ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {busy ? "⏳..." : "💾 Enregistrer cet article"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
