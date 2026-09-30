import XLSX from 'xlsx';
import Database from 'better-sqlite3';

console.log('🔄 Réimport des articles avec les BONS codes...\n');

// Lire le fichier BASE ARTICLE
const wbBase = XLSX.readFile('../BASE ARTICLE SIA.xlsx');
const dataBase = XLSX.utils.sheet_to_json(wbBase.Sheets['base article ']);
console.log('✅ Articles chargés:', dataBase.length);

// Connecter à la BD
const db = new Database('./data.db');

// Vider les articles existants
db.exec('DELETE FROM articles');
console.log('🗑️  Articles effacés\n');

// Préparer la requête d'insertion
const insertStmt = db.prepare(`
  INSERT INTO articles (
    ref, nom, code, unite, categorie, conditionnement, 
    pu_carton, pu_piece, corresp, actif, fournisseur, qteInner, ordre_affichage
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0;
let skipped = 0;

// Insérer les articles
dataBase.forEach((row, index) => {
  try {
    const nom = String(row['Désignation stock '] || '').trim();
    const code = String(row['Code article Bolloré2'] || '').trim();
    const categorie = String(row['Catégorie'] || '').trim();
    const conditionnement = String(row['Conditionnement2'] || '').trim();
    const unite = String(row['Unité de mesure'] || 'Inner').trim();
    const corresp = String(row['Correspondance Ratio'] || '').trim();
    const fournisseur = String(row['FOURNISSEUR '] || 'SIA').trim();
    
    // Vérifier si les données essentielles existent
    if (!nom || !code || nom === 'Désignation stock ') {
      skipped++;
      return;
    }
    
    insertStmt.run(
      code,  // ref (clé primaire)
      nom,
      code,
      unite,
      categorie,
      isNaN(conditionnement) ? 0 : parseFloat(conditionnement),
      0,  // pu_carton
      0,  // pu_piece
      corresp,
      1,  // actif = 1
      fournisseur,
      0,  // qteInner
      index
    );
    inserted++;
  } catch (e) {
    console.error('Erreur ligne ' + (index + 1) + ':', e.message);
  }
});

console.log('✅ Importation complétée:');
console.log('   - Insérés: ' + inserted);
console.log('   - Sautés: ' + skipped);

// Vérifier le résultat
const count = db.prepare('SELECT COUNT(*) as total FROM articles').get();
const preview = db.prepare('SELECT nom, code, fournisseur, categorie FROM articles LIMIT 5').all();
console.log('\n📊 Vérification:');
console.log('   Total articles: ' + count.total);
console.log('   Aperçu:');
preview.forEach(a => console.log('      - ' + a.nom + ' | Code: ' + a.code + ' | Fournisseur: ' + a.fournisseur + ' | ' + a.categorie));

// Vérifier les codes incorrects
console.log('\n🔍 Vérification des codes articles:');
const errors = db.prepare(`
  SELECT nom, code FROM articles 
  WHERE code LIKE '%,%' OR code LIKE '%.%' OR code = ''
  LIMIT 5
`).all();

if (errors.length === 0) {
  console.log('   ✅ Tous les codes sont corrects!');
} else {
  console.log('   ❌ Codes suspects trouvés:');
  errors.forEach(a => console.log('      - ' + a.nom + ': ' + a.code));
}

db.close();
console.log('\n✅ Réimport terminé!');
