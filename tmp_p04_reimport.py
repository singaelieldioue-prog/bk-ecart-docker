# Lecture seule — P0-4 : chaîne de RÉIMPORT (resoudrePrix) + ce que les rapports contiennent vraiment.
import json, re, sqlite3, sys, unicodedata
sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from audit_referentiel import read_sheet_rows


def norm(s):
    if s is None or s == "":
        return ""
    s = str(s).strip()
    s = unicodedata.normalize("NFD", s)
    s = re.sub("[\u0300-\u036f]", "", s)
    s = re.sub("[\u2019'\u2018]", "", s)
    s = re.sub("[^A-Z0-9\\s]", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"\s+", " ", s)
    return s.upper()


con = sqlite3.connect("file:backend/data.db?mode=ro", uri=True)
con.row_factory = sqlite3.Row
def _load(v):
    try:
        return json.loads(v)
    except Exception:
        return None
kv = {k: _load(v) for (k, v) in con.execute("select k, v from kv")}


def decode_deep(x):
    """Les valeurs stockées par saveRatiosMemo sont doublement encodées (JSON.stringify d'un Map)."""
    if isinstance(x, str):
        try:
            return decode_deep(json.loads(x))
        except Exception:
            return x
    if isinstance(x, dict):
        return {k: decode_deep(v) for k, v in x.items()}
    if isinstance(x, list):
        return [decode_deep(v) for v in x]
    return x
ratios = kv["bk_sia_ratios_parsed_v1"]
base_article = kv["bk_sia_base_article_map_v1"]
local_articles = kv["bk_sia_local_articles_v1"]
corr_memo = kv["bk_sia_correspondance_map_v1"]
pmix_comp = kv["bk_sia_pmix_complement_v1"]

# ── App.jsx:419-435 : injection de la Correspondance dans waLandedCost, telle qu'écrite ──
corr_norm = corr_memo if (corr_memo or {}).get("v") == 2 else {"map": corr_memo or {}, "byCode": {}}
nb_injectes = 0
for k, entry in (corr_norm.get("map") or {}).items():
    if not isinstance(entry, dict):
        continue
    if not ((entry.get("pmpCarton") or 0) > 0 or (entry.get("puPiece") or 0) > 0):
        continue
    cur = ratios["waLandedCost"].get(k)
    if (not cur) or (entry.get("statut") == "ACTIF" and (cur or {}).get("statut") != "ACTIF"):
        ratios["waLandedCost"][k] = {**entry, "source": "Correspondance"}
        nb_injectes += 1

# ── resoudrePrix (calculators.js:6-33), instrumenté étape par étape ──
def resoudre(nom_stock, trace=False):
    k = norm(nom_stock)
    be = base_article.get(k)
    steps = []

    def wcdt(o, base_entry):
        return {**o, "qteCdt": o.get("qteCdt") or ((base_entry or {}).get("cdt") or 1)}
    if ratios["waLandedCost"].get(k):
        o = ratios["waLandedCost"][k]
        r = {**wcdt(o, be), "source": "WA Landed Cost"}
        steps.append(("1 waLandedCost", k, "OUI", o))
        return r, steps, 1
    steps.append(("1 waLandedCost", k, "non", None))
    if be and be.get("corresponRatio"):
        kc = norm(be["corresponRatio"])
        hit = ratios["waLandedCost"].get(kc)
        steps.append(("2 corresponRatio->WA", kc, "OUI" if hit else "non", ratios["waLandedCost"].get(kc)))
        if hit:
            return {**wcdt(hit, be), "source": "Base article → WA"}, steps, 2
    else:
        steps.append(("2 corresponRatio->WA", "aucune entrée BASE", "non", None))
    if local_articles.get(k):
        loc = local_articles[k]
        steps.append(("3 base locale", k, "OUI", loc))
        return ({"puPiece": loc.get("puPiece"), "pmpCarton": loc.get("pmpCarton"),
                 "qteCdt": loc.get("cdt") or (be or {}).get("cdt") or 1, "source": "Base locale"}, steps, 3)
    steps.append(("3 base locale", k, "non", None))
    if be and be.get("codeBollore"):
        ck = norm(be["codeBollore"])
        by = next((a for a in local_articles.values() if a.get("code") and norm(a["code"]) == ck), None)
        steps.append(("4 codeBollore->locale", ck, "OUI" if by else "non", by))
        if by:
            return ({"puPiece": by.get("puPiece"), "pmpCarton": by.get("pmpCarton"),
                     "qteCdt": by.get("cdt") or (be or {}).get("cdt") or 1, "source": "Base locale (code)"}, steps, 4)
    if ratios["pmpByIng"].get(k):
        steps.append(("5 pmpByIng", k, "OUI", ratios["pmpByIng"][k]))
        return ({"puPiece": ratios["pmpByIng"][k], "pmpCarton": None,
                 "qteCdt": (be or {}).get("cdt") or 1, "source": "PMP ingrédients"}, steps, 5)
    steps.append(("5 pmpByIng", k, "non", None))
    if be:
        steps.append(("6 BASE prix inconnu", k, "OUI", be))
        return ({"puPiece": None, "pmpCarton": None, "qteCdt": be.get("cdt") or 1, "source": "BASE (prix inconnu)"}, steps, 6)
    steps.append(("6 BASE prix inconnu", k, "non", None))
    return ({"puPiece": None, "pmpCarton": None, "qteCdt": 1, "source": "inconnu"}, steps, 0)


