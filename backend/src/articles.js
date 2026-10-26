// ─────────────────────────────────────────────────────────────────────────────
//  Référentiel ARTICLES — diff & synchronisation au chargement d'un nouveau Ratio.
//  Source : feuille "WA Landed Cost" du Ratio (désignation, conditionnement, prix, statut).
// ─────────────────────────────────────────────────────────────────────────────

const num = (v) => (v == null || isNaN(v)) ? null : Number(v);
const near = (a, b) => Math.abs((a || 0) - (b || 0)) < 0.01;

const normalizeArticleKey = (value) => {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019'’]/g, '')
    .replace(/-/g, ' ')
    .replace(/[^A-Z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

const canonicalArticleName = (value) => {
  const raw = normalizeArticleKey(value || '');
  if (!raw) return '';

  const withoutLocaleSuffix = raw
    .replace(/\b(?:LOCAL|LOCALE|LCL)\b\s*$/gi, '')
    .replace(/\s+\d+\s*$/g, '')
    .replace(/\s+(?:A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z)\s*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return withoutLocaleSuffix || raw;
};

const canonicalRef = (value) => normalizeArticleKey(value || '').replace(/\s+/g, ' ').trim();

// Ligne sans désignation réelle ET sans prix : ni valorisable, ni contrôlable dans un
// inventaire. Import du 01/09 (colonnes lues avec un décalage) — capture CDG « ELEMENT A
// SUPRIMER » du 25/10. Elle reste inactive à l'insertion comme à la mise à jour, et revient
// d'elle-même dès que le fichier source lui donne un nom ou un prix.
// `cur` (ligne déjà en base) est inspecté lui aussi : une synchronisation qui n'apporte pas
// de désignation ne doit pas effacer une ligne qui en a une.
export const isLigneSansValeur = (it, cur = null) => {
  if (!it && !cur) return false;
  const code = normalizeArticleKey(it?.code || it?.ref || cur?.code || cur?.ref);
  const nom = normalizeArticleKey(it?.nom) || normalizeArticleKey(cur?.nom);
  const sansNom = !nom || nom === code;
  const aUnPrix = [it?.puCarton, it?.pu_piece, it?.pu_carton, cur?.pu_carton, cur?.pu_piece, it?.puPiece]
    .some((v) => Number(v) > 0);
  return sansNom && !aUnPrix;
};

// L'actif attendu d'une ligne entrante : la règle du Ratio, sauf ligne sans valeur.
const actifAttendu = (it, cur = null) => {
  if (isLigneSansValeur(it, cur)) return 0;
  return (it && it.actif !== undefined && it.actif !== null) ? (Number(it.actif) === 0 ? 0 : 1) : 1;
};

// Unités de mesure admises dans la base, orthographe et casse stabilisées. Le fichier source
// écrit « carton », « CARTON », « piece », « Pi?ce », « PACK »… : le CDG doit lire un seul
// mot par unité, sinon la colonne Unité du classeur exporté devient inutilisable.
const UNITES = {
  CARTON: "Carton", CARTONS: "Carton",
  PIECE: "Pièce", PCS: "Pièce", UNITE: "Pièce", U: "Pièce",
  PACK: "Pack",
  INNER: "Inner",
  BOITE: "Boîte", BTE: "Boîte",
  BIDON: "Bidon", SEAU: "Seau", BOBINE: "Bobine", PALET: "Palet", PLAQUE: "Plaque",
  GRAMME: "Gramme", G: "Gramme",
  KG: "Kg", KILOGRAMME: "Kg",
  LITRE: "Litre", L: "Litre",
  SACHET: "Sachet", BOUTEILLE: "Bouteille", FLACON: "Flacon", LOT: "Lot", KIT: "Kit",
  ROULEAU: "Rouleau",
};

// « 1 inner de 4 », « 1 lot de 2 » : le colisage est porté par l'unité. On ne garde que
// l'unité — le nombre est déjà porté par la colonne Conditionnement.
export const canonUnite = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const mot = normalizeArticleKey(raw.replace(/^\s*1\s+/, "").replace(/\s+de\s+\d+\s*$/i, ""));
  return UNITES[mot] || raw;
};

// Unité reconnue seule : « 10500 stickers par inner » est une consigne de saisie, pas une
// unité. Un fichier de référence ne peut donc imposer une unité que sous cette forme.
export const uniteConnue = (value) => {
  const raw = String(value ?? "").trim();
  return raw && UNITES[normalizeArticleKey(raw.replace(/^\s*1\s+/, "").replace(/\s+de\s+\d+\s*$/i, ""))] ? canonUnite(raw) : "";
};

// Unité écrite en base : celle de la source, sinon celle que le colisage implique. Un article
// livré à l'unité se compte en Pièce ; conditionné (colisage > 1), il se compte en Carton.
const uniteAttendue = (it, cur = null) => {
  const deSource = uniteConnue(it?.unite);
  if (deSource) return deSource;
  if (String(cur?.unite ?? "").trim()) return null;      // la base a déjà une unité : COALESCE la garde
  const cond = Number(it?.conditionnement ?? cur?.conditionnement);
  return cond > 1 ? "Carton" : "Pièce";
};

const compactCodeKey = (value) => canonicalRef(value).replace(/\s+/g, '');

const articleIdentityKey = (article) => {
  const values = [article?.code, article?.ref, article?.nom];
  for (const value of values) {
    const key = compactCodeKey(value);
    if (key) return key;
  }
  return '';
};

const scoreArticle = (article) => {
  const code = String(article?.code ?? '').trim();
  const name = String(article?.nom ?? '').trim();
  const conditionnement = Number(article?.conditionnement);
  const puPiece = Number(article?.pu_piece);
  const puCarton = Number(article?.pu_carton);
  const hasCode = code.length > 0 ? 6 : 0;
  const hasName = name.length > 0 ? 3 : 0;
  const hasCategorie = article?.categorie ? 2 : 0;
  const hasConditionnement = Number.isFinite(conditionnement) && conditionnement > 0 ? 5 : 0;
  const hasRealPrice = (Number.isFinite(puPiece) && puPiece > 0) || (Number.isFinite(puCarton) && puCarton > 0) ? 12 : 0;
  const hasPriceField = (article?.pu_piece != null || article?.pu_carton != null) ? 2 : 0;
  const zeroPricePenalty = (Number(article?.pu_piece) === 0 && Number(article?.pu_carton) === 0) ? -20 : 0;
  const isActive = article?.actif === 1 ? 1 : 0;
  return hasCode + hasName + hasCategorie + hasConditionnement + hasRealPrice + hasPriceField + isActive + zeroPricePenalty;
};

export function dedupeArticles(list = []) {
  const deduped = new Map();

  for (const article of list) {
    if (!article || (!article.ref && !article.nom && !article.code)) continue;

    const primaryKey = articleIdentityKey(article);
    const fallbackKey = canonicalArticleName(article.nom || article.ref || article.code);
    const key = primaryKey || fallbackKey;

    if (!key) {
      const fallbackKeyUnique = `${Math.random()}` + Math.random();
      deduped.set(fallbackKeyUnique, article);
      continue;
    }

    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, article);
      continue;
    }

    // Favorise la ligne la plus complète (code + catégorie + conditionnement + prix réel),
    // en gardant la version qui a la meilleure qualité d'information pour un même article.
    if (scoreArticle(article) > scoreArticle(existing)) {
      deduped.set(key, article);
    }
  }

  // Fallback: si deux articles ont le même nom canonique mais des codes distincts, on les garde séparés.
  // Le code article est la clé stable; le nom devient uniquement un secours quand le code manque.
  return Array.from(deduped.values());
}

// Compare la liste entrante à la base courante SANS rien modifier.
export function computeDiff(db, incoming) {
  const cleanIncoming = dedupeArticles(incoming);
  const current = db.prepare('SELECT * FROM articles').all();
  const curByRef = new Map(current.map((a) => [a.ref, a]));
  const added = [], updated = [], reactivated = [], deactivatedIn = [];

  for (const it of cleanIncoming) {
    if (!it || !it.ref) continue;
    const ref = canonicalRef(it.ref);
    if (!ref) continue;
    const cur = curByRef.get(ref);
    const want = actifAttendu(it, cur);
    if (!cur) { added.push({ ref, nom: it.nom || ref }); continue; }
    const changes = [];
    if (!near(cur.pu_piece, num(it.puPiece)))     changes.push('prix pièce');
    if (!near(cur.pu_carton, num(it.puCarton)))   changes.push('prix carton');
    if (!near(cur.conditionnement, num(it.conditionnement))) changes.push('conditionnement');
    if ((cur.statut || '') !== (it.statut || '')) changes.push('statut');
    if (cur.actif === 0 && want === 1) reactivated.push({ ref, nom: it.nom || ref });
    if (cur.actif === 1 && want === 0) deactivatedIn.push({ ref, nom: it.nom || ref });
    if (changes.length) updated.push({ ref, nom: it.nom || ref, changes });
  }
  // applySync ne désactive pas les absents du Ratio et ne change pas la colonne actif.
  const deactivated = deactivatedIn;

  return {
    added, updated, reactivated, deactivated,
    counts: {
      added: added.length,
      updated: updated.length,
      reactivated: reactivated.length,
      deactivated: deactivated.length,
      unchanged: Math.max(0, current.length - updated.length - reactivated.length - deactivated.length),
      base_before: current.length,
      incoming: incoming.length,
    },
  };
}

// Applique la synchronisation SÉCURISÉE: met à jour les champs du Ratio
// SANS écraser les autres champs (nom, code, catégorie, etc.)
// SANS désactiver les articles absents du ratio
export function applySync(db, incoming, source) {
  const cleanIncoming = dedupeArticles(incoming);
  const diff = computeDiff(db, cleanIncoming);

  const updateFromRatio = db.prepare(`
    UPDATE articles 
    SET conditionnement=COALESCE(@conditionnement, conditionnement),
      unite=COALESCE(@unite, unite),
        pu_carton=COALESCE(@pu_carton, pu_carton),
        pu_piece=COALESCE(@pu_piece, pu_piece),
        statut=COALESCE(@statut, statut),
        categorie=COALESCE(@categorie, categorie),
        actif=COALESCE(@actif, actif),
        source=COALESCE(@source, source),
        updated_at=datetime('now')
    WHERE ref=?
  `);

  const tx = db.transaction(() => {
    for (const it of cleanIncoming) {
      if (!it || !it.ref) continue;
      const ref = canonicalRef(it.ref);
      if (!ref) continue;
      const existing = db.prepare('SELECT ref, nom, code, unite, conditionnement, pu_carton, pu_piece FROM articles WHERE ref=?').get(ref);
      const actif = actifAttendu(it, existing);

      if (existing) {
        updateFromRatio.run({
          conditionnement: num(it.conditionnement),
          unite: uniteAttendue(it, existing),
          pu_carton: num(it.puCarton) || null,
          pu_piece: num(it.puPiece) || null,
          statut: it.statut ? String(it.statut).trim() : null,
          categorie: it.categorie ? String(it.categorie).trim() : null,
          actif,
          source: source ? String(source).trim() : null,
        }, ref);
      } else {
        const insertIfNew = db.prepare(`
          INSERT OR IGNORE INTO articles (ref,nom,code,unite,categorie,conditionnement,pu_carton,pu_piece,corresp,statut,actif,ordre_affichage,source,updated_at)
          VALUES (@ref,@nom,@code,@unite,@categorie,@conditionnement,@pu_carton,@pu_piece,@corresp,@statut,@actif,@ordre_affichage,@source,datetime('now'))
        `);
        insertIfNew.run({
          ref,
          nom: String(it.nom || ref).trim(),
          code: it.code ? String(it.code).trim() : ref,
          unite: uniteAttendue(it, null),
          categorie: it.categorie ? String(it.categorie).trim() : null,
          conditionnement: num(it.conditionnement),
          pu_carton: num(it.puCarton),
          pu_piece: num(it.puPiece),
          corresp: it.corresp ? String(it.corresp).trim() : null,
          statut: it.statut ? String(it.statut).trim() : '',
          actif,
          ordre_affichage: num(it.ordre_affichage) || 0,
          source: source ? String(source).trim() : null,
        });
      }
    }
  });
  tx();
  return diff.counts;
}

function mergeArticleFields(primary, secondary) {
  const pick = (a, b) => {
    if (a != null && a !== '' && a !== undefined) return a;
    return b;
  };

  return {
    ref: pick(primary.ref, secondary.ref),
    nom: pick(primary.nom, secondary.nom),
    code: pick(primary.code, secondary.code),
    unite: pick(primary.unite, secondary.unite),
    categorie: pick(primary.categorie, secondary.categorie),
    conditionnement: pick(primary.conditionnement, secondary.conditionnement),
    pu_carton: pick(primary.pu_carton, secondary.pu_carton),
    pu_piece: pick(primary.pu_piece, secondary.pu_piece),
    corresp: pick(primary.corresp, secondary.corresp),
    statut: pick(primary.statut, secondary.statut),
    actif: pick(primary.actif, secondary.actif),
    ordre_affichage: pick(primary.ordre_affichage, secondary.ordre_affichage),
    source: pick(primary.source, secondary.source),
    created_at: pick(primary.created_at, secondary.created_at),
    updated_at: pick(primary.updated_at, secondary.updated_at),
  };
}

export function repairDuplicateArticles(db) {
  const rows = db.prepare('SELECT * FROM articles ORDER BY created_at ASC, ref ASC').all();
  if (rows.length < 2) return 0;

  const bestByKey = new Map();
  for (const row of rows) {
    const key = articleIdentityKey(row) || canonicalArticleName(row.nom || row.ref || row.code) || canonicalRef(row.ref || row.code || row.nom);
    if (!key) continue;

    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, row);
      continue;
    }

    const choose = scoreArticle(row) >= scoreArticle(existing) ? row : existing;
    const merged = mergeArticleFields(choose, existing);
    merged.ref = choose.ref;
    bestByKey.set(key, merged);
  }

  const keptRefs = new Set(Array.from(bestByKey.values()).map((row) => row.ref));
  const duplicates = rows.filter((row) => !keptRefs.has(row.ref));
  if (!duplicates.length) return 0;

  const updateWinner = db.prepare(`
    UPDATE articles
    SET nom = @nom,
        code = @code,
        unite = @unite,
        categorie = @categorie,
        conditionnement = @conditionnement,
        pu_carton = @pu_carton,
        pu_piece = @pu_piece,
        corresp = @corresp,
        statut = @statut,
        actif = @actif,
        ordre_affichage = @ordre_affichage,
        source = @source,
        updated_at = datetime('now')
    WHERE ref = @ref
  `);

  const deleteDuplicate = db.prepare('DELETE FROM articles WHERE ref = ?');
  const tx = db.transaction(() => {
    for (const winner of bestByKey.values()) {
      if (winner) {
        updateWinner.run({
          ref: winner.ref,
          nom: winner.nom || '',
          code: winner.code || null,
          unite: winner.unite || null,
          categorie: winner.categorie || null,
          conditionnement: winner.conditionnement ?? null,
          pu_carton: winner.pu_carton ?? null,
          pu_piece: winner.pu_piece ?? null,
          corresp: winner.corresp || null,
          statut: winner.statut || null,
          actif: winner.actif ?? 1,
          ordre_affichage: winner.ordre_affichage ?? 0,
          source: winner.source || null,
        });
      }
    }

    for (const row of duplicates) {
      deleteDuplicate.run(row.ref);
    }
  });

  tx();
  return duplicates.length;
}

