#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
#  audit_referentiel.py — PROMPT 0 « Synchro référentiels & mesure de vérité »
#
#  Audit EN LECTURE SEULE du référentiel articles BK Écart Matières.
#  - Aucune écriture en base (SQLite ouvert mode=ro).
#  - Ne modifie jamais la whitelist, les prix, ni le statut des articles.
#  - Idempotent : mêmes entrées -> mêmes sorties.
#  - Exécutable en local (backend/data.db) comme en prod (bk-data/data.db).
#
#  Usage :
#    python scripts/audit_referentiel.py
#    python scripts/audit_referentiel.py --db bk-data/data.db \
#        --exemplaire frontend/public/exemple inventaire.xlsx --out rapports/
#
#  Sorties : rapport_audit_YYYYMMDD.json + rapport_audit_YYYYMMDD.csv
#  Option  : --no-docs   ne pas synchroniser PRD/mémoire
#            --expected  fichier JSON de valeurs attendues (override)
#
#  Code de sortie : 0 = tous les chiffres conformes ; 2 = alerte(s) de divergence ;
#                   1 = erreur d'exécution.
# ─────────────────────────────────────────────────────────────────────────────

import argparse
import csv
import json
import os
import re
import sqlite3
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, date

# ── Valeurs attendues (mémoire du 23/10) — override possible via --expected ──
EXPECTED = {
    "articles_bruts": 903,
    "inactifs": 0,
    "dedup_actifs": 621,
    "whitelist_lignes": 318,
    "actifs_exclus": 308,
    "apparies_sans_prix": 31,
    "lignes_non_appariees": 6,
    # Cible A7-ter (23/10) : 82 → 41 après dérivation du colisage à l'import (21 lignes)
    # et tolérance d'arrondi (20+1 lignes). Avant application, la mesure est 61.
    "incoherences_prix": 41,
    "incoherences_arrondies": 26,
    "prix_suspects": 1,
    "cdt_non_parsables": 10,
    "lignes_parasites": 2,
}

# ── Critères (documentés) ────────────────────────────────────────────────────
INCOHERENCE_TOL = 0.01          # miroir de near() dans backend/src/articles.js
# Tolérance A7-ter : pu_piece arrondi au franc dans le Ratio → petit écart de forme,
# sans impact monétaire (la conso est valorisée au pu_carton). Écart ≤ 30 F ET < 1 %.
ARRONDI_ECART_ABS = 30.0
ARRONDI_ECART_REL = 0.01
PRIX_SUSPECT_SEUIL = 4_000_000  # FCFA — capte SALADE TREVISE (4 874 840), sous le garde-fou 5 M
PARASITES = {"CODE ARTICLE BOLLORE", "ARTICLE TEST"}  # nom canonique (déjà en majuscules)

NS_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL_PKG = "{http://schemas.openxmlformats.org/package/2006/relationships}"
NS_REL_DOC = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


# ═══════════════════════════ Port fidèle de articles.js ═════════════════════

def jsnum(v):
    """Nombre au sens de JS Number(v) : null->0, ''->0, texte invalide->None(NaN)."""
    if v is None:
        return 0.0
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if s == "":
        return 0.0
    try:
        return float(s)
    except ValueError:
        return None  # NaN


def normalize_article_key(value):
    s = str(value or "").strip()
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s)
    s = re.sub("[\u0300-\u036f]", "", s)
    s = re.sub("[\u2019'\u2018\u201b\u201f]", "", s)
    s = s.replace("-", " ")
    s = re.sub("[^A-Z0-9\\s]", " ", s, flags=re.IGNORECASE | re.UNICODE)
    s = re.sub(r"\s+", " ", s)
    return s.strip().upper()


def canonical_article_name(value):
    raw = normalize_article_key(value or "")
    if not raw:
        return ""
    without = re.sub(r"\b(?:LOCAL|LOCALE|LCL)\b\s*$", "", raw, flags=re.IGNORECASE)
    without = re.sub(r"\s+\d+\s*$", "", without)
    without = re.sub(r"\s+[A-Z]\s*$", "", without, flags=re.IGNORECASE)
    without = re.sub(r"\s+", " ", without).strip()
    return without or raw


def canonical_ref(value):
    return re.sub(r"\s+", " ", normalize_article_key(value or "")).strip()


def compact_code_key(value):
    return canonical_ref(value).replace(" ", "")


def article_identity_key(a):
    for value in (a.get("code"), a.get("ref"), a.get("nom")):
        key = compact_code_key(value)
        if key:
            return key
    return ""


