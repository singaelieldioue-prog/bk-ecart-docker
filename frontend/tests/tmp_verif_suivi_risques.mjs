// VÉRIF-SUIVI — risques d'erreur Excel à l'ouverture : types des cellules de prix du
// référentiel, lignes sans désignation, lignes à prix nul. Lecture seule.
// Exécution : node tests/tmp_verif_suivi_risques.mjs
import fs from "node:fs";

const inv = JSON.parse(await fs.promises.readFile(new URL("../../tmp_verif/xml_inventory.json", import.meta.url), "utf8"));

const typeDe = (c) => (c == null ? "absente" : c.t === "s" || c.t === "str" ? `texte(${JSON.stringify(c.v)})` : `nombre(${JSON.stringify(c.v)})`);

console.log("═══ RÉFÉRENTIEL ARTICLES : colonne F (prix carton) ═══");
{
  const f = inv.feuilles["Référentiel Articles"];
  const compte = { nombre: 0, texteVide: 0, texte: 0, absente: 0, zero: 0 };
  const exemples = [];
  for (let r = 2; r <= 634; r++) {
    const l = f.lignes[r] || {};
    const c = l.F;
    if (!c) { compte.absente++; continue; }
    if (c.t === "s" || c.t === "str") {
      if (String(c.v ?? "").trim() === "") compte.texteVide++;
      else compte.texte++;
      if (exemples.length < 8) exemples.push(`${r} ${l.A?.v}: ${typeDe(c)}`);
    } else {
      compte.nombre++;
      if (Number(c.v) === 0) compte.zero++;
    }
  }
  console.log("  ", JSON.stringify(compte));
  console.log("   exemples texte :", exemples.join(" | "));
  const sansPrix = [];
  for (let r = 2; r <= 634; r++) {
    const l = f.lignes[r] || {};
    if (l.F && (String(l.F.v ?? "").trim() === "" || Number(l.F.v) === 0)) sansPrix.push(`${r}:${l.A.v}`);
  }
  console.log(`   clés sans prix exploitable : ${sansPrix.length} → ${sansPrix.slice(0, 15).join(", ")}`);
}

console.log("\n═══ PERTES : lignes sans désignation ═══");
{
  const f = inv.feuilles.Pertes;
  for (const r of [48, 69, 96, 116, 134]) {
    const l = f.lignes[r] || {};
    console.log(`  ligne ${r} : A=${JSON.stringify(l.A?.v)} B=${JSON.stringify(l.B?.v)} C=${JSON.stringify(l.C?.v)} D=${JSON.stringify(l.D?.v)} F=${JSON.stringify(l.F?.v)} · B ${typeDe(l.B)}`);
  }
}

console.log("\n═══ INVENTAIRES : lignes sans désignation (détail) ═══");
{
  const f = inv.feuilles["Inventaire Initial"];
  for (const r of [54, 76, 104, 106, 129, 150, 177, 186, 208, 228, 271, 311, 312]) {
    const l = f.lignes[r] || {};
    console.log(`  ${r} : A=${JSON.stringify(l.A?.v)} C=${typeDe(l.C)} D=${JSON.stringify(l.D?.v)} E=${JSON.stringify(l.E?.v)} K=${JSON.stringify(l.K?.v)} N=${JSON.stringify(l.N?.v)}`);
  }
}

console.log("\n═══ TRANSFERTS / DOUANE : colonne date (format) ═══");
for (const nom of ["Transferts", "P.Douane"]) {
  const f = inv.feuilles[nom];
  const c = f.lignes[5].A;
  console.log(`  ${nom} A5 : t=${c.t} s=${c.s} format=${JSON.stringify(c.z)} valeur=${JSON.stringify(c.v)}`);
}

console.log("\n═══ PMIX : statut et cellules de saisie ═══");
{
  const f = inv.feuilles.PMIX;
  const l = f.lignes[3];
  console.log("  ligne 3 :", Object.keys(l).sort().map((c) => `${c}: t=${l[c].t} fmt=${JSON.stringify(l[c].z)} v=${JSON.stringify(l[c].v ?? "")}`).join(" | "));
  console.log("  F3 (statut) :", JSON.stringify(l.F.f).slice(0, 200));
  console.log("  lignes de saisie 3..1002 :", 1002 - 3 + 1);
}
