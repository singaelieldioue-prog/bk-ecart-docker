import * as api from "../api.js";
import {
  RATIOS_KEY,
  RATIOS_WB_KEY,
  LTO_KEY,
  BASE_ART_KEY,
  CORR_MAP_KEY,
  LOCAL_ART_KEY,
  PMIX_COMP_KEY,
} from "../constants.js";


export async function saveRatiosMemo(meta) {
  try {
    await api.kvSet(RATIOS_KEY, JSON.stringify(meta));
  } catch (e) {}
}

export async function loadRatiosMemo() {
  try {
    const r = await api.kvGet(RATIOS_KEY);
    if (r?.value) return JSON.parse(r.value);
  } catch (e) {}
  return null;
}

export async function saveRatiosParsed(ratios) {
  try {
    // Un parse vide (mauvais fichier importé : feuilles « Data sheet »/« COST » absentes)
    // ne doit jamais écraser un ratio valide mémorisé — l'erreur est signalée à l'appelant.
    if (!ratios || !Array.isArray(ratios.allProducts) || ratios.allProducts.length === 0) {
      const existing = await loadRatiosParsed();
      if (existing?.allProducts?.length) return false;
    }
    await api.kvSet(RATIOS_WB_KEY, JSON.stringify(ratios));
    return true;
  } catch (e) {
    return false;
  }
}

export async function loadRatiosParsed() {
  try {
    const r = await api.kvGet(RATIOS_WB_KEY);
    if (r?.value) return JSON.parse(r.value);
  } catch (e) {}
  return null;
}

export async function saveLto(fiches) {
  try {
    await api.kvSet(LTO_KEY, JSON.stringify(fiches));
  } catch (e) {}
}

export async function loadLto() {
  try {
    const r = await api.kvGet(LTO_KEY);
    if (r?.value) return JSON.parse(r.value);
  } catch (e) {}
  return [];
}

export async function saveBaseArticleMap(map) {
  try {
    await api.kvSet(BASE_ART_KEY, JSON.stringify(map));
  } catch (e) {}
}

export async function loadBaseArticleMap() {
  try {
    const r = await api.kvGet(BASE_ART_KEY);
    if (r?.value) {
      const memo = JSON.parse(r.value);
      if (memo && Object.keys(memo).length) return memo;
    }
  } catch (e) {}

  try {
    const articles = await api.articlesListAll({ actif: "all" });
    if (articles.length) {
      const map = Object.fromEntries(articles.map((article) => [article.ref, {
        categorie: article.categorie || "",
        famille: "",
        designation: article.nom || article.ref,
        corresponRatio: article.corresp || "",
        fournisseur: article.fournisseur || "",
        codeBollore: article.code || "",
        unite: article.unite || "",
        cdt: article.conditionnement || 1,
      }]));
      await api.kvSet(BASE_ART_KEY, JSON.stringify(map));
      return map;
    }
  } catch (e) {}
  return null;
}

export async function saveCorrespondanceMap(map) {
  try {
    await api.kvSet(CORR_MAP_KEY, JSON.stringify(map));
  } catch (e) {}
}

export async function loadCorrespondanceMap() {
  try {
    const r = await api.kvGet(CORR_MAP_KEY);
    if (r?.value) return JSON.parse(r.value);
  } catch (e) {}
  return null;
}

export async function saveLocalArticles(map) {
  try {
    await api.kvSet(LOCAL_ART_KEY, JSON.stringify(map));
  } catch (e) {}
}

export async function loadLocalArticles() {
  try {
    const r = await api.kvGet(LOCAL_ART_KEY);
    if (r?.value) {
      const memo = JSON.parse(r.value);
      if (memo && Object.keys(memo).length) return memo;
    }
  } catch (e) {}
  return null;
}

// Base complémentaire PMIX : un parse vide (mauvais fichier importé) n'écrase jamais le
// complément mémorisé — savePmixComplement renvoie false et l'appelant affiche l'erreur.
export async function savePmixComplement(map) {
  try {
    if (!map || !Object.keys(map).length) {
      const existing = await loadPmixComplement();
      if (existing && Object.keys(existing).length) return false;
    }
    await api.kvSet(PMIX_COMP_KEY, JSON.stringify(map || {}));
    return true;
  } catch (e) {
    return false;
  }
}

export async function loadPmixComplement() {
  try {
    const r = await api.kvGet(PMIX_COMP_KEY);
    if (r?.value) return JSON.parse(r.value);
  } catch (e) {}
  return null;
}
