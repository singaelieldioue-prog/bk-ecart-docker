import XLSX from 'xlsx';
import Database from 'better-sqlite3';

// Lire le fichier BASE ARTICLE
const wb1 = XLSX.readFile('../BASE ARTICLE SIA.xlsx');
console.log('📊 BASE ARTICLE SIA.xlsx');
console.log('Feuilles disponibles:', wb1.SheetNames);

// Essayer chaque feuille
wb1.SheetNames.forEach(sheetName => {
  console.log('\n--- Feuille: ' + sheetName + ' ---');
  const sheet = wb1.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log('Nombre de lignes:', data.length);
  if (data.length > 0) {
    console.log('Colonnes:', Object.keys(data[0]));
    console.log('Premier article:', JSON.stringify(data[0]).substring(0, 200));
  }
});