def score_article(a):
    code = str(a.get("code") or "").strip()
    name = str(a.get("nom") or "").strip()
    cond = jsnum(a.get("conditionnement"))
    pu_piece = jsnum(a.get("pu_piece"))
    pu_carton = jsnum(a.get("pu_carton"))
    score = 0
    score += 6 if code else 0
    score += 3 if name else 0
    score += 2 if a.get("categorie") else 0
    score += 5 if (cond is not None and cond > 0) else 0
    if (pu_piece is not None and pu_piece > 0) or (pu_carton is not None and pu_carton > 0):
        score += 12
    if a.get("pu_piece") is not None or a.get("pu_carton") is not None:
        score += 2
    if pu_piece == 0 and pu_carton == 0:
        score += -20
    if a.get("actif") == 1:
        score += 1
    return score


def dedupe_articles(items):
    """Port de dedupeArticles() (backend/src/articles.js:67)."""
    deduped = {}
    unique = 0
    for a in items:
        if not a or (not a.get("ref") and not a.get("nom") and not a.get("code")):
            continue
        primary = article_identity_key(a)
        fallback = canonical_article_name(a.get("nom") or a.get("ref") or a.get("code"))
        key = primary or fallback
        if not key:
            unique += 1
            deduped[f"__uniq__{unique}"] = a
            continue
        existing = deduped.get(key)
        if existing is None or score_article(a) > score_article(existing):
            deduped[key] = a
    return list(deduped.values())


def normalize_inventory_value(value):
    """Port de normalizeInventoryValue (BaseArticlesTab.jsx) : A-Z0-9 only, uppercase."""
    s = str(value or "").upper()
    s = unicodedata.normalize("NFD", s)
    s = re.sub("[\u0300-\u036f]", "", s)
    s = re.sub("[^A-Z0-9]", "", s)
    return s


def js_str(value):
    """ToString au sens JS pour les cellules : 140000001.0 -> '140000001'."""
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


# ═══════════════════════ Lecteur xlsx minimal (stdlib) ══════════════════════

def col_letter_to_index(ref):
    m = re.match(r"([A-Z]+)", ref)
    n = 0
    for ch in m.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_sheet_rows(path, sheet_name):
    """Renvoie une liste de lignes (liste 0-indexée de valeurs), comme sheet_to_json(header:1, defval:null)."""
    with zipfile.ZipFile(path) as z:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rid_to_target = {
            r.get("Id"): r.get("Target")
            for r in rels.findall(f"{NS_REL_PKG}Relationship")
        }
        target = None
        for sh in wb.find(f"{NS_MAIN}sheets"):
            if sh.get("name") == sheet_name:
                rid = sh.get(f"{NS_REL_DOC}id")
                target = rid_to_target[rid]
                break
        if target is None:
            raise ValueError(f"Feuille « {sheet_name} » absente de {path}")
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")

        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            sst = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in sst.findall(f"{NS_MAIN}si"):
                shared.append("".join(t.text or "" for t in si.iter(f"{NS_MAIN}t")))

        root = ET.fromstring(z.read(target))
        rows = {}
        max_col = 0
        for row in root.iter(f"{NS_MAIN}row"):
            r_idx = int(row.get("r")) - 1
            cells = {}
            for c in row.findall(f"{NS_MAIN}c"):
                ref = c.get("r") or ""
                t = c.get("t")
                v = c.find(f"{NS_MAIN}v")
                is_node = c.find(f"{NS_MAIN}is")
                if v is None and is_node is None:
                    value = None
                elif t == "s":
                    value = shared[int(v.text)]
                elif t == "inlineStr":
                    value = "".join(x.text or "" for x in is_node.iter(f"{NS_MAIN}t"))
                elif t == "str":
                    value = v.text or ""
                elif t == "b":
                    value = bool(int(v.text))
                else:
                    try:
                        f = float(v.text)
                        value = int(f) if f.is_integer() else f
                    except (TypeError, ValueError):
                        value = v.text
                idx = col_letter_to_index(ref)
                cells[idx] = value
                max_col = max(max_col, idx)
            rows[r_idx] = cells
        if not rows:
            return []
        width = max_col + 1
        out = []
        for i in range(max(rows) + 1):
            cells = rows.get(i, {})
            out.append([cells.get(j) for j in range(width)])
        return out


# ═══════════════════════════ Audit ══════════════════════════════════════════

