// ─────────────────────────────────────────────────────────────────────────────
//  Circuit de validation — SOURCE DE VÉRITÉ côté serveur.
//  Miroir exact des transitions codées dans l'application cliente (WFPanel).
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_LABELS = {
  draft:            'Brouillon',
  submitted_to_daf: 'Soumis au DAF',
  daf_approved:     'Approuvé DAF',
  daf_rejected:     'Rejeté DAF',
  submitted_to_dg:  'Soumis au DG',
  dg_approved:      'Validé DG',
  dg_rejected:      'Rejeté DG',
};

// action -> { rôle autorisé, statuts de départ acceptés, statut d'arrivée }
export const TRANSITIONS = {
  submit_daf:  { role: 'cdg', from: ['draft'],                      to: 'submitted_to_daf', label: 'Soumettre au DAF' },
  daf_approve: { role: 'daf', from: ['submitted_to_daf'],           to: 'daf_approved',     label: 'Approuver (DAF)' },
  daf_reject:  { role: 'daf', from: ['submitted_to_daf'],           to: 'daf_rejected',     label: 'Rejeter (DAF)' },
  submit_dg:   { role: 'daf', from: ['daf_approved'],               to: 'submitted_to_dg',  label: 'Soumettre au DG' },
  dg_approve:  { role: 'dg',  from: ['submitted_to_dg'],            to: 'dg_approved',      label: 'Valider (DG)' },
  dg_reject:   { role: 'dg',  from: ['submitted_to_dg'],            to: 'dg_rejected',      label: 'Rejeter (DG)' },
  reopen:      { role: 'cdg', from: ['daf_rejected', 'dg_rejected'], to: 'draft',           label: 'Corriger (remettre en brouillon)' },
};

// Correspondance statut d'arrivée -> action (pratique pour le client existant,
// dont les boutons envoient un "next status").
export const STATUS_TO_ACTION = {
  submitted_to_daf: 'submit_daf',
  daf_approved:     'daf_approve',
  daf_rejected:     'daf_reject',
  submitted_to_dg:  'submit_dg',
  dg_approved:      'dg_approve',
  dg_rejected:      'dg_reject',
  draft:            'reopen',
};

// Valide une transition. Le rôle 'admin' peut forcer n'importe quelle transition
// valide (utile pour débloquer un dossier), mais ne peut pas violer la machine à états.
export function checkTransition(action, currentStatus, userRole) {
  const t = TRANSITIONS[action];
  if (!t) return { ok: false, code: 400, error: `Action inconnue : ${action}` };
  if (!t.from.includes(currentStatus))
    return { ok: false, code: 409, error: `Transition impossible depuis « ${STATUS_LABELS[currentStatus] || currentStatus} »` };
  if (userRole !== 'admin' && userRole !== t.role)
    return { ok: false, code: 403, error: `Action « ${t.label} » réservée au rôle ${t.role.toUpperCase()}` };
  return { ok: true, to: t.to };
}

// Actions offertes à un rôle pour un statut donné (pour piloter l'UI).
export function allowedActions(currentStatus, userRole) {
  return Object.entries(TRANSITIONS)
    .filter(([, t]) => t.from.includes(currentStatus) && (userRole === 'admin' || userRole === t.role))
    .map(([action, t]) => ({ action, label: t.label, to: t.to }));
}
