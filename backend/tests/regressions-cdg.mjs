// Régression du retour CDG (23/10) côté back-end : une mise à jour de Ratio doit pouvoir
// corriger l'unité de mesure sans écraser la désignation. Exécution : node tests/regressions-cdg.mjs
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
db.prepare(
  "INSERT INTO articles (ref,nom,unite,conditionnement,pu_carton,pu_piece,statut,actif) VALUES (?,?,?,?,?,?,?,?)"
).run("SALADE ICEBERG BOULE", "SALADE ICEBERG - Boule", null, 1, 6019.9934783621375, 6019.9934783621375, "ACTIF", 1);

applySync(
  db,
  [
    {
      ref: "SALADE ICEBERG - Boule",
      nom: "SALADE ICEBERG - Boule",
      code: "SALADICE",
      unite: "Carton",
      categorie: "Nourriture",
      conditionnement: 10,
      puCarton: 39129.957609353894,
      puPiece: 3912.995760935389,
      corresp: "ICEBERG SALAD (kg)",
      statut: "ACTIF",
      actif: 1,
    },
  ],
  "RATIOS BURGER KING ABJ Q3 2026"
);

const row = db.prepare("SELECT * FROM articles WHERE ref=?").get("SALADE ICEBERG BOULE");
const results = [];
const check = (name, ok, detail) => results.push((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " — " + detail));

check("unite renseignée par la synchronisation", row.unite === "Carton", "unite = " + row.unite);
check(
  "conditionnement textuel appliqué (10 boules)",
  row.conditionnement === 10,
  "conditionnement = " + row.conditionnement
);
check(
  "prix carton recalculé au kg",
  Math.abs(row.pu_carton - 39129.9576) < 0.02,
  "pu_carton = " + row.pu_carton
);
check("désignation conservée", row.nom === "SALADE ICEBERG - Boule", "nom = " + row.nom);

console.log(results.join("\n"));
process.exit(results.some((l) => l.startsWith("FAIL")) ? 1 : 0);