gen = json.load(open("tmp_p04_gen.json", encoding="utf-8"))["pepsi_frites"]

# Noms présents dans les Pertes / imports, hors whitelist : mesurés aussi.
EXTRA = ["BOUTEILLE PEPSI ZERO 1,5L", "BOUTEILLE PEPSI 1.5L", "CAN PEPSI 250ML",
         "DIP FRITE SAUCE - 25GR", "DOSETTE FRITE SAUCE AMERIGO - 10GR",
         "DOSETTE FRITE SAUCE PORTION - 10GR", "COFFRET A FRITE", "PEPSI SMALL",
         "PEPSI ZERO LIGHT SMALL", "LOW COATED FRIES", "MEDIUM FRIES BAG", "SMALL FRIES BAG"]

res = []
for a in gen:
    nom = a["nom_feuille"]
    r, steps, hit = resoudre(nom)
    k_col = a["pu_carton_genere_col_K"]
    pu_carton_final = r["pmpCarton"] if (r.get("pmpCarton") or 0) > 0 else (
        k_col if (k_col or 0) > 0 else ((r.get("puPiece") or 0) * (a["cond"] or 1) if (r.get("puPiece") or 0) > 0 else 0))
    res.append({"nom": nom, "code": a["code"], "etape_hit": hit, "source": r["source"],
                "puPiece_ref": r.get("puPiece"), "pmpCarton_ref": r.get("pmpCarton"),
                "qteCdt_ref": r.get("qteCdt"), "K_col_Generation": k_col,
                "puCarton_applique_reimport": pu_carton_final, "steps": steps})
extra = []
for nom in EXTRA:
    r, steps, hit = resoudre(nom)
    extra.append({"nom": nom, "etape_hit": hit, "source": r["source"],
                  "pmpCarton_ref": r.get("pmpCarton"), "puPiece_ref": r.get("puPiece"),
                  "qteCdt_ref": r.get("qteCdt"), "present_waLandedCost": norm(nom) in ratios["waLandedCost"],
                  "present_pmpByIng": norm(nom) in ratios["pmpByIng"],
                  "present_local": norm(nom) in local_articles,
                  "present_BASE": norm(nom) in base_article,
                  "corresponRatio": (base_article.get(norm(nom)) or {}).get("corresponRatio"),
                  "codeBollore": (base_article.get(norm(nom)) or {}).get("codeBollore")})

# ── Rapports : ce qui est réellement enregistré ──
RIDS = [("60198f93-f763-4bb9-b84c-05e63d01d639", "BK1 23/10"),
        ("76b8d757-ebe4-4d46-a9e1-0aa3a79de44c", "BK COCODY 22/10")]
PLU_PF = {"705", "706", "710", "713", "715", "717", "728", "732", "776",
          "400101", "400102", "400103", "400111", "400112", "400113",
          "400116", "400117", "400118", "400121", "400122", "400123", "400265", "400266"}
