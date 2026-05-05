// supabase/functions/stripe-checkout-status/index.ts
// Polling endpoint — verifica status do pagamento no Stripe e atualiza
// payment_transactions + profiles.plano = 'premium' se pago.
// Idempotente: nunca processa o mesmo session_id duas vezes.

// @ts-nocheck
import Stripe from 'npm:stripe@14.21.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const STRIPE_KEY = Deno.env.get('STRIPE_API_KEY') || '';
const SUPA_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPA_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id') || (await safeJson(req)).session_id;
    if (!sessionId) return json({ error: 'missing session_id' }, 400);

    const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-06-20' });
    const sb = createClient(SUPA_URL, SUPA_SR);

    // Busca tx existente (idempotência)
    const { data: existing } = await sb
      .from('payment_transactions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    // Já processado e pago? retorna direto.
    if (existing?.status === 'completed') {
      return json({
        status: 'complete',
        payment_status: existing.payment_status,
        already_processed: true,
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const newStatus = session.status === 'complete' && session.payment_status === 'paid'
      ? 'completed'
      : (session.status === 'expired' ? 'expired' : 'pending');

    await sb.from('payment_transactions').update({
      status: newStatus,
      payment_status: session.payment_status,
      updated_at: new Date().toISOString(),
    }).eq('session_id', sessionId);

    // Se pago E ainda não processado: atualiza profile para premium.
    if (newStatus === 'completed' && existing?.user_id) {
      await sb.from('profiles').update({ plano: 'premium' }).eq('id', existing.user_id);
    }

    return json({
      status: session.status,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
    });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

async function safeJson(req) {
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      return await req.json();
    }
  } catch { /* ignore */ }
  return {};
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
