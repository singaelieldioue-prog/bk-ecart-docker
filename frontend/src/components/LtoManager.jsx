import React, { useState } from "react";
import { fmt } from "../utils/formatters.js";
import { TH, TD } from "./UI.jsx";

export function LtoManager({ ltoFiches, onSave, onClose }) {
  const [fiches, setFiches] = useState(ltoFiches || []);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    plu: "",
    nom: "",
    categorie: "LTO",
    ingredients: [{ ing: "", qty: "", pmp: "" }],
  });
  const [err, setErr] = useState(null);

  const updForm = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const updIng = (i, k, v) =>
    setForm((p) => ({
      ...p,
      ingredients: p.ingredients.map((x, j) => (j === i ? { ...x, [k]: v } : x)),
    }));
  const addIng = () =>
    setForm((p) => ({
      ...p,
      ingredients: [...p.ingredients, { ing: "", qty: "", pmp: "" }],
    }));
  const delIng = (i) =>
    setForm((p) => ({
      ...p,
      ingredients: p.ingredients.filter((_, j) => j !== i),
    }));

  const validerFiche = () => {
    if (!form.nom.trim()) {
      setErr("Le nom du produit est obligatoire.");
      return;
    }
    const ings = form.ingredients.filter(
      (x) => x.ing.trim() && parseFloat(x.qty) > 0
    );
    if (ings.length === 0) {
      setErr("Au moins un ingrédient avec une quantité > 0 est requis.");
      return;
    }
    const coutParIng = ings.map((x) => ({
      ing: x.ing.trim(),
      qty: parseFloat(x.qty),
      pmp: parseFloat(x.pmp) || 0,
      valeur: parseFloat(x.qty) * (parseFloat(x.pmp) || 0),
    }));
    const coutTheo = coutParIng.reduce((s, x) => s + x.valeur, 0);
    const recipe = {};
    coutParIng.forEach((x) => {
      recipe[x.ing] = x.qty;
    });
    const plu = form.plu ? parseInt(form.plu) : Date.now();
    const fiche = {
      plu,
      nom: form.nom.trim(),
      categorie: form.categorie || "LTO",
      recipe,
      coutTheo,
      coutParIng,
      isLTO: true,
      createdAt: new Date().toISOString(),
    };
    const updated = [...fiches.filter((f) => f.nom !== fiche.nom), fiche];
    setFiches(updated);
    onSave(updated);
    setShowAdd(false);
    setErr(null);
    setForm({
      plu: "",
      nom: "",
      categorie: "LTO",
      ingredients: [{ ing: "", qty: "", pmp: "" }],
    });
  };

  const supprimer = (nom) => {
    const u = fiches.filter((f) => f.nom !== nom);
    setFiches(u);
    onSave(u);
  };

  const inpStyle = {
    padding: "6px 10px",
    border: "1px solid #D1D5DB",
    borderRadius: 6,
    fontSize: 12,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #FDE68A",
        borderRadius: 14,
        padding: 20,
        maxHeight: "80vh",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#D97706" }}>
            🍔 Fiches techniques LTO temporaires
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
            Produits en promotion limitée — sans modifier le fichier Ratios trimestriel
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => {
              setShowAdd((p) => !p);
              setErr(null);
            }}
            style={{
              background: "#D97706",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              padding: "7px 13px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {showAdd ? "✕ Annuler" : "+ Ajouter LTO"}
          </button>
          <button
            onClick={onClose}
            style={{
              background: "#F3F4F6",
              color: "#374151",
              border: "none",
              borderRadius: 7,
              padding: "7px 12px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Fermer
          </button>
        </div>
      </div>

      {/* Formulaire ajout LTO */}
      {showAdd && (
        <div
          style={{
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 10,
            padding: 16,
            marginBottom: 14,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, color: "#92400E", marginBottom: 10 }}>
            Nouvelle fiche LTO
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>
                PLU caisse (optionnel)
              </div>
              <input
                style={inpStyle}
                placeholder="ex. 9001"
                value={form.plu}
                onChange={(e) => updForm("plu", e.target.value)}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>
                Nom produit ⭐
              </div>
              <input
                style={inpStyle}
                placeholder="ex. WHOPPER DOUBLE FROMAGE"
                value={form.nom}
                onChange={(e) => updForm("nom", e.target.value)}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Catégorie</div>
              <input
                style={inpStyle}
                placeholder="LTO"
                value={form.categorie}
                onChange={(e) => updForm("categorie", e.target.value)}
              />
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>
            Ingrédients de la recette
          </div>
          {form.ingredients.map((ing, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "3fr 1fr 1fr auto",
                gap: 6,
                marginBottom: 5,
                alignItems: "center",
              }}
            >
              <input
                style={inpStyle}
                placeholder="Nom ingrédient (ex. WHOPPER PATTY)"
                value={ing.ing}
                onChange={(e) => updIng(i, "ing", e.target.value)}
              />
              <input
                style={inpStyle}
                placeholder="Qté/couvert"
                type="number"
                min="0"
                step="0.001"
                value={ing.qty}
                onChange={(e) => updIng(i, "qty", e.target.value)}
              />
              <input
                style={inpStyle}
                placeholder="PMP FCFA/u"
                type="number"
                min="0"
                value={ing.pmp}
                onChange={(e) => updIng(i, "pmp", e.target.value)}
              />
              <button
                onClick={() => delIng(i)}
                style={{
                  background: "#FEF2F2",
                  color: "#DC2626",
                  border: "none",
                  borderRadius: 5,
                  padding: "5px 8px",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <button
              onClick={addIng}
              style={{
                background: "#EFF6FF",
                color: "#1D4ED8",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              + Ingrédient
            </button>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>
              Coût estimé :{" "}
              <strong>
                {fmt(
                  form.ingredients.reduce(
                    (s, x) =>
                      s + (parseFloat(x.qty) || 0) * (parseFloat(x.pmp) || 0),
                    0
                  ),
                  2
                )}{" "}
                FCFA/couvert
              </strong>
            </div>
          </div>
          {err && (
            <div
              style={{
                background: "#FEF2F2",
                color: "#DC2626",
                borderRadius: 7,
                padding: "7px 10px",
                fontSize: 11,
                marginTop: 8,
              }}
            >
              {err}
            </div>
          )}
          <button
            onClick={validerFiche}
            style={{
              width: "100%",
              marginTop: 10,
              padding: 10,
              borderRadius: 8,
              border: "none",
              background: "#D97706",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            ✅ Enregistrer la fiche LTO
          </button>
        </div>
      )}

      {/* Liste des fiches LTO */}
      {fiches.length === 0 ? (
        <div style={{ textAlign: "center", color: "#9CA3AF", padding: "24px 0", fontSize: 12 }}>
          Aucune fiche LTO enregistrée.
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>PLU</th>
                <th style={TH}>Produit LTO</th>
                <th style={TH}>Catégorie</th>
                <th style={{ ...TH, textAlign: "right" }}>Coût/couvert</th>
                <th style={{ ...TH, textAlign: "right" }}>Nb ingrédients</th>
                <th style={TH}>Créée le</th>
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {fiches.map((f, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#FFFBEB" : "#fff" }}>
                  <td style={{ ...TD, fontWeight: 700, color: "#D97706" }}>{f.plu}</td>
                  <td style={{ ...TD, fontWeight: 600 }}>
                    {f.nom}{" "}
                    <span
                      style={{
                        fontSize: 10,
                        background: "#FDE68A",
                        color: "#92400E",
                        borderRadius: 4,
                        padding: "1px 5px",
                        marginLeft: 4,
                      }}
                    >
                      LTO
                    </span>
                  </td>
                  <td style={TD}>{f.categorie}</td>
                  <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: "#D4531D" }}>
                    {fmt(f.coutTheo, 2)} FCFA
                  </td>
                  <td style={{ ...TD, textAlign: "right" }}>{f.coutParIng?.length || 0}</td>
                  <td style={{ ...TD, fontSize: 10, color: "#9CA3AF" }}>
                    {f.createdAt ? new Date(f.createdAt).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td style={TD}>
                    <button
                      onClick={() => supprimer(f.nom)}
                      style={{
                        background: "#FEF2F2",
                        color: "#DC2626",
                        border: "none",
                        borderRadius: 5,
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
