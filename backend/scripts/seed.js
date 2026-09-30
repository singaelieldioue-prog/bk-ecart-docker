import 'dotenv/config';
import { seedUsers } from '../src/db.js';

const reset = process.argv.includes('--reset');
const created = seedUsers({ force: reset });
if (reset) console.log('[seed] Comptes réinitialisés.');
else if (created) console.log('[seed] Comptes créés.');
else console.log('[seed] Des comptes existent déjà (utilisez --reset pour forcer).');
process.exit(0);