rapports = []
for rid, label in RIDS:
    d = json.loads(con.execute("select data from reports where id=?", (rid,)).fetchone()[0])
    calc = d["calc"]
    pt = [p for p in calc["pmixTheo"] if re.search(r"PEPSI|FRITE", str(p.get("nom") or ""), re.I)]
    ci = [c for c in calc["consoParIng"] if re.search(r"PEPSI|FRITE", str(c.get("nom") or ""), re.I)]
    ae = [a for a in calc["articlesEcart"] if re.search(r"PEPSI|FRITE", str(a.get("nom") or ""), re.I)]
    # ratioToStock (calculators.js:154-157) pour chaque ingrédient Pepsi/frites
    ratio_to_stock = {}
    for stock_key, e in base_article.items():
        cr = (e or {}).get("corresponRatio")
        if cr:
            rk = norm(cr)
            ratio_to_stock.setdefault(rk, stock_key)
    inv_keys = {norm(a.get("nom")): a.get("nom") for a in d["stockData"]["invFin"].values()}
    m = []
    for c in ci:
        rk = norm(c["nom"])
        tgt = rk if any(norm(a["nom"]) == rk for a in d["stockData"]["invIni"].values()) else ratio_to_stock.get(rk)
        m.append({"ingredient": c["nom"], "ing_key": rk, "qteTotal": c["qteTotal"],
                  "valeurTotal": c["valeurTotal"], "pmp": c.get("pmp"),
                  "match_direct_nom_stock": tgt == rk, "via_corresponRatio": (None if tgt == rk else ratio_to_stock.get(rk)),
                  "stock_cible_ref": tgt, "stock_cible_nom": inv_keys.get(tgt) if tgt else None})
    # mapping PMIX → article : existe-t-il un PLU Pepsi/frites dont la recette contient un ingrédient
    # qui corresponde à une ligne d'inventaire Pepsi/frites ?
    fiches = []
    for p in pt:
        fiche = ratios["byPlu"].get(str(p["plu"]).strip())
        fiches.append({"plu": p["plu"], "nom": p["nom"], "qty": p["qty"], "coutUnit": p.get("coutUnit"),
                       "coutTheo": p.get("coutTheo"), "source": p.get("source"), "match": p.get("match"),
                       "fiche_ratio_presente": bool(fiche),
                       "ingredients_recette": [i.get("ing") for i in (fiche or {}).get("coutParIng", [])][:12] if fiche else []})
    rapports.append({
        "label": label, "site": d.get("site"), "dateLabel": d.get("dateLabel"),
        "ratiosMeta": d.get("ratiosMeta"), "isMulti": d.get("isMulti"),
        "nb_invIni": len(d["stockData"]["invIni"]),
        "pmixTheo_pepsi_frites": pt, "consoParIng_pepsi_frites": ci,
        "articlesEcart_pepsi_frites": ae, "ing_vers_stock": m, "fiches": fiches,
        "calc_totaux": {k: calc.get(k) for k in ("consoReelle", "consoTheoTotal", "ecartMatiere",
                                                 "complementMatchees", "ficheMatchees", "consoTheoComplement")},
    })

out = {"nb_injection_correspondance_effective": nb_injectes,
       "corr_memo_a_v2": bool((corr_memo or {}).get("v") == 2),
       "waLandedCost_len_apres_injection": len(ratios["waLandedCost"]),
       "resolution_reimport": res, "resolution_noms_hors_whitelist": extra, "rapports": rapports}
json.dump(out, open("tmp_p04_reimport.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps({k: out[k] for k in ("nb_injection_correspondance_effective", "corr_memo_a_v2", "waLandedCost_len_apres_injection")}, ensure_ascii=False))
for r in res:
    print(f"L{r['nom']:32s} | K={r['K_col_Generation']} | etape={r['etape_hit']} src={r['source']:22s} pmpCarton={r['pmpCarton_ref']} puPiece={r['puPiece_ref']} cdt={r['qteCdt_ref']} -> applique {r['puCarton_applique_reimport']}")
print("--- hors whitelist ---")
for r in extra:
    print(f"L{r['nom']:34s} | etape={r['etape_hit']} src={r['source']:22s} pmpCarton={r['pmpCarton_ref']} puPiece={r['puPiece_ref']} | wa={r['present_waLandedCost']} ing={r['present_pmpByIng']} loc={r['present_local']} base={r['present_BASE']} corr={r['corresponRatio']!r}")
