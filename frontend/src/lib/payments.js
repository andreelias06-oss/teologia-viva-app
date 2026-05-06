// Helpers de pagamento — fluxo Stripe Checkout em Modo Teste.
import { supabase } from './supabase';

const SUPA_URL = process.env.REACT_APP_SUPABASE_URL;

export const PACKAGES = {
  premium_mensal: { id: 'premium_mensal', label: 'Premium · Mensal', amount: 9.90, currency: 'BRL' },
};

/**
 * Inicia checkout: chama Edge Function `stripe-create-checkout` e redireciona.
 * @param {string} packageId  ex: 'premium_mensal'
 */
export async function startCheckout(packageId = 'premium_mensal') {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Faça login para continuar');

  const res = await fetch(`${SUPA_URL}/functions/v1/stripe-create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      package_id: packageId,
      origin_url: window.location.origin,
    }),
  });
  // Lê o body UMA VEZ SÓ como texto, depois tenta parsear JSON. Evita
  // 'body stream already read' caso o caller re-leia e trata bodies não-JSON.
  const rawText = await res.text();
  let data = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* body não é JSON */ }
  if (!res.ok || !data.url) {
    throw new Error(data.error || rawText.slice(0, 200) || 'Falha ao criar sessão de pagamento');
  }
  window.location.href = data.url;
}

/**
 * Verifica status de uma sessão de checkout. Polling: chama várias vezes até `complete`.
 * Retorna `{ status, payment_status }`.
 */
export async function checkSessionStatus(sessionId) {
  const res = await fetch(
    `${SUPA_URL}/functions/v1/stripe-checkout-status?session_id=${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
  );
  return await res.json();
}

/**
 * Polling simples — chama `checkSessionStatus` a cada 2s até resolver ou timeout (60s).
 */
export async function pollSessionStatus(sessionId, onUpdate) {
  const start = Date.now();
  const maxMs = 60_000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - start > maxMs) return { status: 'timeout' };
    const data = await checkSessionStatus(sessionId);
    onUpdate?.(data);
    if (data.status === 'complete' || data.status === 'expired') return data;
    await new Promise((r) => setTimeout(r, 2000));
  }
}
