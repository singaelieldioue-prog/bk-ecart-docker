import XLSX from 'xlsx';
import Database from 'better-sqlite3';

console.log('🔄 Import des articles et ratios...\n');

// Lire le fichier BASE ARTICLE
const wbBase = XLSX.readFile('../BASE ARTICLE SIA.xlsx');
const dataBase = XLSX.utils.sheet_to_json(wbBase.Sheets['base article ']);
console.log('✅ Articles chargés:', dataBase.length);

// Lire le fichier RATIOS - Correspondance nom
const wbRatios = XLSX.readFile('../RATIOS BURGER KING ABJ Q1 2026.xlsx');
const dataCorr = XLSX.utils.sheet_to_json(wbRatios.Sheets['Correspondance nom']);
console.log('✅ Correspondances chargées:', dataCorr.length);

// Créer une map de correspondance
const corrMap = {};
dataCorr.forEach(row => {
  if (row['Dénomination fichier de stock'] && row['Dénomination Achats']) {
    const stockName = String(row['Dénomination fichier de stock']).trim().toUpperCase();
    const achatsName = String(row['Dénomination Achats']).trim().toUpperCase();
    corrMap[achatsName] = stockName;
  }
});
console.log('✅ Map de correspondance créée\n');

// Connecter à la BD
const db = new Database('./data.db');

// Vider les articles existants
db.exec('DELETE FROM articles');
console.log('🗑️  Articles effacés');

// Préparer la requête d'insertion
const insertStmt = db.prepare(`
  INSERT INTO articles (
    nom, code, categorie, conditionnement, 
    pu_carton, pu_piece, corresp, actif, ordre_affichage
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    const corresp = String(row['Correspondance Ratio'] || '').trim();
    
    // Vérifier si les données essentielles existent
    if (!nom || !code || nom === 'Désignation stock ') {
      skipped++;
      return;
    }
    
    insertStmt.run(
      nom,
      code,
      categorie,
      conditionnement,
      0,  // pu_carton
      0,  // pu_piece
      corresp,
      1,  // actif = 1
      index
    );
    inserted++;
  } catch (e) {
    console.error('Erreur ligne ' + (index + 1) + ':', e.message);
  }
});

console.log('\n✅ Importation complétée:');
console.log('   - Insérés: ' + inserted);
console.log('   - Sautés: ' + skipped);

// Vérifier le résultat
const count = db.prepare('SELECT COUNT(*) as total FROM articles').get();
const preview = db.prepare('SELECT nom, code, categorie FROM articles LIMIT 5').all();
console.log('\n📊 Vérification:');
console.log('   Total articles: ' + count.total);
console.log('   Aperçu:');
preview.forEach(a => console.log('      - ' + a.nom + ' (' + a.code + ') [' + a.categorie + ']'));

db.close();
console.log('\n✅ Import terminé!');
