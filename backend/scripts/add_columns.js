import Database from 'better-sqlite3';

const db = new Database('./data.db');

// Ajouter les colonnes manquantes
try {
  db.exec("ALTER TABLE articles ADD COLUMN fournisseur TEXT DEFAULT 'SIA'");
  console.log('✅ Colonne fournisseur ajoutée');
} catch (e) {
  console.log('ℹ️  Colonne fournisseur existe déjà');
}

try {
  db.exec('ALTER TABLE articles ADD COLUMN qteInner REAL DEFAULT 0');
  console.log('✅ Colonne qteInner ajoutée');
} catch (e) {
  console.log('ℹ️  Colonne qteInner existe déjà');
}

try {
  db.exec("ALTER TABLE articles ADD COLUMN unite TEXT DEFAULT 'Inner'");
  console.log('✅ Colonne unite ajoutée');
} catch (e) {
  console.log('ℹ️  Colonne unite existe déjà');
}

// Vérifier la nouvelle structure
const schema = db.pragma('table_info(articles)');
console.log('\n✅ Nouvelle structure:');
schema.forEach(col => console.log('  ' + col.name + ' (' + col.type + ')'));

db.close();
console.log('\n✅ Colonnes mises à jour!');