def audit(db_path, exemplaire_path):
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    all_rows = [dict(r) for r in conn.execute("SELECT * FROM articles")]
    active_rows = [r for r in all_rows if r.get("actif") == 1]
    conn.close()

    dedup_actifs = dedupe_articles(active_rows)

    sheet = read_sheet_rows(exemplaire_path, "inventaire")
    refs = [r for r in sheet[6:] if r and len(r) > 14 and r[3] and r[14]]

    by_code, by_name = {}, {}
    for a in dedup_actifs:
        if a.get("code"):
            by_code[normalize_inventory_value(a["code"])] = a
        if a.get("nom"):
            by_name[normalize_inventory_value(a["nom"])] = a

    lignes_non_appariees = []
    apparies_sans_prix = []
    nb_apparies = 0
    for r in refs:
        name, code = js_str(r[3]), js_str(r[14])
        src = by_code.get(normalize_inventory_value(code)) or by_name.get(normalize_inventory_value(name))
        if src is not None:
            nb_apparies += 1
            if not (jsnum(src.get("pu_carton")) or 0) > 0:
                apparies_sans_prix.append(src)
        else:
            lignes_non_appariees.append({"nom": name, "code": code})

    refs_code_norm = {normalize_inventory_value(js_str(r[14])) for r in refs}
    refs_nom_norm = {normalize_inventory_value(js_str(r[3])) for r in refs}
    actifs_exclus = [
        a for a in dedup_actifs
        if not ((a.get("code") and normalize_inventory_value(a["code"]) in refs_code_norm)
                or (a.get("nom") and normalize_inventory_value(a["nom"]) in refs_nom_norm))
    ]

    incoherences = []
    arrondies = []
    for a in dedup_actifs:
        carton, piece, cond = jsnum(a.get("pu_carton")), jsnum(a.get("pu_piece")), jsnum(a.get("conditionnement"))
        if carton and piece and cond and carton > 0 and piece > 0 and cond > 0:
            ecart = abs(carton - piece * cond)
            if ecart >= INCOHERENCE_TOL:
                if ecart <= ARRONDI_ECART_ABS and ecart / carton < ARRONDI_ECART_REL:
                    arrondies.append(a)
                else:
                    incoherences.append(a)

    prix_suspects = [a for a in dedup_actifs if (jsnum(a.get("pu_carton")) or 0) >= PRIX_SUSPECT_SEUIL]

    cdt_non_parsables = [
        a for a in dedup_actifs
        if not ((jsnum(a.get("conditionnement")) or 0) > 0)
    ]

    lignes_parasites = [
        a for a in all_rows
        if canonical_article_name(a.get("nom")) in PARASITES
        or normalize_inventory_value(a.get("nom")) in {normalize_inventory_value(x) for x in PARASITES}
    ]

    metriques = {
        "articles_bruts": len(all_rows),
        "inactifs": len(all_rows) - len(active_rows),
        "dedup_actifs": len(dedup_actifs),
        "whitelist_lignes": len(refs),
        "whitelist_apparies": nb_apparies,
        "actifs_exclus": len(actifs_exclus),
        "apparies_sans_prix": len(apparies_sans_prix),
        "lignes_non_appariees": len(lignes_non_appariees),
        "incoherences_prix": len(incoherences),
        "incoherences_arrondies": len(arrondies),
        "prix_suspects": len(prix_suspects),
        "cdt_non_parsables": len(cdt_non_parsables),
        "lignes_parasites": len(lignes_parasites),
    }

    listes = {
        "actifs_exclus": sorted(
            (_slug(a) for a in actifs_exclus), key=lambda x: (x["categorie"] or "", x["nom"] or "")),
        "lignes_non_appariees": lignes_non_appariees,
        "apparies_sans_prix": sorted((_slug(a) for a in apparies_sans_prix), key=lambda x: x["nom"] or ""),
        "incoherences_prix": [
            {**_slug(a), "carton_vs_piece_x_cdt": round(jsnum(a.get("pu_carton")) - jsnum(a.get("pu_piece")) * jsnum(a.get("conditionnement")), 2)}
            for a in incoherences],
        "incoherences_arrondies": [
            {**_slug(a), "carton_vs_piece_x_cdt": round(jsnum(a.get("pu_carton")) - jsnum(a.get("pu_piece")) * jsnum(a.get("conditionnement")), 2)}
            for a in arrondies],
        "prix_suspects": [_slug(a) for a in prix_suspects],
        "cdt_non_parsables": [{**_slug(a), "conditionnement_brut": a.get("conditionnement")} for a in cdt_non_parsables],
        "lignes_parasites": [_slug(a) for a in lignes_parasites],
    }
    return metriques, listes