// Au démarrage : convertit les prix 0/0 en NULL (affichage « prix inconnu »).
// Ne supprime jamais de lignes — les variantes (Local, suffixe, etc.) restent en base.
export function repairZeroPriceArticles(db) {
  const info = db.prepare(
    'UPDATE articles SET pu_carton = NULL, pu_piece = NULL WHERE pu_carton = 0 AND pu_piece = 0'
  ).run();
  return info.changes;
}

export function listArticles(db, { actif = 'all', search = '', categorie = '', page, limit } = {}) {
  let where = ' WHERE 1=1';
  const params = [];
  if (actif === '1' || actif === '0') { where += ' AND actif = ?'; params.push(Number(actif)); }
  if (search) { where += ' AND (nom LIKE ? OR ref LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  if (categorie) { where += ' AND categorie = ?'; params.push(categorie); }

  let sql = 'SELECT * FROM articles' + where;
  sql += ` ORDER BY CASE TRIM(categorie)
    WHEN 'Boissons' THEN 1
    WHEN 'Nourriture - Surgelé' THEN 2
    WHEN 'Nourriture - Frais' THEN 3
    WHEN 'Nourriture - Sec' THEN 4
    WHEN 'Packaging' THEN 5
    WHEN 'Produits de Nettoyage' THEN 6
    ELSE 99 END,
    CASE WHEN ordre_affichage > 0 THEN ordre_affichage ELSE 1000000 + rowid END`;

  const allItems = db.prepare(sql).all(...params);
  const dedupedAll = dedupeArticles(allItems);
  const total = dedupedAll.length;

  // Sans page/limit : tout le référentiel (génération des fichiers de suivi).
  if (page == null && limit == null) {
    return {
      items: dedupedAll,
      total,
      page: 1,
      limit: total,
      totalPages: 1,
      hasMore: false,
    };
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(Number(limit) || 50, 5000));
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
  const clampedPage = Math.min(pageNum, totalPages || 1);
  const start = (clampedPage - 1) * pageSize;
  const items = dedupedAll.slice(start, start + pageSize);

  return {
    items,
    total,
    page: clampedPage,
    limit: pageSize,
    totalPages,
    hasMore: clampedPage < totalPages,
  };
}

// Ajoute ou modifie UN SEUL article (tous les champs), sans toucher aux autres.
// Différence avec applySync : celui-ci parcourt une liste et ne met à jour
// que prix + statut + source, sans désactiver les articles absents.
export function upsertOne(db, it, source) {
  if (!it || !it.ref) throw new Error('ref manquante');
  const ref = canonicalRef(it.ref);
  db.prepare(`
    INSERT INTO articles (ref,nom,code,unite,categorie,conditionnement,pu_carton,pu_piece,corresp,statut,actif,ordre_affichage,source,updated_at)
    VALUES (@ref,@nom,@code,@unite,@categorie,@conditionnement,@pu_carton,@pu_piece,@corresp,@statut,@actif,@ordre_affichage,@source,datetime('now'))
    ON CONFLICT(ref) DO UPDATE SET
      nom=excluded.nom, code=excluded.code, unite=excluded.unite, categorie=excluded.categorie,
      conditionnement=excluded.conditionnement, pu_carton=excluded.pu_carton, pu_piece=excluded.pu_piece,
      corresp=excluded.corresp, statut=excluded.statut, actif=excluded.actif, ordre_affichage=excluded.ordre_affichage, source=excluded.source,
      updated_at=datetime('now')
  `).run({
    ref, nom: it.nom || '', code: it.code || null, unite: uniteAttendue(it, null), categorie: it.categorie || null,
    conditionnement: num(it.conditionnement), pu_carton: num(it.puCarton), pu_piece: num(it.puPiece),
    corresp: it.corresp || '', statut: it.statut || '', actif: (it.actif === 0 ? 0 : 1), ordre_affichage: num(it.ordre_affichage) || 0, source: source || 'manuel',
  });
  return db.prepare('SELECT * FROM articles WHERE ref=?').get(ref);
}
