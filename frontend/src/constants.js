export const SEUILS = { excellent: 0.0125, ameliorer: 0.02 };
export const RATIOS_KEY = "bk_sia_ratios_v1";
export const RATIOS_WB_KEY = "bk_sia_ratios_parsed_v1";
export const LTO_KEY = "bk_sia_lto_v1";
export const BASE_ART_KEY = "bk_sia_base_article_map_v1";
export const CORR_MAP_KEY = "bk_sia_correspondance_map_v1";
export const LOCAL_ART_KEY = "bk_sia_local_articles_v1";

export const ROLES = {
  cdg: { label: "Contrôleur de gestion", short: "CDG", color: "#2563EB", bg: "#EFF6FF" },
  daf: { label: "Directeur Administratif & Financier", short: "DAF", color: "#7C3AED", bg: "#F5F3FF" },
  dg:  { label: "Directeur Général", short: "DG", color: "#D4531D", bg: "#FFF7F5" },
};

export const WORKFLOW = {
  draft:            { label: "Brouillon",      color: "#6B7280", bg: "#F3F4F6" },
  submitted_to_daf: { label: "Soumis au DAF",  color: "#2563EB", bg: "#EFF6FF" },
  daf_approved:     { label: "Approuvé DAF",   color: "#059669", bg: "#ECFDF5" },
  daf_rejected:     { label: "Rejeté DAF",     color: "#DC2626", bg: "#FEF2F2" },
  submitted_to_dg:  { label: "Soumis au DG",   color: "#7C3AED", bg: "#F5F3FF" },
  dg_approved:      { label: "Validé DG ✓",    color: "#059669", bg: "#ECFDF5" },
  dg_rejected:      { label: "Rejeté DG",      color: "#DC2626", bg: "#FEF2F2" },
};
