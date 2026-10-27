// Sonde lecture seule du classeur réel régénéré (tmp_verif/Suivi_BK1_Octobre_2026.xlsx) : les lignes
// transmises retrouvent-elles leur Cond./Prix, les deux bandeaux ont-ils disparu, le Total et les
// indicateurs couvrent-ils exactement les lignes de données ?
// Les formules sont lues dans le XML écrit (xl/worksheets/sheet5.xml = Pertes) : xlsx-js-style ne
// rend aucune valeur pour une cellule sans cache, donc absente à la relecture.
// Exécution : node tests/tmp_pertes_fichier_reel.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import JSZip from "jszip";

const buf = fs.readFileSync(new URL("../../tmp_verif/Suivi_BK1_Octobre_2026.xlsx", import.meta.url));
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file("xl/worksheets/sheet5.xml").async("string");
const wb = XLSX.read(buf, { type: "buffer" });
const ws = wb.Sheets["Pertes"];

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const cellule = (ref) => {
  const m = new RegExp(`<c r="${ref}"[^>]*>([\\s\\S]*?)</c>`).exec(xml);
  if (!m) return { vide: true, f: "", v: "" };
  const f = /<f[^>]*>([\s\S]*?)<\/f>/.exec(m[1]);
  const v = /<v>([\s\S]*?)<\/v>/.exec(m[1]);
  return { vide: false, f: f ? decode(f[1]) : "", v: v ? decode(v[1]) : "" };
};
const texte = (ref) => String(ws[ref]?.v ?? "").trim();
const cle = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const NOMS = ["MIRINDA ORANGE PET 30CL", "BOUTEILLE 7UP 30CL", "BOUTEILLE PEPSI ZERO 1,5L", "EAU KIRENE 50 CL 16",
  "FROMAGE MEDHI NEW", "HUILE AYA 5 L", "BUN 7'' NOUGATINE", "BUN 5'' Nougatine", "MOZZARELLA STICKS",
  "BBQ TENDERCRISP", "CHICKEN BURGER PETIT PRIX", "SALADE POULET CROUSTILLANT", "SALADE POULET GRILLE"];

// une ligne de données porte la formule Quantité perte = SUM(J{R}:AN{R})
const lignesDonnees = [];
for (let r = 5; r < 400; r++) if (cellule(`G${r}`).f === `SUM(J${r}:AN${r})`) lignesDonnees.push(r);
const derniere = lignesDonnees[lignesDonnees.length - 1];
const total = derniere + 1;
console.log(`lignes de données : ${lignesDonnees.length} (L${lignesDonnees[0]}..L${derniere}), TOTAL PERTES en L${total}`);
console.log(`A${total}=${JSON.stringify(texte(`F${total}`))} H${total}=${cellule(`H${total}`).f}`);
console.log(`indicateur J2 = ${cellule("J2").f}`);
const discontinues = lignesDonnees.filter((r, i) => i > 0 && r !== lignesDonnees[i - 1] + 1);
console.log(`ruptures de séquence : ${discontinues.length ? discontinues.join(",") : "aucune"}`);
const sansNom = lignesDonnees.filter((r) => !texte(`B${r}`));
console.log(`lignes de données sans désignation : ${sansNom.length ? sansNom.join(",") : "aucune"}`);

const bandeauA = Object.keys(ws).filter((k) => !k.startsWith("!") && /^[A-Z]+\d+$/.test(k))
  .filter((k) => /^(ARTICLES TRANSMIS|PRODUITS FINIS)/.test(texte(k)));
console.log(`bandeaux : ${bandeauA.length ? bandeauA.map((k) => `${k}=${texte(k)}`).join(" | ") : "aucun"}`);

console.log(`\ndésignation                      lig.  Cond.  Prix carton          Prix pièce (formule du XML écrit)`);
const garde = [], sansGarde = [], finis = [];
lignesDonnees.forEach((R) => {
  const E = cellule(`E${R}`).f;
  if (/ISNUMBER/.test(E)) garde.push(R); else sansGarde.push(R);
  if (texte(`A${R}`) === "Produits finis") finis.push(R);
});
console.log(`formules prix pièce : ${sansGarde.length} ordinaires (E=L5 ${cellule("E5").f}) · ${garde.length} gardées ISNUMBER (L${garde.join(", L")})`);
console.log(`catégorie « Produits finis » : ${finis.length} ligne(s) L${finis[0]}..L${finis[finis.length - 1]} : ${finis.map((r) => texte(`B${r}`)).join(" | ")}`);
const whopper = lignesDonnees.find((r) => texte(`B${r}`) === "WHOPPER");
console.log(`WHOPPER : L${whopper}, D=${cellule(`D${whopper}`).v}, A=${texte(`A${whopper}`)}`);
const matiere = lignesDonnees.filter((r) => !garde.includes(r) && texte(`A${r}`) !== "Produits finis").length;
console.log(`décompte : ${matiere} lignes valorisées hors Produits finis + ${finis.length} Produits finis + ${garde.length} à renseigner = ${lignesDonnees.length}`);

for (const nom of NOMS) {
  const R = lignesDonnees.find((r) => cle(texte(`B${r}`)) === cle(nom));
  if (!R) { console.log(`${nom.padEnd(30)} ABSENTE`); continue; }
  const C = cellule(`C${R}`), D = cellule(`D${R}`), E = cellule(`E${R}`);
  const pu = D.vide ? "∅" : String(Math.round(Number(D.v) * 100) / 100);
  console.log(`${texte(`B${R}`).padEnd(30)} L${String(R).padEnd(5)} ${(C.vide ? "∅" : C.v).padEnd(6)} ${pu.padEnd(20)} ${E.f}  [${texte(`A${R}`)} · unité ${texte(`F${R}`)}]`);
}
