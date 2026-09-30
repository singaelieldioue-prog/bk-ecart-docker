// Script de diagnostic - Articles manquants de la liste personnalisée
// Exécuter via : node frontend/diagnoseArticles.js

import * as XLSX from 'xlsx';
import { CUSTOM_ARTICLES_ORDER } from './frontend/src/utils/customArticleOrder.js';

// Normalisation identique à celle utilisée dans customArticleOrder.js
const normalizeString = (str) => 
  String(str || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// Charger le fichier exemplaire d'inventaire
async function loadExempleInventaire() {
  try {
    const response = await fetch('file://public/exemple inventaire.xlsx');
    // En Node.js on ne peut pas utiliser fetch sur les fichiers locaux
    // On va utiliser fs à la place
    return null;
  } catch (e) {
    console.error("Erreur lors du chargement du fichier exemplaire");
    return null;
  }
}

// Articles de la liste personnalisée (normalisés)
const customSet = new Set();
CUSTOM_ARTICLES_ORDER.forEach(name => {
  customSet.add(normalizeString(name));
});

console.log("=".repeat(80));
console.log("DIAGNOSTIC - Articles manquants de votre liste personnalisée");
console.log("=".repeat(80));
console.log(`\nNombre d'articles dans votre liste : ${CUSTOM_ARTICLES_ORDER.length}`);
console.log("\nArticles de votre liste:");
CUSTOM_ARTICLES_ORDER.forEach((art, idx) => {
  console.log(`  ${idx + 1}. ${art}`);
});

console.log("\n" + "=".repeat(80));
console.log("Pour voir les articles QUI MANQUENT, veuillez:");
console.log("1. Ouvrir l'application sur http://localhost:5173");
console.log("2. Aller à l'onglet '🏷️ Gestion base article'");
console.log("3. Chercher les articles qui ne sont pas dans votre liste ci-dessus");
console.log("=".repeat(80));
