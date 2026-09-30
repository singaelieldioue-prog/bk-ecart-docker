import { getCustomArticlePriority } from "./customArticleOrder.js";

export const CATEGORY_ORDER = {
  "Boissons": 1,
  "Nourriture - Surgelé": 2,
  "Nourriture - Frais": 3,
  "Nourriture - Sec": 4,
  "Packaging": 5,
  "Produits de Nettoyage": 6
};

export function sortArticles(articles) {
  if (!articles) return [];
  const inputOrder = new Map(articles.map((article, index) => [article, index]));
  return articles.slice().sort((a, b) => {
    const customA = getCustomArticlePriority(a);
    const customB = getCustomArticlePriority(b);

    if (customA !== customB) return customA - customB;

    const catA = a.categorie || "";
    const catB = b.categorie || "";
    const numA = CATEGORY_ORDER[catA] || 99;
    const numB = CATEGORY_ORDER[catB] || 99;

    if (numA !== numB) return numA - numB;

    const ordA = Number(a.ordre_affichage) > 0 ? Number(a.ordre_affichage) : 999999;
    const ordB = Number(b.ordre_affichage) > 0 ? Number(b.ordre_affichage) : 999999;

    if (ordA !== ordB) return ordA - ordB;

    return inputOrder.get(a) - inputOrder.get(b);
  });
}