def _slug(a):
    return {
        "nom": a.get("nom"),
        "code": a.get("code"),
        "categorie": a.get("categorie"),
        "conditionnement": a.get("conditionnement"),
        "pu_carton": a.get("pu_carton"),
        "pu_piece": a.get("pu_piece"),
    }


# ═══════════════════════════ Alertes vs attendus ════════════════════════════

def compare_expected(metriques, expected):
    ecarts = []
    for cle, valeur_attendue in expected.items():
        eu = metriques.get(cle)
        if eu is None:
            ecarts.append({"Cle": cle, "Attendu": valeur_attendue, "Obtenu": "absent du rapport"})
        elif eu != valeur_attendue:
            ecarts.append({"Cle": cle, "Attendu": valeur_attendue, "Obtenu": eu})
    return ecarts


# ═══════════════════════ Sorties JSON + CSV ══════════════════════════════════

def ecrire_sorties(out_dir, metriques, listes, ecarts, db_path, exemplaire_path):
    os.makedirs(out_dir, exist_ok=True)
    jour = date.today().strftime("%Y%m%d")
    rapport = {
        "audit": "referentiel-bk-ecart-matieres",
        "date": datetime.now().isoformat(timespec="seconds"),
        "db": os.path.abspath(db_path),
        "exemplaire": os.path.abspath(exemplaire_path),
        "metriques": metriques,
        "attendu": EXPECTED,
        "ecarts_vs_attendu": ecarts,
        "alerte": bool(ecarts),
        "listes": listes,
    }
    json_path = os.path.join(out_dir, f"rapport_audit_{jour}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, indent=2)

    csv_path = os.path.join(out_dir, f"rapport_audit_{jour}.csv")
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["section", "nom", "code", "categorie", "conditionnement",
                    "pu_carton", "pu_piece", "detail"])
        for section, items in listes.items():
            for it in items:
                detail = it.get("carton_vs_piece_x_cdt") or it.get("conditionnement_brut") or ""
                w.writerow([section, it.get("nom") or "", it.get("code") or "",
                            it.get("categorie") or "", it.get("conditionnement") or "",
                            it.get("pu_carton") if it.get("pu_carton") is not None else "",
                            it.get("pu_piece") if it.get("pu_piece") is not None else "",
                            detail])
    return rapport, json_path, csv_path


# ═══════════════ Synchro docs (PRD + mémoire) depuis le JSON — jamais en dur ═

def sync_docs(rapport, prd_path, memo_path):
    m = rapport["metriques"]
    lines = []
    if prd_path and os.path.exists(prd_path):
        with open(prd_path, encoding="utf-8") as f:
            texte = f.read()
        new6 = ("6. [Écart documenté] La liste des articles des modèles générés est aujourd'hui "
                "**restreinte aux lignes du fichier « exemple inventaire.xlsx »** "
                f"({m['whitelist_lignes']} lignes, audit du {date.today().strftime('%d/%m')}) ; "
                f"≈ 50 % des articles actifs de la base ({m['actifs_exclus']}/{m['dedup_actifs']} "
                "après dédoublonnage) n'y figurent pas et sont donc exclus des classeurs. "
                "Décision de remédiation en attente du CDG (voir §8 Risques R1).")
        new_r1 = ("| R1 | **Couverture du référentiel dans les modèles** (audit automatique) : "
                  f"liste des classeurs = {m['whitelist_lignes']} lignes de l'exemple de référence ; "
                  f"{m['actifs_exclus']}/{m['dedup_actifs']} articles actifs dédupliqués exclus ; "
                  f"{m['lignes_non_appariees']} lignes de référence non appariées ; "
                  f"{m['apparies_sans_prix']} lignes appariées sans prix carton | Élevé (constaté) | "
                  "Écarts sous-estimés, articles non suivis | Décision CDG à trancher : référentiel "
                  "complet trié, union, ou corrections d'appariement — voir §7 V1.1 |")
        out = []
        for line in texte.split("\n"):
            if line.startswith("6. [Écart documenté]"):
                line = new6
            elif line.startswith("| R1 |"):
                line = new_r1
            out.append(line)
        nouveau = "\n".join(out)
        if nouveau != texte:
            with open(prd_path, "w", encoding="utf-8") as f:
                f.write(nouveau)
            lines.append(f"PRD synchronisé : {prd_path}")
        else:
            lines.append("PRD déjà à jour")
    if memo_path and os.path.exists(memo_path):
        with open(memo_path, encoding="utf-8") as f:
            texte = f.read()
        bloc = (
            "<!-- AUDIT-REF:BEGIN -->\n"
            f"Audit référentiel auto (scripts/audit_referentiel.py, {rapport['date'][:10]}) : "
            f"bruts {m['articles_bruts']}, inactifs {m['inactifs']}, dédupliqués actifs {m['dedup_actifs']}, "
            f"whitelist {m['whitelist_lignes']} (appariées {m['whitelist_apparies']}, non appariées "
            f"{m['lignes_non_appariees']}), exclus du modèle {m['actifs_exclus']}, appariés sans prix carton "
            f"{m['apparies_sans_prix']}, incohérences pu_carton≠pu_piece×cdt {m['incoherences_prix']}, "
            f"prix suspects {m['prix_suspects']}, cdt non parsables {m['cdt_non_parsables']}, parasites "
            f"{m['lignes_parasites']}. Alerte : {'OUI — ' + json.dumps(rapport['ecarts_vs_attendu'], ensure_ascii=False) if rapport['alerte'] else 'non'}\n"
            "<!-- AUDIT-REF:END -->")
        if "<!-- AUDIT-REF:BEGIN -->" in texte:
            texte = re.sub(r"<!-- AUDIT-REF:BEGIN -->.*?<!-- AUDIT-REF:END -->", bloc, texte, flags=re.S)
        else:
            texte = texte.rstrip("\n") + "\n\n" + bloc + "\n"
        with open(memo_path, "w", encoding="utf-8") as f:
            f.write(texte)
        lines.append(f"Mémoire synchronisé : {memo_path}")
    return lines


