# Lecture seule — P0-4 : chaîne de GÉNÉRATION des lignes Pepsi/frites de la whitelist.
import json, re, sqlite3, sys, unicodedata
sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from audit_referentiel import (dedupe_articles, normalize_inventory_value, read_sheet_rows, jsnum)

DB = "backend/data.db"
EX = "frontend/public/exemple inventaire.xlsx"


def norm(s):
    """Port de norm() — frontend/src/utils/formatters.js:24-34."""
    if s is None or s == "":
        return ""
    s = str(s).strip()
    s = unicodedata.normalize("NFD", s)
    s = re.sub("[\u0300-\u036f]", "", s)
    s = re.sub("[\u2019'\u2018]", "", s)
    s = re.sub("[^A-Z0-9\\s]", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"\s+", " ", s)
    return s.upper()


def normalize_string(s):
    """Port de normalizeString (excelExporter.js:348-353) : MAJUS + NFD, ponctuation et espaces CONSERVÉS."""
    s = str(s or "").strip().upper()
    s = unicodedata.normalize("NFD", s)
    return re.sub("[\u0300-\u036f]", "", s)


def custom_order():
    src = open("frontend/src/utils/customArticleOrder.js", encoding="utf-8").read()
    start = src.index("CUSTOM_ARTICLES_ORDER = [") + len("CUSTOM_ARTICLES_ORDER = [")
    end = src.index("\n]", start)
    return re.findall(r'"((?:[^"\\]|\\.)*)"', src[start:end])


con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
con.row_factory = sqlite3.Row
def _load(v):
    try:
        return json.loads(v)
    except Exception:
        return None
kv = {k: _load(v) for (k, v) in con.execute("select k, v from kv")}
arts_db = [dict(r) for r in con.execute(
    "SELECT * FROM articles WHERE actif = 1 ORDER BY CASE TRIM(categorie) "
    "WHEN 'Boissons' THEN 1 WHEN 'Nourriture - Surgelé' THEN 2 WHEN 'Nourriture - Frais' THEN 3 "
    "WHEN 'Nourriture - Sec' THEN 4 WHEN 'Packaging' THEN 5 WHEN 'Produits de Nettoyage' THEN 6 ELSE 99 END, "
    "CASE WHEN ordre_affichage > 0 THEN ordre_affichage ELSE 1000000 + rowid END").fetchall()]
arts = dedupe_articles(arts_db)
local = kv.get("bk_sia_local_articles_v1", {})

rows = read_sheet_rows(EX, "inventaire")
ref_rows = []
for i, row in enumerate(rows[6:], start=6):
    if len(row) > 14 and row[3] and row[14]:
        ref_rows.append({"excel_row": i + 1, "name": row[3], "code": row[14],
                         "categorie": row[1] or "", "cond": row[4] if isinstance(row[4], (int, float)) else 1,
                         "qte_inner": row[5] if isinstance(row[5], (int, float)) else 0,
                         "unite": row[10] or ""})
by_code, by_name = {}, {}
for a in arts:
    if a.get("code"):
        by_code.setdefault(normalize_inventory_value(a["code"]), a)
    if a.get("nom"):
        by_name.setdefault(normalize_inventory_value(a["nom"]), a)

ordered = []
for r in ref_rows:
    src = by_code.get(normalize_inventory_value(r["code"])) or by_name.get(normalize_inventory_value(r["name"]))
    o = dict(src or {})
    o.update({"nom": r["name"], "code": r["code"], "categorie": r["categorie"],
              "conditionnement": r["cond"], "qteInner": r["qte_inner"],
              "unite": r["unite"] or (src or {}).get("unite") or ""})
    o["_excel_row"] = r["excel_row"]
    o["_row_src"] = None if src else "AUCUN appariement base"
    if src:
        o["_match"] = "code" if normalize_inventory_value(r["code"]) in by_code and by_code[normalize_inventory_value(r["code"])] is src else "nom"
        o["_src_nom"] = src.get("nom"); o["_src_ref"] = src.get("ref"); o["_src_code"] = src.get("code")
        o["_src_pu_carton"] = src.get("pu_carton"); o["_src_pu_piece"] = src.get("pu_piece")
    ordered.append(o)

