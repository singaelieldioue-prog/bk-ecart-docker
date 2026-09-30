import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import * as api from "./api";
import { ROLES } from "./constants.js";

// Storage
import {
  loadRatiosMemo,
  saveRatiosMemo,
  saveRatiosParsed,
  loadRatiosParsed,
  loadLto,
  saveLto,
  loadBaseArticleMap,
  saveBaseArticleMap,
  loadCorrespondanceMap,
  saveCorrespondanceMap,
  loadLocalArticles,
  saveLocalArticles,
} from "./utils/storage.js";

// Backup
import { exportJSON, importJSON } from "./utils/dataBackup.js";


// Formatters & Utils
import { norm, matchBkNumber, fmtDate } from "./utils/formatters.js";

// Parsers
import {
  parseRatios,
  parseSuivisStock,
  extractPmixFromWorkbook,
  diagnosticPreAnalyse,
  buildArtListFromReferentiel,
  parseBaseArticleLocal,
} from "./utils/parsers.js";

// Calculators
import {
  calculer,
  calculerMultiRestaurants,
} from "./utils/calculators.js";

// Exporters
import { exportExcel } from "./utils/excelExporter.js";

// Components
import { DropZone, WBdg } from "./components/UI.jsx";
import { LtoManager } from "./components/LtoManager.jsx";
import { BaseArticleManager } from "./components/BaseArticleManager.jsx";
import { AnomalyModal } from "./components/AnomalyModal.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";

// Pages
import { LoginScreen } from "./pages/LoginScreen.jsx";
import { RapportView } from "./pages/RapportView.jsx";
import { HistView } from "./pages/HistView.jsx";
import { BaseArticlesTab } from "./pages/BaseArticlesTab.jsx";
import { DashboardDG } from "./pages/DashboardDG.jsx";

