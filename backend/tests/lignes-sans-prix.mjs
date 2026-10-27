// Anti-récurrence des lignes « ELEMENT A SUPRIMER » (capture CDG du 25/10) : une ligne sans
// désignation réelle ET sans prix ne peut être ni valorisée ni contrôlée, elle ne doit pas
// être réactivée par une mise à jour de Ratio. Exécution : node tests/lignes-sans-prix.mjs
import Database from "better-sqlite3";
import { applySync } from "../src/articles.js";

const db = new Database(":memory:");
db.exec(`
CREATE TABLE articles (
  ref TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  code TEXT,
  unite TEXT,
  categorie TEXT,
  conditionnement REAL,
  pu_carton REAL,
  pu_piece REAL,
  corresp TEXT,
  statut TEXT,
  actif INTEGER NOT NULL DEFAULT 1,
  ordre_affichage REAL DEFAULT 0,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${ok ? "" : "\n         trouvé : " + detail}`);
  if (!ok) failed++;
};
// La clé stockée est le ref canonicalisé (tiret -> espace), on cherche donc par code.
const actifDe = (code) => {
  const r = db.prepare("SELECT * FROM articles WHERE code=?").get(code);
  return r ? r.actif : "(ligne absente)";
};

const fantome = { ref: "CHEDBRI360", nom: "CHEDBRI360", code: "CHEDBRI360", categorie: "Nourriture - Frais", conditionnement: 1 };
const normal = { ref: "SALADE ICEBERG - Boule", nom: "SALADE ICEBERG - Boule", code: "SALADICE", conditionnement: 10, puCarton: 39130, puPiece: 3913 };
const nommeSansPrix = { ref: "SIROP MILKSHAKE CHOCOLAT", nom: "SIROP MILKSHAKE CHOCOLAT", code: "118869", conditionnement: 63 };

applySync(db, [fantome, normal, nommeSansPrix], "RATIOS BURGER KING ABJ Q3 2026.xlsx");

check("Ligne sans désignation et sans prix : insérée inactive", actifDe("CHEDBRI360") === 0, actifDe("CHEDBRI360"));
check("Article nominal : reste actif", actifDe("SALADICE") === 1, actifDe("SALADICE"));
check("Article nommé mais sans prix : reste actif (c'est un « à renseigner », pas un fantôme)", actifDe("118869") === 1, actifDe("118869"));

applySync(db, [{ ...fantome, puCarton: 1234 }], "RATIOS BURGER KING ABJ Q3 2026.xlsx");
check("La même ligne, une fois son prix connu, est réactivée", actifDe("CHEDBRI360") === 1, actifDe("CHEDBRI360"));

applySync(db, [{ ...fantome, nom: "FROMAGE TRANCHE BRIDEL 360" }], "RATIOS BURGER KING ABJ Q3 2026.xlsx");
check("La même ligne, une fois sa désignation connue, est réactivée", actifDe("CHEDBRI360") === 1, actifDe("CHEDBRI360"));

console.log(failed ? `\n${failed} point(s) en échec` : "\ntous les points passent");
process.exit(failed ? 1 : 0);
