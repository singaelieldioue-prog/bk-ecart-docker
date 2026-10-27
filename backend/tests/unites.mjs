// Unité de mesure demandée par le CDG le 25/10 (« L'unité de mesure de chaque article doit
// être ajoutée à la base ») : orthographe unique à l'écriture, unité déduite du colisage quand
// aucune source n'en porte, et unité déjà présente jamais écrasée par une synchro muette.
// Exécution : node tests/unites.mjs
import Database from "better-sqlite3";
import { applySync, canonUnite, uniteConnue } from "../src/articles.js";

let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${ok ? "" : "\n         trouvé : " + JSON.stringify(detail)}`);
  if (!ok) failed++;
};

check("carton/CARTON/PACK/Pièce ramenés à une écriture", [
  canonUnite("carton") === "Carton",
  canonUnite("CARTON") === "Carton",
  canonUnite("PACK") === "Pack",
  canonUnite("piece") === "Pièce",
  canonUnite("Boite") === "Boîte",
  canonUnite("kg") === "Kg",
].every(Boolean), [canonUnite("carton"), canonUnite("PACK"), canonUnite("piece")]);

check("« 1 inner de 4 » devient Inner (le nombre est porté par le colisage)", canonUnite("1 inner de 4") === "Inner", canonUnite("1 inner de 4"));
check("« 10500 stickers par inner » n'est pas une unité", uniteConnue("10500 stickers par inner") === "", uniteConnue("10500 stickers par inner"));

const db = new Database(":memory:");
db.exec(`
CREATE TABLE articles (
  ref TEXT PRIMARY KEY, nom TEXT NOT NULL, code TEXT, unite TEXT, categorie TEXT,
  conditionnement REAL, pu_carton REAL, pu_piece REAL, corresp TEXT, statut TEXT,
  actif INTEGER NOT NULL DEFAULT 1, ordre_affichage REAL DEFAULT 0, source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);
const uniteDe = (code) => (db.prepare("SELECT unite FROM articles WHERE code=?").get(code) || {}).unite ?? "(ligne absente)";

const SourceAvecUnite = { ref: "BTL-FANTA 30CL", nom: "BOUTEILLE FANTA 30cL", code: "FANTA30", conditionnement: 12, unite: "PACK", puCarton: 1288 };
const SansUniteColise = { ref: "BKCI-FANTA", nom: "BKCI-FANTA", code: "BKCI-FANTA", conditionnement: 24, puCarton: 900 };
const SansUnitePiece = { ref: "CAFG02", nom: "CAFG02", code: "CAFG02", conditionnement: 1, puPiece: 300 };
const UniteDejaConnue = { ref: "HUILE AYA 25 L", nom: "HUILE AYA 25 L", code: "AYA25", unite: "Bidon", conditionnement: 1, puCarton: 40000 };

applySync(db, [SourceAvecUnite, SansUniteColise, SansUnitePiece, UniteDejaConnue], "Ratio test");
check("Unité du fichier source écrite en base", uniteDe("FANTA30") === "Pack", uniteDe("FANTA30"));
check("Colisage 24 sans unité source → Carton", uniteDe("BKCI-FANTA") === "Carton", uniteDe("BKCI-FANTA"));
check("Colisage 1 sans unité source → Pièce", uniteDe("CAFG02") === "Pièce", uniteDe("CAFG02"));
check("Unité déjà présente conservée", uniteDe("AYA25") === "Bidon", uniteDe("AYA25"));

// Une synchro qui n'apporte ni unité ni colisage ne doit pas effacer l'unité acquise.
applySync(db, [{ ref: "HUILE AYA 25 L", nom: "HUILE AYA 25 L", code: "AYA25", puCarton: 41000 }], "Ratio test");
check("Synchro muette sur l'unité : la base garde Bidon", uniteDe("AYA25") === "Bidon", uniteDe("AYA25"));

console.log(failed ? `\n${failed} point(s) en échec` : "\ntous les points passent");
process.exit(failed ? 1 : 0);