function AppInner() {
  const [role, setRole] = useState(api.getUser()?.role || null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [rapports, setRapports] = useState([]);
  const [storageLoading, setStorageLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, hasMore: false });
  const [loadingMore, setLoadingMore] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [openRapData, setOpenRapData] = useState(null); // rapport complet chargé à la demande
  const [openRapLoading, setOpenRapLoading] = useState(false);
  const [navTab, setNavTab] = useState("dashboard");

  useEffect(() => {
    if (role === "dg") setNavTab("dashboard_dg");
    else if (role && navTab === "dashboard_dg") setNavTab("dashboard");
  }, [role]);

  useEffect(() => {
    const user = api.getUser();
    if (!role || !user?.username) return;
    const key = `bk_onboarding_seen_${user.username}`;
    if (localStorage.getItem(key) !== "1") {
      setOnboardingStep(0);
      setShowOnboarding(true);
    }
  }, [role]);

  const onboardingSteps = role === "cdg" || role === "admin"
    ? [
        { title: "Bienvenue dans Écart Matières", text: "Ce guide vous présente les étapes essentielles pour préparer et suivre vos rapports." },
        { title: "Commencez par les Ratios", text: "Dans le Tableau de bord, chargez ou mettez à jour le fichier Ratios et vérifiez la base articles." },
        { title: "Créez votre rapport", text: "Cliquez sur « + Nouveau rapport », importez le suivi de stock, renseignez la période, puis lancez l’analyse." },
        { title: "Suivez les validations", text: "Les rapports sont partagés avec le DAF et le DG. Utilisez Historique pour retrouver les rapports déjà traités." },
      ]
    : [
        { title: "Bienvenue dans Écart Matières", text: "Ce guide vous présente les étapes essentielles pour utiliser votre espace." },
        { title: "Tableau de bord", text: "Consultez les rapports qui nécessitent votre action et ouvrez un rapport pour afficher ses détails." },
        { title: "Validez le workflow", text: role === "daf" ? "Examinez les rapports soumis, puis approuvez-les ou rejetez-les avec un commentaire." : "Consultez la synthèse réseau et validez les rapports soumis à votre niveau." },
        { title: "Retrouvez vos rapports", text: "Utilisez Historique pour rechercher et consulter les rapports déjà traités." },
      ];

  const closeOnboarding = () => {
    const user = api.getUser();
    if (user?.username) localStorage.setItem(`bk_onboarding_seen_${user.username}`, "1");
    setShowOnboarding(false);
  };

  const [showUpload, setShowUpload] = useState(false);
  const [showMajRatios, setShowMajRatios] = useState(false);
  const [showBaseArtMgr, setShowBaseArtMgr] = useState(false);
  const [baseArticleMemo, setBaseArticleMemo] = useState(null);
  const [correspondanceMemo, setCorrespondanceMemo] = useState(null);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreError, setRestoreError] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState(null); // { imported, skipped, total, errors }
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [showLto, setShowLto] = useState(false);
  const [ltoFiches, setLtoFiches] = useState([]);
  const [showLocalArt, setShowLocalArt] = useState(false);
  const [fLocalArt, setFLocalArt] = useState(null);
  const [multiMode, setMultiMode] = useState(false);
  const [fStocks, setFStocks] = useState([]);
  const importRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [anomalyData, setAnomalyData] = useState(null); // { alertes, onContinue, onCancel }
  const [periode, setPeriode] = useState("");

  const [ratiosMemo, setRatiosMemo] = useState(null);
  const ratiosWbRef = useRef(null);
  const ratiosParsedRef = useRef(null);

  const [fStock, setFStock] = useState(null);
  const [fRatio, setFRatio] = useState(null);

  const [localArticlesMemo, setLocalArticlesMemo] = useState(null);
  const localArticlesRef = useRef(null);

  const reloadReports = (page = 1) => {
    const isFirstPage = page === 1;
    if (isFirstPage) setStorageLoading(true);
    else setLoadingMore(true);
    api
      .listReports({ page, limit: 30 })
      .then((resp) => {
        const items = resp.items || resp; // rétrocompatibilité si ancien format
        if (isFirstPage) setRapports(items);
        else setRapports((prev) => {
          // éviter les doublons
          const ids = new Set(prev.map((r) => r.id));
          return [...prev, ...items.filter((r) => !ids.has(r.id))];
        });
        if (resp.totalPages) setPagination({ page: resp.page, totalPages: resp.totalPages, hasMore: resp.hasMore });
        setStorageLoading(false);
        setLoadingMore(false);
      })
      .catch((e) => {
        setStorageLoading(false);
        setLoadingMore(false);
        if (/expir/i.test(e.message)) {
          api.logout();
          setRole(null);
        }
      });
  };

  // Ouvre un rapport : charge la version complète (avec stockData) depuis l'API
  const openReport = async (id) => {
    setOpenId(id);
    setOpenRapData(null);
    // Si on a déjà les data complètes en local (rapport qu'on vient de créer), les utiliser
    const local = rapports.find((r) => r.id === id);
    if (local?.data?.calc?.articlesEcart) {
      setOpenRapData(local);
      return;
    }
    setOpenRapLoading(true);
    try {
      const full = await api.getReport(id);
      setOpenRapData(full);
      // Mettre à jour le cache local
      setRapports((prev) => prev.map((r) => r.id === id ? full : r));
    } catch (e) {
      alert('Impossible de charger ce rapport : ' + e.message);
      setOpenId(null);
    } finally {
      setOpenRapLoading(false);
    }
  };

  useEffect(() => {
    if (api.isLogged()) reloadReports();
    else setStorageLoading(false);
    loadRatiosMemo().then((m) => {
      if (m) setRatiosMemo(m);
    });
    loadLto().then((f) => {
      if (f?.length) setLtoFiches(f);
    });
    loadRatiosParsed().then((r) => {
      if (r) ratiosParsedRef.current = r;
    });
    loadBaseArticleMap().then((m) => {
      if (m) setBaseArticleMemo(m);
    });
    loadCorrespondanceMap().then((m) => {
      if (m) setCorrespondanceMemo(m);
    });
    loadLocalArticles().then((m) => {
      if (m) {
        setLocalArticlesMemo(m);
        localArticlesRef.current = m;
      }
    });
  }, [role]);

  const readWb = (f) =>
    new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = (e) => {
        try {
          res(XLSX.read(e.target.result, { type: "array", cellDates: true }));
        } catch (err) {
          rej(err);
        }
      };
      fr.onerror = rej;
      fr.readAsArrayBuffer(f);
    });


  const majRatios = async () => {
    if (!fRatio) {
      setError("Sélectionnez d'abord le nouveau fichier Ratios.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const wb = await readWb(fRatio);
      const r = parseRatios(wb);
      // Fichier non reconnu (ex. fichier de suivi de stock importé par erreur) : 0 produit.
      // On refuse la mise à jour plutôt que d'écraser le ratio mémorisé par un parse vide.
      if (!r.allProducts.length) {
        setError(
          `« ${fRatio.name} » ne contient aucun produit : ce n'est pas un fichier Ratios valide (feuilles attendues : Data sheet, PMP marchandises, COST, WA Landed Cost). Le ratio précédent est conservé — chargez le bon fichier.`
        );
        setFRatio(null);
        setLoading(false);
        return;
      }
      ratiosWbRef.current = wb;
      ratiosParsedRef.current = r;
      const meta = {
        label: fRatio.name,
        date: new Date().toLocaleDateString("fr-FR"),
        nbProduits: r.allProducts.length,
        nbIngredients: Object.keys(r.pmpByIng).length,
      };
      setRatiosMemo(meta);
      await saveRatiosMemo(meta);
      await saveRatiosParsed(r);

      let baseArtMap = await loadBaseArticleMap();
      // Le référentiel serveur suffit pour un chargement Ratio quotidien.
      // Le fichier base article reste nécessaire uniquement pour l'initialisation.
      if (!baseArtMap || !Object.keys(baseArtMap).length) {
        const serverArticles = await api.articlesListAll({ actif: "all" });
        if (serverArticles.length) {
          baseArtMap = Object.fromEntries(serverArticles.map((article) => [article.ref, {
            categorie: article.categorie || "",
            famille: "",
            designation: article.nom || article.ref,
            corresponRatio: article.corresp || "",
            fournisseur: article.fournisseur || "",
            codeBollore: article.code || "",
            unite: article.unite || "",
            cdt: article.conditionnement || 1,
          }]));
        }
      }
      if (!baseArtMap || !Object.keys(baseArtMap).length) {
        alert(
          "Aucun référentiel article disponible.\n\nChargez le fichier base article une première fois via « 🏷️ Gestion base article », puis les prochains Ratios pourront être chargés sans le recharger."
        );
        setRatiosMemo(meta);
        setLoading(false);
        setShowMajRatios(false);
        setFRatio(null);
        return;
      }
      const corrMap = (await loadCorrespondanceMap()) || {};
      const wa = r.waLandedCost || {};
      const { artList, nbCode, nbPrix, nbInactif, nbViaCode } = buildArtListFromReferentiel(
        baseArtMap,
        corrMap,
        wa,
        r.waByCode,
        localArticlesRef.current
      );
      if (artList.length && api.isLogged() && (role === "cdg" || role === "admin")) {
        try {
          const d = await api.articlesSync(artList, meta.label, true);
          const c = d.counts;
          const msg =
            "Mise à jour des PRIX depuis le nouveau Ratio :\n\n" +
            `• ${c.added} nouveaux (seront insérés)\n` +
            `• ${c.updated} avec prix/statut à mettre à jour\n` +
            `• ${c.unchanged} inchangés\n` +
            `• ${nbCode} articles avec code (base article mémorisé)\n` +
            `• ${nbPrix} articles avec prix résolu` +
            (nbViaCode ? ` (dont ${nbViaCode} via le Code Bolloré)` : "") +
            `\n` +
            (nbInactif ? `• ${nbInactif} marqués INACTIF dans le fichier (colonne actif inchangée)\n` : "") +
            "Les articles absents du Ratio restent en base.\n\nAppliquer ces changements ?";
          if (confirm(msg)) {
            const res = await api.articlesSync(artList, meta.label, false);
            const rc = res.counts;
            alert(
              `✅ Base articles : +${rc.added} insérés · ${rc.updated} prix/statut mis à jour.`
            );
          }
        } catch (e) {
          console.error(e);
          alert("Ratios mémorisés, mais synchro base articles impossible : " + e.message);
        }
      }

      setFRatio(null);
      setShowMajRatios(false);
      alert(`✅ Ratios mis à jour : ${meta.nbProduits} produits · ${meta.nbIngredients} ingrédients`);
    } catch (e) {
      setError("Erreur chargement Ratios : " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const analyser = async () => {
    if (role !== "cdg" && role !== "admin") {
      setError("Seul le Contrôleur de gestion (CDG) peut créer un rapport.");
      return;
    }
    const hasRatios = fRatio || ratiosWbRef.current || ratiosParsedRef.current;
    if (!hasRatios) {
      setError(
        "Le fichier Ratios est obligatoire. Chargez-le ou utilisez le bouton 'Mettre à jour les Ratios'."
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let ratios;
      if (fRatio) {
        const ratioWb = await readWb(fRatio);
        ratios = parseRatios(ratioWb);
        if (!ratios.allProducts.length) {
          const secours = ratiosParsedRef.current;
          if (!secours?.allProducts?.length) {
            setError(
              `« ${fRatio.name} » ne contient aucun produit : ce n'est pas un fichier Ratios valide (feuilles attendues : Data sheet, PMP marchandises, COST, WA Landed Cost).`
            );
            setFRatio(null);
            setLoading(false);
            return;
          }
          alert(
            `« ${fRatio.name} » ne contient aucun produit : ce n'est pas un fichier Ratios valide. Le ratio mémorisé a été utilisé à la place.`
          );
          ratios = JSON.parse(JSON.stringify(secours));
        } else {
          ratiosWbRef.current = ratioWb;
          ratiosParsedRef.current = ratios;
          const meta = {
            label: fRatio.name,
            date: new Date().toLocaleDateString("fr-FR"),
            nbProduits: ratios.allProducts.length,
            nbIngredients: Object.keys(ratios.pmpByIng).length,
          };
          setRatiosMemo(meta);
          await saveRatiosMemo(meta);
          await saveRatiosParsed(ratios);
        }
      } else if (ratiosWbRef.current) {
        ratios = parseRatios(ratiosWbRef.current);
      } else {
        ratios = JSON.parse(JSON.stringify(ratiosParsedRef.current));
      }

      if (ltoFiches.length > 0) {
        ltoFiches.forEach((f) => {
          if (f.plu) ratios.byPlu[f.plu] = f;
          ratios.byNom[norm(f.nom)] = f;
          ratios.allProducts.push(f);
        });
      }

      const baseArticle = baseArticleMemo || {};
      const corrMemoNorm =
        correspondanceMemo && correspondanceMemo.v === 2
          ? correspondanceMemo
          : { map: correspondanceMemo || {}, byCode: {} };
      Object.entries(corrMemoNorm.map || {}).forEach(([k, entry]) => {
        if (!(entry.pmpCarton > 0 || entry.puPiece > 0)) return;
        if (!ratios.waLandedCost[k] || (entry.statut === "ACTIF" && ratios.waLandedCost[k].statut !== "ACTIF")) {
          ratios.waLandedCost[k] = {
            designation: entry.designation,
            corresp: entry.code || "",
            statut: entry.statut || "",
            qteCdt: entry.qteCdt || 1,
            pmpCarton: entry.pmpCarton || 0,
            puPiece: entry.puPiece || (entry.pmpCarton && entry.qteCdt ? entry.pmpCarton / entry.qteCdt : 0),
            source: "Correspondance",
          };
        }
      });

      let calc, stockDataForReport, pmixListForReport;

      const requestUserConfirmation = (alertes) => {
        return new Promise((resolve) => {
          setAnomalyData({
            alertes,
            onContinue: () => {
              setAnomalyData(null);
              resolve(true);
            },
            onCancel: () => {
              setAnomalyData(null);
              resolve(false);
            },
          });
        });
      };

      if (multiMode && fStocks.length > 1) {
        const allStocks = [],
          allPmix = [];
        let alertesMulti = [];
        for (const fS of fStocks) {
          const sWb = await readWb(fS);
          diagnosticPreAnalyse(sWb, baseArticle, ratios, localArticlesRef.current).forEach((a) =>
            alertesMulti.push({ ...a, titre: `[${fS.name}] ${a.titre}` })
          );
          const sd = parseSuivisStock(sWb, baseArticle, ratios, localArticlesRef.current);
          allStocks.push(sd);
          const pItems = extractPmixFromWorkbook(sWb, sd.site);
          allPmix.push({ restaurant: sd.site || fS.name, periode: "", items: pItems });
        }

        const refVideDejaVu = new Set();
        alertesMulti = alertesMulti.filter((a) => {
          if (a.titre.includes("Référentiel base article non chargé")) {
            if (refVideDejaVu.has("x")) return false;
            refVideDejaVu.add("x");
            a.titre = "Référentiel base article non chargé sur cet environnement";
            return true;
          }
          return true;
        });
        const bloquantesMulti = alertesMulti.filter(
          (a) => a.niveau === "critique" || a.niveau === "attention"
        );
        if (bloquantesMulti.length > 0) {
          const ok = await requestUserConfirmation(bloquantesMulti);
          if (!ok) {
            setLoading(false);
            return;
          }
        }
        calc = calculerMultiRestaurants(
          allStocks,
          allPmix.map((p) => [p]),
          ratios,
          baseArticle
        );
        stockDataForReport = {
          ...allStocks[0],
          invIni: {},
          invFin: {},
          sorties: [],
          pertes: allStocks.flatMap((s) => s.pertes || []),
          douane: allStocks.flatMap((s) => s.douane || []),
          douaneTotal: allStocks.reduce((t, s) => t + (s.douaneTotal || 0), 0),
          offerts: Object.assign({}, ...allStocks.map((s) => s.offerts || {})),
          transfertsExclus: allStocks.reduce((t, s) => t + (s.transfertsExclus || 0), 0),
        };
        pmixListForReport = allPmix;
      } else {
        const stockWb = fStock ? await readWb(fStock) : null;
        if (stockWb) {
          const alertesMono = diagnosticPreAnalyse(stockWb, baseArticle, ratios, localArticlesRef.current);
          const bloquantes = alertesMono.filter(
            (a) => a.niveau === "critique" || a.niveau === "attention"
          );
          if (bloquantes.length > 0) {
            const ok = await requestUserConfirmation(bloquantes);
            if (!ok) {
              setLoading(false);
              return;
            }
          }
        }
        stockDataForReport = stockWb
          ? parseSuivisStock(stockWb, baseArticle, ratios, localArticlesRef.current)
          : {
              invIni: {},
              invFin: {},
              sorties: [],
              pertes: [],
              douane: [],
              douaneTotal: 0,
              offerts: {},
              site: "—",
              dateInv: null,
            };
        const pItems = stockWb ? extractPmixFromWorkbook(stockWb, stockDataForReport.site) : [];
        pmixListForReport = pItems.length > 0
          ? [{ restaurant: stockDataForReport.site || "BK", periode: "", items: pItems }]
          : [];
        calc = calculer(stockDataForReport, pmixListForReport, ratios, baseArticle);
      }

      let dateLabel = periode;
      if (!dateLabel && stockDataForReport?.dateInv)
        dateLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
          new Date(stockDataForReport.dateInv)
        );
      if (!dateLabel)
        dateLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

      const ratiosMemoLabel = ratiosMemo
        ? `${ratiosMemo.label} · Chargés le ${ratiosMemo.date}`
        : "—";

      const data = {
        stockData: stockDataForReport,
        calc,
        pmixList: pmixListForReport,
        dateLabel,
        site: calc.isMulti ? `Réseau ${fStocks.length} BK` : stockDataForReport?.site || "—",
        ficheMatchees: calc.ficheMatchees,
        isMulti: calc.isMulti || false,
        ltoFiches: [...ltoFiches],
        ratiosMeta: ratios
          ? {
              nbProduits: ratios.allProducts.length,
              nbIngredients: Object.keys(ratios.pmpByIng).length,
              allProducts: ratios.allProducts,
              label: ratiosMemoLabel,
            }
          : null,
      };

      const titre = calc.isMulti
        ? `Rapport Réseau — ${fStocks.length} BK · ${dateLabel}`
        : `Écart matières — ${dateLabel} · ${data.site}`;
      const created = await api.createReport({ titre, site: data.site || null, data });
      // Le rapport créé a déjà toutes ses données — on l'ouvre directement sans refetch
      setRapports((p) => [created, ...p]);
      setOpenRapData(created);
      setOpenId(created.id);
      setShowUpload(false);
      setFStock(null);
      setFRatio(null);
      setFStocks([]);
    } catch (err) {
      setError("Erreur : " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      const updated = await api.transition(
        id,
        api.STATUS_TO_ACTION[action.status],
        action.commentaire
      );
      setRapports((p) => p.map((r) => (r.id !== id ? r : { ...r, ...updated })));
      // Mettre à jour aussi le rapport ouvert si c'est le même
      if (openRapData?.id === id) setOpenRapData((prev) => ({ ...prev, ...updated }));
    } catch (e) {
      alert(e.message);
    }
  };

  const delRap = async (id) => {
    if (!confirm("Supprimer ce rapport ?")) return;
    try {
      await api.deleteReport(id);
      setRapports((p) => p.filter((r) => r.id !== id));
      if (openId === id) { setOpenId(null); setOpenRapData(null); }
    } catch (e) {
      alert(e.message);
    }
  };

  if (!role) return <LoginScreen onLogged={(u) => setRole(u.role)} />;

  // Le rapport à afficher est chargé à la demande (via openReport)
  const openRap = openRapData;
  const myTodo = rapports.filter(
    (r) =>
      (role === "daf" && r.status === "submitted_to_daf") ||
      (role === "dg" && r.status === "submitted_to_dg") ||
      (role === "cdg" && (r.status === "daf_rejected" || r.status === "dg_rejected"))
  ).length;

  const NT = ({ id, label, count }) => (
    <button
      onClick={() => setNavTab(id)}
      style={{
        padding: "7px 13px",
        border: "none",
        background: "none",
        cursor: "pointer",
        fontWeight: navTab === id ? 700 : 400,
        color: navTab === id ? "#D4531D" : "#6B7280",
        borderBottom: navTab === id ? "2px solid #D4531D" : "2px solid transparent",
        fontSize: 13,
        marginBottom: -2,
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {label}
      {count > 0 && (
        <span
          style={{
            background: "#DC2626",
            color: "#fff",
            borderRadius: 10,
            padding: "0 5px",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="app-shell" style={{ fontFamily: "system-ui,-apple-system,sans-serif", width: "100%", minHeight: "100vh", boxSizing: "border-box", paddingBottom: 40 }}>
      <div
        className="app-header"
        style={{
          background: "#D4531D",
          color: "#fff",
          padding: "13px 18px",
          borderRadius: "0 0 14px 14px",
          position: "sticky",
          top: 0,
          zIndex: 20,
          boxShadow: "0 2px 10px rgba(32,37,34,.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div className="app-header-title">
          <div style={{ fontWeight: 800, fontSize: 17 }}>🍔 SIA RESTAURATION RAPIDE COTE D&apos;IVOIRE — Écarts Matières</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>
            BK Abidjan · {rapports.length} rapport(s)
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              background: "rgba(255,255,255,.2)",
              borderRadius: 7,
              padding: "5px 11px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {ROLES[role]?.short || role.toUpperCase()}
          </div>
          <button
            onClick={() => {
              api.logout();
              setRole(null);
            }}
            style={{
              background: "rgba(255,255,255,.15)",
              border: "1px solid rgba(255,255,255,.3)",
              color: "#fff",
              borderRadius: 7,
              padding: "5px 11px",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Déconnexion
          </button>
        </div>
      </div>

      <div className="app-content" style={{ padding: "0 14px" }}>
        {openRapLoading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Chargement du rapport…</div>
          </div>
        ) : openRap ? (
          <RapportView
            rapport={openRap}
            role={role}
            rapports={rapports}
            onAction={(a) => handleAction(openRap.id, a)}
            onBack={() => { setOpenId(null); setOpenRapData(null); }}
          />
        ) : (
          <>
            <div className="app-nav" style={{ borderBottom: "2px solid #F3F4F6", marginBottom: 16, display: "flex", gap: 4 }}>
              {role === "dg" && <NT id="dashboard_dg" label="📊 Synthèse Réseau" />}
              <NT id="dashboard" label="📋 Tableau de bord" count={myTodo} />
              <NT id="articles" label="📦 Base articles" />
              <NT id="historique" label="📅 Historique" />
            </div>

            {navTab === "dashboard_dg" && (
              <DashboardDG rapports={rapports} />
            )}

            {navTab === "dashboard" && (
              <>
                {storageLoading ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
                    ⏳ Chargement...
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 12,
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Rapports en cours</div>
                        {myTodo > 0 && (
                          <div style={{ fontSize: 12, color: "#D97706", fontWeight: 600, marginTop: 1 }}>
                            ⚡ {myTodo} en attente de votre action
                          </div>
                        )}
                      </div>
                      {role === "cdg" && (
                        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                          <button
                            onClick={() => {
                              setShowLto((p) => !p);
                              setShowUpload(false);
                              setShowMajRatios(false);
                              setShowRestore(false);
                              setShowBaseArtMgr(false);
                            }}
                            style={{
                              background: showLto ? "#D97706" : "#F59E0B",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 12px",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            🍔 Fiches LTO {ltoFiches.length > 0 && `(${ltoFiches.length})`}
                          </button>
                          <button
                            onClick={() => {
                              setShowBaseArtMgr((p) => !p);
                              setShowUpload(false);
                              setShowRestore(false);
                              setShowLto(false);
                              setShowMajRatios(false);
                            }}
                            style={{
                              background: baseArticleMemo ? "#0891B2" : "#DC2626",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 14px",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            🏷️ Gestion base article{!baseArticleMemo ? " ⚠️" : ""}
                          </button>
                          <button
                            onClick={() => {
                              setShowLocalArt((p) => !p);
                              setShowUpload(false);
                              setShowRestore(false);
                              setShowLto(false);
                              setShowBaseArtMgr(false);
                              setShowMajRatios(false);
                            }}
                            style={{
                              background: localArticlesMemo ? "#0D9488" : "#6B7280",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 14px",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            📍 Base locale{localArticlesMemo ? ` (${Object.keys(localArticlesMemo).length})` : ""}
                          </button>
                          <button
                            onClick={() => {
                              setShowMajRatios((p) => !p);
                              setShowUpload(false);
                              setShowRestore(false);
                              setShowLto(false);
                              setShowBaseArtMgr(false);
                            }}
                            style={{
                              background: "#7C3AED",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 14px",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            🔄 Ratios
                          </button>
                          <button
                            onClick={() => {
                              setShowUpload((p) => !p);
                              setShowMajRatios(false);
                              setShowRestore(false);
                              setShowLto(false);
                              setShowBaseArtMgr(false);
                            }}
                            style={{
                              background: "#D4531D",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 16px",
                              cursor: "pointer",
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            {showUpload ? "✕ Annuler" : "+ Nouveau rapport"}
                          </button>
                        </div>
                      )}
                    </div>

                    {showRestore && role === "cdg" && (
                      <div
                        style={{
                          background: "#F0FDF4",
                          border: "1px solid #BBF7D0",
                          borderRadius: 12,
                          padding: 16,
                          marginBottom: 14,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#059669", marginBottom: 3 }}>
                          📂 Restaurer depuis une sauvegarde JSON
                        </div>
                        <div style={{ fontSize: 11, color: "#065F46", marginBottom: 10 }}>
                          Sélectionnez un fichier <code>bk_rapports_AAAA-MM-JJ.json</code> exporté précédemment.
                          Les rapports seront <strong>sauvegardés en base de données</strong>. Les rapports déjà présents ne seront pas écrasés.
                        </div>

                        {/* Message d'erreur */}
                        {restoreError && (
                          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, padding: "7px 10px", color: "#DC2626", fontSize: 11, marginBottom: 8 }}>
                            ✕ {restoreError}
                          </div>
                        )}

                        {/* Résultat de l'import */}
                        {restoreProgress && (
                          <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 13px", marginBottom: 10, fontSize: 12 }}>
                            <div style={{ fontWeight: 700, color: "#065F46", marginBottom: 4 }}>
                              ✅ Import terminé — {restoreProgress.total} rapport(s) traité(s)
                            </div>
                            <div style={{ color: "#059669" }}>✔ {restoreProgress.imported} importé(s) en base</div>
                            {restoreProgress.skipped > 0 && (
                              <div style={{ color: "#D97706" }}>⏭ {restoreProgress.skipped} déjà présent(s) — ignoré(s)</div>
                            )}
                            {restoreProgress.errors?.length > 0 && (
                              <div style={{ color: "#DC2626", marginTop: 4 }}>
                                ✕ {restoreProgress.errors.length} erreur(s) :
                                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                                  {restoreProgress.errors.map((e, i) => (
                                    <li key={i}>{e.id} — {e.reason}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Spinner pendant l'envoi */}
                        {restoreLoading && (
                          <div style={{ textAlign: "center", padding: "12px 0", color: "#059669", fontSize: 13, fontWeight: 600 }}>
                            ⏳ Import en cours…
                          </div>
                        )}

                        <input
                          ref={importRef}
                          type="file"
                          accept=".json"
                          style={{ display: "none" }}
                          onChange={async (e) => {
                            const f = e.target.files[0];
                            if (!f) return;
                            setRestoreError(null);
                            setRestoreProgress(null);
                            // 1. Parser le fichier JSON localement
                            importJSON(
                              f,
                              async (raps) => {
                                // 2. Envoyer au backend pour persistance
                                setRestoreLoading(true);
                                try {
                                  const result = await api.importReports(raps);
                                  setRestoreProgress(result);
                                  if (result.imported > 0) {
                                    // Recharger la liste depuis la BDD
                                    reloadReports(1);
                                  }
                                } catch (err) {
                                  setRestoreError("Erreur API : " + err.message);
                                } finally {
                                  setRestoreLoading(false);
                                }
                              },
                              (err) => setRestoreError(err)
                            );
                            e.target.value = "";
                          }}
                        />
                        <button
                          onClick={() => { importRef.current?.click(); }}
                          disabled={restoreLoading}
                          style={{
                            width: "100%",
                            padding: 10,
                            borderRadius: 8,
                            border: "none",
                            background: restoreLoading ? "#6EE7B7" : "#059669",
                            color: "#fff",
                            cursor: restoreLoading ? "default" : "pointer",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          📂 Sélectionner le fichier JSON
                        </button>
                      </div>
                    )}

                    {ratiosMemo && (
                      <div
                        style={{
                          background: "#F5F3FF",
                          border: "1px solid #DDD6FE",
                          borderRadius: 8,
                          padding: "8px 13px",
                          marginBottom: 10,
                          fontSize: 11,
                          color: "#5B21B6",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span>📋</span>
                        <span>
                          <strong>Ratios mémorisés :</strong> {ratiosMemo.label} · Chargés le{" "}
                          {ratiosMemo.date} · {ratiosMemo.nbProduits} produits · {ratiosMemo.nbIngredients}{" "}
                          ingrédients
                        </span>
                      </div>
                    )}

                    {showMajRatios && role === "cdg" && (
                      <div
                        style={{
                          background: "#F5F3FF",
                          border: "1px solid #DDD6FE",
                          borderRadius: 12,
                          padding: 16,
                          marginBottom: 14,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#5B21B6", marginBottom: 3 }}>
                          🔄 Mettre à jour les Ratios trimestriels
                        </div>
                        <div style={{ fontSize: 11, color: "#7C3AED", marginBottom: 10 }}>
                          Chargez le nouveau fichier Ratios (Q2, Q3 ou Q4). Il enrichit les prix du base article déjà mémorisé.
                        </div>
                        <DropZone
                          label="Nouveau fichier Ratios"
                          icon="📋"
                          onFile={(f) => setFRatio(f)}
                          fileName={fRatio?.name}
                          required
                        />
                        {!baseArticleMemo && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "#B45309",
                              background: "#FFFBEB",
                              border: "1px solid #FDE68A",
                              borderRadius: 7,
                              padding: "7px 10px",
                              marginTop: 8,
                            }}
                          >
                            ⚠️ Aucun base article mémorisé pour l'instant. Chargez-le une première fois via « 🏷️ Gestion base article ».
                          </div>
                        )}
                        {error && (
                          <div
                            style={{
                              background: "#FEF2F2",
                              border: "1px solid #FECACA",
                              borderRadius: 7,
                              padding: "7px 10px",
                              color: "#DC2626",
                              fontSize: 11,
                              marginTop: 8,
                            }}
                          >
                            {error}
                          </div>
                        )}
                        <button
                          onClick={majRatios}
                          disabled={loading || !fRatio}
                          style={{
                            width: "100%",
                            marginTop: 10,
                            padding: 11,
                            borderRadius: 8,
                            border: "none",
                            background: fRatio ? "#7C3AED" : "#E5E7EB",
                            color: fRatio ? "#fff" : "#9CA3AF",
                            cursor: fRatio ? "pointer" : "not-allowed",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {loading ? "⏳ Chargement..." : "✅ Enregistrer les nouveaux Ratios"}
                        </button>
                      </div>
                    )}

                    {showBaseArtMgr && role === "cdg" && (
                      <BaseArticleManager
                        baseArtMap={baseArticleMemo}
                        corrMap={correspondanceMemo}
                        onLoadInitial={async (bMap, cMap) => {
                          await saveBaseArticleMap(bMap);
                          setBaseArticleMemo(bMap);
                          let corrNorm = correspondanceMemo;
                          if (cMap) {
                            corrNorm = { v: 2, map: cMap.map || {}, byCode: cMap.byCode || {} };
                            await saveCorrespondanceMap(corrNorm);
                            setCorrespondanceMemo(corrNorm);
                          }
                          const wa = (ratiosParsedRef.current && ratiosParsedRef.current.waLandedCost) || {};
                          const waByCode = (ratiosParsedRef.current && ratiosParsedRef.current.waByCode) || null;
                          const { artList } = buildArtListFromReferentiel(bMap, corrNorm || {}, wa, waByCode, localArticlesRef.current);
                          if (artList.length && api.isLogged()) {
                            try {
                              const res = await api.articlesSync(
                                artList,
                                "Base article (chargement initial)",
                                false
                              );
                              alert(
                                `✅ Base article mémorisé et référentiel initialisé : +${res.counts.added} · ${res.counts.updated} prix/statut mis à jour.`
                              );
                            } catch (e) {
                              alert("Base article mémorisé, mais synchro impossible : " + e.message);
                            }
                          }
                        }}
                        onManualSave={async (article) => {
                          try {
                            await api.articlesUpsert(article);
                            const bMap = { ...(baseArticleMemo || {}) };
                            bMap[article.ref] = {
                              categorie: article.categorie,
                              famille: "",
                              designation: article.nom,
                              corresponRatio: article.corresp || "",
                              fournisseur: "",
                              codeBollore: article.code || "",
                              unite: article.unite || "",
                              cdt: article.conditionnement || 1,
                            };
                            await saveBaseArticleMap(bMap);
                            setBaseArticleMemo(bMap);
                            alert(`✅ Article « ${article.nom} » enregistré dans la base articles.`);
                          } catch (e) {
                            alert("Erreur : " + e.message);
                          }
                        }}
                        onClose={() => setShowBaseArtMgr(false)}
                      />
                    )}

                    {showLto && role === "cdg" && (
                      <div style={{ marginBottom: 14 }}>
                        <LtoManager
                          ltoFiches={ltoFiches}
                          onSave={async (f) => {
                            setLtoFiches(f);
                            await saveLto(f);
                          }}
                          onClose={() => setShowLto(false)}
                        />
                      </div>
                    )}

                    {showLocalArt && role === "cdg" && (
                      <div
                        style={{
                          background: "#F0FDFA",
                          border: "1px solid #99F6E4",
                          borderRadius: 12,
                          padding: 16,
                          marginBottom: 14,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#0D9488", marginBottom: 3 }}>
                          📍 Base article locale (articles hors Ratio)
                        </div>
                        <div style={{ fontSize: 11, color: "#115E59", marginBottom: 10 }}>
                          Chargez le fichier Excel contenant les articles locaux (boissons, IFB, etc.)
                          avec leurs prix. Ces articles seront utilisés en complément du Ratio pour
                          résoudre les prix lors de l'analyse des écarts matières.
                        </div>
                        {localArticlesMemo && (
                          <div
                            style={{
                              background: "#CCFBF1",
                              border: "1px solid #99F6E4",
                              borderRadius: 7,
                              padding: "7px 10px",
                              marginBottom: 10,
                              fontSize: 11,
                              color: "#0D9488",
                            }}
                          >
                            ✅ Base locale chargée : {Object.keys(localArticlesMemo).length} articles mémorisés
                          </div>
                        )}
                        <DropZone
                          label="Fichier Base article locale (.xlsx)"
                          icon="📍"
                          onFile={(f) => setFLocalArt(f)}
                          fileName={fLocalArt?.name}
                          required
                        />
                        <button
                          onClick={async () => {
                            if (!fLocalArt) return;
                            setLoading(true);
                            setError(null);
                            try {
                              const wb = await readWb(fLocalArt);
                              const map = parseBaseArticleLocal(wb);
                              if (!Object.keys(map).length) {
                                setError("Aucun article avec prix trouvé dans ce fichier. Vérifiez la structure attendue : Catégorie, Nom Article, Code, Unité, Conditionnement, Prix unitaire.");
                                setLoading(false);
                                return;
                              }
                              localArticlesRef.current = map;
                              setLocalArticlesMemo(map);
                              await saveLocalArticles(map);
                              // Persister prix + conditionnement dans la base articles (BDD)
                              if (api.isLogged() && (role === "cdg" || role === "admin")) {
                                try {
                                  const list = Object.values(map).map((a) => ({
                                    ref: norm(a.nom), nom: a.nom,
                                    code: a.code || null, unite: a.unite || null,
                                    categorie: a.categorie || null,
                                    conditionnement: a.cdt || 1,
                                    puCarton: a.pmpCarton || null,
                                    puPiece: a.puPiece || null,
                                    actif: 1,
                                  }));
                                  const res = await api.articlesSync(list, "Base locale", false);
                                  const rc = res.counts;
                                  alert(`✅ Base article locale chargée : ${Object.keys(map).length} articles avec prix.\nBase articles : ${rc.updated} prix/conditionnement mis à jour · ${rc.added} ajoutés.`);
                                } catch (e) {
                                  console.error(e);
                                  alert(`✅ Base locale chargée, mais synchro base articles impossible : ${e.message}`);
                                }
                              } else {
                                alert(`✅ Base article locale chargée : ${Object.keys(map).length} articles avec prix.`);
                              }
                              setFLocalArt(null);
                              setShowLocalArt(false);
                            } catch (e) {
                              setError("Erreur chargement base locale : " + e.message);
                            } finally {
                              setLoading(false);
                            }
                          }}
                          disabled={loading || !fLocalArt}
                          style={{
                            width: "100%",
                            marginTop: 10,
                            padding: 11,
                            borderRadius: 8,
                            border: "none",
                            background: fLocalArt ? "#0D9488" : "#E5E7EB",
                            color: fLocalArt ? "#fff" : "#9CA3AF",
                            cursor: fLocalArt ? "pointer" : "not-allowed",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {loading ? "⏳ Chargement..." : "✅ Enregistrer la base locale"}
                        </button>
                      </div>
                    )}

                    {showUpload && role === "cdg" && (
                      <div
                        style={{
                          background: "#fff",
                          border: "1px solid #E5E7EB",
                          borderRadius: 12,
                          padding: 18,
                          marginBottom: 14,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                          Charger les fichiers
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 4,
                            marginBottom: 12,
                            background: "#F3F4F6",
                            borderRadius: 8,
                            padding: 4,
                          }}
                        >
                          <button
                            onClick={() => {
                              setMultiMode(false);
                              setFStocks([]);
                            }}
                            style={{
                              flex: 1,
                              padding: "7px 10px",
                              border: "none",
                              borderRadius: 6,
                              background: !multiMode ? "#D4531D" : "transparent",
                              color: !multiMode ? "#fff" : "#6B7280",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            🏪 1 Restaurant
                          </button>
                          <button
                            onClick={() => {
                              setMultiMode(true);
                              setFStock(null);
                            }}
                            style={{
                              flex: 1,
                              padding: "7px 10px",
                              border: "none",
                              borderRadius: 6,
                              background: multiMode ? "#D4531D" : "transparent",
                              color: multiMode ? "#fff" : "#6B7280",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            🏬 Multi-restaurants (jusqu'à 9 BK)
                          </button>
                        </div>

                        {ratiosMemo ? (
                          <div
                            style={{
                              background: "#F5F3FF",
                              border: "1px solid #DDD6FE",
                              borderRadius: 8,
                              padding: "8px 12px",
                              marginBottom: 10,
                              fontSize: 11,
                              color: "#5B21B6",
                            }}
                          >
                            ✅ <strong>Ratios mémorisés :</strong> {ratiosMemo.label} · {ratiosMemo.nbProduits} produits
                            <div style={{ marginTop: 6 }}>
                              <DropZone
                                label="Remplacer les Ratios (optionnel)"
                                icon="📋"
                                onFile={(f) => setFRatio(f)}
                                fileName={fRatio?.name}
                              />
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginBottom: 10 }}>
                            <DropZone
                              label="Ratios / Fiches techniques ⭐"
                              icon="📋"
                              onFile={(f) => setFRatio(f)}
                              fileName={fRatio?.name}
                              required
                            />
                          </div>
                        )}

                        {!multiMode ? (
                          <div style={{ marginBottom: 10 }}>
                            <DropZone
                              label="Fichier Suivi Stock BK (Inventaire + Transferts + Pertes + PMIX)"
                              icon="📦"
                              onFile={(f) => setFStock(f)}
                              fileName={fStock?.name}
                              required
                            />
                          </div>
                        ) : (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 6 }}>
                              📦 Fichiers Suivi Stock — un par restaurant (chacun contient son stock + PMIX)
                            </div>
                            <DropZone
                              label="Fichiers Stock (multi-restaurants)"
                              icon="📦"
                              onFile={(files) => setFStocks((p) => [...p, ...files].slice(0, 9))}
                              fileName={fStocks.length ? `${fStocks.length} fichier(s)` : null}
                              multiple
                              required
                            />
                          </div>
                        )}

                        <input
                          value={periode}
                          onChange={(e) => setPeriode(e.target.value)}
                          placeholder="Période (ex: Juin 2026 — Q1)"
                          style={{
                            width: "100%",
                            padding: "7px 11px",
                            border: "1px solid #D1D5DB",
                            borderRadius: 7,
                            fontSize: 12,
                            marginBottom: 9,
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                        {error && (
                          <div
                            style={{
                              background: "#FEF2F2",
                              border: "1px solid #FECACA",
                              borderRadius: 7,
                              padding: "8px 11px",
                              color: "#DC2626",
                              fontSize: 12,
                              marginBottom: 9,
                            }}
                          >
                            {error}
                          </div>
                        )}
                        <button
                          onClick={analyser}
                          disabled={
                            loading ||
                            (multiMode ? fStocks.length < 2 : !fStock) ||
                            (!fRatio && !ratiosWbRef.current && !ratiosParsedRef.current)
                          }
                          style={{
                            width: "100%",
                            padding: 12,
                            borderRadius: 9,
                            border: "none",
                            background:
                              (multiMode ? fStocks.length >= 2 : !!fStock) &&
                              (fRatio || ratiosWbRef.current || ratiosParsedRef.current)
                                ? "#D4531D"
                                : "#E5E7EB",
                            color:
                              (multiMode ? fStocks.length >= 2 : !!fStock) &&
                              (fRatio || ratiosWbRef.current || ratiosParsedRef.current)
                                ? "#fff"
                                : "#9CA3AF",
                            cursor:
                              (multiMode ? fStocks.length >= 2 : !!fStock) &&
                              (fRatio || ratiosWbRef.current || ratiosParsedRef.current)
                                ? "pointer"
                                : "not-allowed",
                            fontSize: 14,
                            fontWeight: 800,
                          }}
                        >
                          {loading
                            ? "⏳ Analyse en cours..."
                            : multiMode
                            ? `🚀 Analyser ${fStocks.length} restaurant(s)`
                            : "🚀 Analyser et créer le rapport"}
                        </button>
                      </div>
                    )}

                    {rapports.filter((r) => r.status !== "dg_approved").length === 0 ? (
                      <div
                        style={{
                          background: "#fff",
                          border: "1px solid #E5E7EB",
                          borderRadius: 12,
                          padding: 40,
                          textAlign: "center",
                          color: "#9CA3AF",
                        }}
                      >
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                        <div style={{ fontSize: 13 }}>
                          {role === "cdg"
                            ? "Créez un rapport via « + Nouveau rapport »"
                            : "Aucun rapport en cours."}
                        </div>
                      </div>
                    ) : (
                      rapports
                        .filter((r) => r.status !== "dg_approved")
                        .map((rap) => {
                          const needsMe =
                            (role === "daf" && rap.status === "submitted_to_daf") ||
                            (role === "dg" && rap.status === "submitted_to_dg") ||
                            (role === "cdg" &&
                              (rap.status === "daf_rejected" || rap.status === "dg_rejected"));
                          return (
                            <div
                              key={rap.id}
                              style={{
                                background: needsMe ? "#FFFBEB" : "#fff",
                                border: `1px solid ${needsMe ? "#FDE68A" : "#E5E7EB"}`,
                                borderRadius: 10,
                                padding: "11px 15px",
                                marginBottom: 7,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 9,
                              }}
                            >
                              <div style={{ flex: 1, cursor: "pointer" }} onClick={() => openReport(rap.id)}>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>{rap.titre}</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                                  {fmtDate(rap.createdAt)} · {rap.data?.site}
                                </div>
                                {needsMe && (
                                  <div style={{ fontSize: 11, color: "#D97706", fontWeight: 600, marginTop: 1 }}>
                                    ⚡ Action requise
                                  </div>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                                <WBdg status={rap.status} />
                                <button
                                  onClick={() => { exportExcel(rap).catch((e) => alert("Export impossible : " + e.message)); }}
                                  title="Export Excel"
                                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}
                                >
                                  📥
                                </button>
                                {role === "cdg" && (
                                  <button
                                    onClick={() => delRap(rap.id)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      fontSize: 14,
                                      color: "#DC2626",
                                    }}
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </>
                )}
              </>
            )}
            {navTab === "historique" && (
              <HistView
                rapports={rapports}
                onOpen={openReport}
                onDelete={delRap}
                role={role}
                pagination={{ ...pagination, total: pagination.total }}
                onLoadMore={() => reloadReports(pagination.page + 1)}
                loadingMore={loadingMore}
              />
            )}
            {navTab === "articles" && (
              <BaseArticlesTab role={role} produits={ratiosParsedRef.current?.allProducts || []} localArticles={localArticlesMemo} />
            )}
          </>
        )}
      </div>

      {/* Pop-up Alerte Rouge pour les anomalies de fichiers */}
      {anomalyData && (
        <AnomalyModal
          alertes={anomalyData.alertes}
          onContinue={anomalyData.onContinue}
          onCancel={anomalyData.onCancel}
        />
      )}
      {showOnboarding && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(32,37,34,.48)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#fff",
              borderRadius: 14,
              padding: 26,
              boxShadow: "0 20px 60px rgba(0,0,0,.2)",
            }}
          >
            <div style={{ color: "#D4531D", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
              Guide de démarrage · {onboardingStep + 1}/{onboardingSteps.length}
            </div>
            <div style={{ display: "flex", gap: 5, margin: "16px 0 22px" }}>
              {onboardingSteps.map((_, index) => (
                <div key={index} style={{ height: 4, flex: 1, borderRadius: 4, background: index <= onboardingStep ? "#D4531D" : "#E5E7EB" }} />
              ))}
            </div>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 28, lineHeight: 1.1, fontWeight: 700, color: "#202522", marginBottom: 12 }}>
              {onboardingSteps[onboardingStep].title}
            </div>
            <div style={{ color: "#6B716D", fontSize: 14, lineHeight: 1.6, minHeight: 68 }}>
              {onboardingSteps[onboardingStep].text}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
              <button onClick={closeOnboarding} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 12 }}>
                Passer le guide
              </button>
              <button
                onClick={() => onboardingStep === onboardingSteps.length - 1 ? closeOnboarding() : setOnboardingStep((step) => step + 1)}
                style={{ background: "#202522", color: "#fff", border: "none", borderRadius: 8, padding: "11px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
              >
                {onboardingStep === onboardingSteps.length - 1 ? "Commencer" : "Suivant"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 10, padding: "12px 14px 0" }}>
        Tous droits réservés - Cam&sons
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
