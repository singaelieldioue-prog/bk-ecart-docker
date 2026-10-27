import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx-js-style";
const wb = XLSX.read(fs.readFileSync(path.resolve("../tmp_verif/Suivi_BK1_Octobre_2026_corrige.xlsx")), { type: "buffer" });
for (const nom of ["Transferts", "Pertes", "Référentiel PMIX", "PMIX"]) {
  const ws = wb.Sheets[nom];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log(`\n===== ${nom} — ${rows.length} lignes, ref ${ws["!ref"]}`);
  for (let i = 0; i < Math.min(9, rows.length); i++) {
    const r = rows[i] || [];
    const cells = r.map((v, j) => `${XLSX.utils.encode_col(j)}=${typeof v === "string" ? JSON.stringify(v.slice(0, 28)) : v}`).filter((s) => !s.endsWith("=null"));
    console.log(`  L${i + 1} : ${cells.join(" | ") || "(vide)"}`);
  }
}