CUSTOM = custom_order()
cmap = {normalize_string(n): i for i, n in enumerate(CUSTOM)}
kept = [a for a in ordered if normalize_string(a["nom"]) in cmap]


def enrich(articles, local_articles):
    by_code = {norm(a["code"]): a for a in local_articles.values() if a.get("code")}
    out = []
    FACTEUR_MAX = 20

    def coherent(x, y):
        if not (x > 0) or not (y > 0):
            return True
        f = x / y
        return 1 / FACTEUR_MAX <= f <= FACTEUR_MAX
    for a in articles:
        a = dict(a)
        loc = local_articles.get(norm(a.get("nom") or "")) or (by_code.get(norm(a["code"])) if a.get("code") else None)
        if not loc:
            out.append(a); continue
        ratio_actif = norm(a.get("statut")) != "INACTIF" and ((a.get("pu_carton") or 0) > 0 or (a.get("pu_piece") or 0) > 0)
        cmp_carton = coherent(loc["pmpCarton"], a["pu_carton"]) if (loc.get("pmpCarton", 0) > 0 and (a.get("pu_carton") or 0) > 0) else True
        cmp_piece = coherent(loc["puPiece"], a["pu_piece"]) if (loc.get("puPiece", 0) > 0 and (a.get("pu_piece") or 0) > 0) else True
        prix_ok = (not ratio_actif) or (cmp_carton and cmp_piece)
        cond_local = loc["cdt"] if loc.get("cdt", 0) > 1 else 0
        cond = cond_local or a.get("conditionnement") or 1
        piece_loc = None if (not prix_ok or not loc.get("pmpCarton", 0) > 0) else (
            loc["puPiece"] if (cond_local > 0 or cond <= 1) else loc["pmpCarton"] / cond)
        a["_dbg"] = {"loc_nom": loc.get("nom"), "loc_code": loc.get("code"), "loc_cdt": loc.get("cdt"),
                     "loc_pmpCarton": loc.get("pmpCarton"), "loc_puPiece": loc.get("puPiece"),
                     "ratio_actif": ratio_actif, "prix_ok": prix_ok, "cond_local": cond_local}
        a["pu_piece"] = piece_loc if (piece_loc is not None and piece_loc > 0) else a.get("pu_piece")
        a["pu_carton"] = loc["pmpCarton"] if (prix_ok and loc.get("pmpCarton", 0) > 0) else a.get("pu_carton")
        a["conditionnement"] = cond_local or a.get("conditionnement") or None
        out.append(a)
    return out

gen = enrich(ordered, local)
pat = re.compile(r"PEPSI|FRITES", re.I)
res = []
for a in gen:
    if not pat.search(str(a.get("nom", "")) + " " + str(a.get("code", ""))):
        continue
    res.append({
        "excel_row": a["_excel_row"], "nom_feuille": a["nom"], "code": a["code"],
        "categorie": a["categorie"], "cond": a["conditionnement"], "qteInner": a.get("qteInner"),
        "unite": a.get("unite"),
        "dans_BASE_articles_nom": a.get("_src_nom"), "ref_base": a.get("_src_ref"),
        "code_base": a.get("_src_code"), "pu_carton_base": a.get("_src_pu_carton"),
        "pu_piece_base": a.get("_src_pu_piece"), "statut": a.get("statut"),
        "appariement": a.get("_match") or a.get("_row_src"),
        "enrich": a.get("_dbg"),
        "pu_carton_genere_col_K": a.get("pu_carton"), "pu_piece_genere": a.get("pu_piece"),
        "dans_CUSTOM_ARTICLES_ORDER": normalize_string(a["nom"]) in cmap,
    })

out = {"nb_articles_dedupes": len(arts), "nb_lignes_exemplaire": len(ordered),
       "nb_lignes_generees_CUSTOM": len(kept), "nb_CUSTOM_entries": len(CUSTOM),
       "pepsi_frites": res}
print(json.dumps(out, ensure_ascii=False, indent=1))
json.dump(out, open("tmp_p04_gen.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
