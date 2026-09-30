import React, { useState } from "react";
import * as api from "../api.js";

export function LoginScreen({ onLogged }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!u || !p) {
      setErr("Identifiant et mot de passe requis.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const user = await api.login(u.trim(), p);
      onLogged(user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const inp = {
    width: "100%",
    padding: 11,
    marginBottom: 9,
    borderRadius: 9,
    border: "1px solid #E5E7EB",
    boxSizing: "border-box",
    fontSize: 14,
  };

  return (
    <div
      className="login-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#F4F1EA",
        fontFamily: "system-ui,-apple-system,sans-serif",
        color: "#202522",
      }}
    >
      <div
        className="login-brand"
        style={{
          flex: "1 1 58%",
          minHeight: "100vh",
          padding: "clamp(32px, 7vw, 96px)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#B84216",
          backgroundImage: "linear-gradient(145deg, rgba(212,83,29,.96), rgba(135,50,20,.98)), repeating-linear-gradient(135deg, transparent 0 22px, rgba(255,255,255,.04) 22px 23px)",
          color: "#fff",
        }}
      >
        <div>
          <div>
            <div className="login-company" style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.8 }}>
              SIA RESTAURATION RAPIDE COTE D&apos;IVOIRE
            </div>
          </div>
          <div style={{ width: 42, height: 4, borderRadius: 4, background: "#F9C74F", marginTop: 18 }} />
        </div>
        <div className="login-brand-copy" style={{ maxWidth: 520, margin: "auto 0", padding: "72px 0" }}>
          <div style={{ fontSize: 104, lineHeight: 1, marginBottom: 25 }}>🍔</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: "clamp(34px, 4.5vw, 64px)", lineHeight: 1.03, fontWeight: 700 }}>
            Les bons chiffres font les bons choix.
          </div>
          <div style={{ fontSize: 16, lineHeight: 1.6, opacity: 0.82, maxWidth: 420, marginTop: 22 }}>
            Pilotez les écarts matières, les rapports et le circuit de validation des restaurants BK Abidjan.
          </div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.65 }}>Écart Matières · Version professionnelle</div>
      </div>

      <div
        className="login-panel"
        style={{
          flex: "0 1 42%",
          minHeight: "100vh",
          boxSizing: "border-box",
          padding: "clamp(28px, 6vw, 88px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4F1EA",
        }}
      >
        <div style={{ width: "100%", maxWidth: 390 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#D4531D", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 15 }}>
            Espace sécurisé
          </div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 38, lineHeight: 1.05, fontWeight: 700, marginBottom: 10 }}>
            Bienvenue.
          </div>
          <div style={{ fontSize: 14, color: "#6B716D", marginBottom: 32 }}>
            Connectez-vous pour continuer vers votre tableau de bord.
          </div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 7 }}>Identifiant</label>
          <input
            placeholder="Votre identifiant"
            value={u}
            onChange={(e) => setU(e.target.value)}
            style={inp}
          />
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, margin: "10px 0 7px" }}>Mot de passe</label>
          <div style={{ position: "relative" }}>
            <input
              placeholder="Votre mot de passe"
              type={showPassword ? "text" : "password"}
              value={p}
              onChange={(e) => setP(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              style={{ ...inp, paddingRight: 72 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              style={{ position: "absolute", right: 8, top: 5, height: 34, border: "none", background: "transparent", color: "#6B716D", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
            >
              {showPassword ? "Masquer" : "Afficher"}
            </button>
          </div>
          {err && <div style={{ color: "#B42318", background: "#FEE4E2", borderRadius: 8, padding: "9px 11px", fontSize: 12, margin: "12px 0" }}>{err}</div>}
          <button
            onClick={submit}
            disabled={busy}
            style={{
              width: "100%",
              padding: 14,
              marginTop: 15,
              borderRadius: 8,
              border: "none",
              background: busy ? "#B9BDB9" : "#202522",
              color: "#fff",
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
              fontSize: 14,
              boxShadow: "0 8px 18px rgba(32,37,34,.14)",
            }}
          >
            {busy ? "Connexion…" : "Se connecter"}
          </button>
          <div style={{ fontSize: 11, color: "#9A9E9A", marginTop: 22, textAlign: "center" }}>
            BK Abidjan · Accès réservé aux équipes autorisées
          </div>
          <div style={{ fontSize: 10, color: "#B2B5B2", marginTop: 28, textAlign: "center" }}>
            Tous droits réservés - Cam&sons
          </div>
        </div>
      </div>
    </div>
  );
}
