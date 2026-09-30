import { SEUILS } from "../constants.js";

export const fmt = (n, dec = 0) =>
  n == null || isNaN(n)
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      }).format(n);

export const pct = (n) =>
  n == null || isNaN(n) ? "—" : (n * 100).toFixed(2) + " %";

export const nowt = () => new Date().toISOString();

export const fmtDate = (iso) =>
  iso
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(iso))
    : "—";

export const norm = (s) => {
  if (s == null || s === "") return "";
  return String(s)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019'’]/g, "")
    .replace(/[^A-Z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
};

export function parseDate(v) {
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      let y = +m[3];
      if (y < 100) y += 2000;
      const dt = new Date(y, +m[2] - 1, +m[1]);
      return isNaN(dt) ? null : dt;
    }
    m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (m) {
      const dt = new Date(+m[1], +m[2] - 1, +m[3]);
      return isNaN(dt) ? null : dt;
    }
    const dt = new Date(s);
    return isNaN(dt) ? null : dt;
  }
  return null;
}

export function statEcart(v) {
  if (v == null || isNaN(v)) return null;
  // Un écart négatif est une anomalie (réel < théorique : flux non tracés) — jamais "excellent".
  if (v < 0) return "danger";
  if (v <= SEUILS.excellent) return "excellent";
  if (v <= SEUILS.ameliorer) return "warning";
  return "danger";
}

// Extraction du numéro BK d'un nom de site (ex: "BK23" -> "23")
export function matchBkNumber(siteStr) {
  if (!siteStr) return null;
  const m = String(siteStr).match(/BK\s*0*(\d+)/i);
  return m ? m[1] : null;
}
