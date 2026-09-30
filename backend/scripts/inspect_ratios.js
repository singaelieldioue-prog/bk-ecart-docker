import XLSX from 'xlsx';

// Lire le fichier RATIOS
const wb2 = XLSX.readFile('../RATIOS BURGER KING ABJ Q1 2026.xlsx');
console.log('📊 RATIOS BURGER KING ABJ Q1 2026.xlsx');
console.log('Feuilles disponibles:', wb2.SheetNames);

// Essayer chaque feuille
wb2.SheetNames.forEach(sheetName => {
  console.log('\n--- Feuille: ' + sheetName + ' ---');
  const sheet = wb2.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log('Nombre de lignes:', data.length);
  if (data.length > 0) {
    console.log('Colonnes:', Object.keys(data[0]));
    console.log('Premier élément:', JSON.stringify(data[0]).substring(0, 250));
    if (data.length > 1) {
      console.log('Deuxième élément:', JSON.stringify(data[1]).substring(0, 250));
    }
  }
});
