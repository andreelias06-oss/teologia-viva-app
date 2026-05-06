// Plan logic — trial expires after 7 days then becomes free.
// Free tier: 5 AI calls per day, only first lesson available.
//
// MODO BETA (paywall_enabled=false): todas as restrições são desligadas.
// Qualquer usuário logado é tratado como Premium. Estado global do paywall
// é sincronizado pelo AuthContext via `setPaywallEnabled` abaixo.

export const PLAN = {
  TRIAL: 'trial',
  FREE: 'free',
  PREMIUM: 'premium',
};

// Estado global compartilhado — atualizado pelo AuthContext (fetchAppSettings).
// Default true porque paywall_enabled=false significa SEM paywall (modo Beta).
// Mantemos a semântica `paywallEnabled` para clareza.
let _paywallEnabled = false;
export function setPaywallEnabled(enabled) {
  _paywallEnabled = !!enabled;
}
export function isPaywallEnabled() {
  return _paywallEnabled;
}

export function effectivePlan(profile) {
  // Beta mode: usuário logado = Premium.
  if (!_paywallEnabled && profile) return PLAN.PREMIUM;
  if (!profile) return PLAN.FREE;
  if (profile.plano === PLAN.PREMIUM) return PLAN.PREMIUM;
  if (profile.plano === PLAN.TRIAL) {
    const start = profile.trial_inicio ? new Date(profile.trial_inicio) : null;
    if (!start) return PLAN.FREE;
    const days = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (days < 7) return PLAN.TRIAL;
    return PLAN.FREE;
  }
  return PLAN.FREE;
}

export function trialDaysLeft(profile) {
  if (!profile?.trial_inicio) return 0;
  const start = new Date(profile.trial_inicio);
  const days = 7 - Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

const AI_LIMIT_FREE = 5;

function todayKey(userId) {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `tv_ai_calls_${userId || 'anon'}_${date}`;
}

export function getAICallsToday(userId) {
  try {
    return parseInt(localStorage.getItem(todayKey(userId)) || '0', 10);
  } catch {
    return 0;
  }
}

export function incrementAICalls(userId) {
  const k = todayKey(userId);
  const current = getAICallsToday(userId);
  try {
    localStorage.setItem(k, String(current + 1));
  } catch {
    /* ignore */
  }
  return current + 1;
}

export function canUseAI(profile, userId) {
  // Beta mode: IA liberada sem limite pra todos os logados.
  if (!_paywallEnabled && profile) return { ok: true, remaining: Infinity, plan: PLAN.PREMIUM };
  const plan = effectivePlan(profile);
  if (plan === PLAN.PREMIUM || plan === PLAN.TRIAL) return { ok: true, remaining: Infinity, plan };
  const used = getAICallsToday(userId);
  return { ok: used < AI_LIMIT_FREE, remaining: Math.max(0, AI_LIMIT_FREE - used), plan, limit: AI_LIMIT_FREE };
}

export function canAccessLesson(profile, aula) {
  // Beta mode: todas as aulas liberadas pra usuários logados.
  if (!_paywallEnabled && profile) return true;
  const plan = effectivePlan(profile);
  if (plan === PLAN.PREMIUM || plan === PLAN.TRIAL) return true;
  // Free users: explicit is_premium=false wins; otherwise only the first lesson
  if (aula?.is_premium === false) return true;
  if (aula?.free === true) return true;
  if (aula?.ordem === 1 || aula?.ordem === '1') return true;
  return false;
}
