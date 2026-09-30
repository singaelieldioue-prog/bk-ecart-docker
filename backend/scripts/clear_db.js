import Database from 'better-sqlite3';

const db = new Database('./data.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables à vider:', tables.map(t => t.name).join(', '));

const tablesToClear = ['articles', 'restaurants', 'users', 'workflow_states', 'inventory_entries'];

tablesToClear.forEach(table => {
  try {
    db.exec(`DELETE FROM ${table}`);
    console.log(`✓ Table '${table}' vidée`);
  } catch (e) {
    console.log(`✓ Table '${table}' n'existe pas`);
  }
});

console.log('\n✓ Base de données vidée avec succès!');
db.close();
