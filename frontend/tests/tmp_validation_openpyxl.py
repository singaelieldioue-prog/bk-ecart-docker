# Contrôle indépendant (openpyxl) : la copie corrigée est lue par un second moteur,
# et sa géométrie (fusions, largeurs, hauteurs, images, formules) est comparée à l'original.
import sys
from openpyxl import load_workbook

ORIG = r"tmp_verif/Suivi_BK1_Octobre_2026.xlsx"
CORR = r"tmp_verif/Suivi_BK1_Octobre_2026_corrige.xlsx"

ok = ko = 0


def check(cond, msg, detail=""):
    global ok, ko
    if cond:
        ok += 1
        print("PASS - " + msg)
    else:
        ko += 1
        print("FAIL - " + msg + (("  [" + str(detail) + "]") if detail else ""))


wa = load_workbook(ORIG, data_only=False)
wb = load_workbook(CORR, data_only=False)

check(wb.sheetnames == wa.sheetnames, "les 9 feuilles et leur ordre sont identiques", wb.sheetnames)

# Géométrie : fusions, largeurs de colonnes, hauteurs de lignes, images.
for nom in wa.sheetnames:
    a, b = wa[nom], wb[nom]
    check(b.max_row == a.max_row and b.max_column == a.max_column,
          f"{nom} : grille identique ({b.max_row} lignes × {b.max_column} colonnes)",
          f"{a.max_row}x{a.max_column} -> {b.max_row}x{b.max_column}")
    check(sorted(str(m) for m in b.merged_cells.ranges) == sorted(str(m) for m in a.merged_cells.ranges),
          f"{nom} : fusions de cellules identiques ({len(b.merged_cells.ranges)})")
    largeurs_a = {k: v.width for k, v in a.column_dimensions.items() if v.width}
    largeurs_b = {k: v.width for k, v in b.column_dimensions.items() if v.width}
    check(largeurs_a == largeurs_b, f"{nom} : largeurs de colonnes identiques ({len(largeurs_b)})")
    hauteurs_a = {k: v.height for k, v in a.row_dimensions.items() if v.height}
    hauteurs_b = {k: v.height for k, v in b.row_dimensions.items() if v.height}
    check(hauteurs_a == hauteurs_b, f"{nom} : hauteurs de lignes identiques ({len(hauteurs_b)})")
    check(len(b._images) == len(a._images), f"{nom} : mêmes images ({len(b._images)})")

# Formules : aucune perdue, aucune en erreur.
def formules(ws):
    return {c.coordinate: c.value for row in ws.iter_rows() for c in row if c.data_type == "f"}


for nom in ["Inventaire Initial", "Inventaire Final"]:
    fa, fb = formules(wa[nom]), formules(wb[nom])
    manquantes = sorted(set(fa) - set(fb))
    check(not manquantes, f"{nom} : aucune formule perdue ({len(fb)} formules)", ", ".join(manquantes[:5]))
    erreurs = [c for c, v in fb.items() if isinstance(v, str) and v.startswith("#")]
    check(not erreurs, f"{nom} : aucune formule en erreur (#REF!/#VALUE!)", ", ".join(erreurs[:5]))

# Le contenu corrigé, lu par openpyxl.
for nom in ["Inventaire Initial", "Inventaire Final"]:
    ws = wb[nom]
    check(ws["N227"].value == "SSM4000", f"{nom} : N227 = SSM4000 ({ws['N227'].value})")
    check(ws["C227"].value == "SACHET SNACK MOYEN 4000", f"{nom} : C227 = SACHET SNACK MOYEN 4000")
    check(ws["C312"].value is None and ws["D312"].value is None and ws["E312"].value is None and ws["N312"].value is None,
          f"{nom} : ligne 312 vidée (C/D/E/N vides)")
    check(ws["C311"].value == "SANITIZER TABLETTE " and ws["D311"].value == 1380 and ws["E311"].value == 230
          and ws["K311"].value == 62935, f"{nom} : ligne 311 intacte (1 380 / 230 / 62 935)")

print("\nRésultat openpyxl : %d PASS / %d FAIL" % (ok, ko))
sys.exit(1 if ko else 0)