# ═══════════════════════════ Main ════════════════════════════════════════════

def default_db(racine):
    for p in (os.path.join(racine, "backend", "data.db"), os.path.join(racine, "bk-data", "data.db")):
        if os.path.exists(p):
            return p
    return os.path.join(racine, "backend", "data.db")


def default_exemplaire(racine):
    for p in (os.path.join(racine, "frontend", "public", "exemple inventaire.xlsx"),
              os.path.join(racine, "sample_data", "exemple inventaire.xlsx")):
        if os.path.exists(p):
            return p
    return os.path.join(racine, "frontend", "public", "exemple inventaire.xlsx")


def main(argv=None):
    racine = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description="Audit lecture seule du référentiel BK Écart Matières")
    ap.add_argument("--db", default=default_db(racine))
    ap.add_argument("--exemplaire", default=default_exemplaire(racine))
    ap.add_argument("--out", default=os.path.join(racine, "rapports"))
    ap.add_argument("--prd", default=os.path.join(racine, "PRD-BK-Ecart-Matieres.md"))
    ap.add_argument("--memo", default=None, help="fichier mémoire à tenir à jour (bloc à marqueurs)")
    ap.add_argument("--expected", default=None, help="JSON de valeurs attendues (override)")
    ap.add_argument("--no-docs", action="store_true", help="ne pas synchroniser PRD/mémoire")
    args = ap.parse_args(argv)

    if not os.path.exists(args.db):
        print(f"ERREUR : base introuvable : {args.db}", file=sys.stderr)
        return 1
    if not os.path.exists(args.exemplaire):
        print(f"ERREUR : exemple inventaire introuvable : {args.exemplaire}", file=sys.stderr)
        return 1

    expected = dict(EXPECTED)
    if args.expected:
        with open(args.expected, encoding="utf-8") as f:
            expected.update(json.load(f))

    metriques, listes = audit(args.db, args.exemplaire)
    ecarts = compare_expected(metriques, expected)
    rapport, json_path, csv_path = ecrire_sorties(args.out, metriques, listes, ecarts, args.db, args.exemplaire)

    print(f"Base        : {args.db} (lecture seule)")
    print(f"Exemplaire  : {args.exemplaire}")
    print(f"JSON        : {json_path}")
    print(f"CSV         : {csv_path}")
    print("Métriques   :")
    for k, v in metriques.items():
        attendu = expected.get(k)
        marque = "" if attendu is None or attendu == v else f"   (attendu {attendu})"
        print(f"  {k:26s} = {v}{marque}")
    if ecarts:
        print("\nALERTE — écarts vs valeurs attendues :")
        for e in ecarts:
            print(f"  • {e['Cle']} : attendu {e['Attendu']}, obtenu {e['Obtenu']}")
    else:
        print("\nConforme : tous les chiffres correspondent aux valeurs attendues.")

    if not args.no_docs:
        for msg in sync_docs(rapport, args.prd, args.memo):
            print("Docs :", msg)

    return 2 if ecarts else 0


if __name__ == "__main__":
    sys.exit(main())
