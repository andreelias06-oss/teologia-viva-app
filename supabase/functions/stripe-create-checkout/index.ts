// supabase/functions/stripe-create-checkout/index.ts
// Cria uma sessão de Stripe Checkout para upgrade Premium.
// Pacotes definidos no servidor (NUNCA aceita amount do frontend).

// @ts-nocheck
import Stripe from 'npm:stripe@14.21.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// PACOTES FIXOS (server-side)
const PACKAGES = {
  premium_mensal: { amount: 9.90, currency: 'brl', label: 'Teologia Viva Premium · Mensal' },
};

const STRIPE_KEY = Deno.env.get('STRIPE_API_KEY') || '';
const SUPA_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPA_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    const { package_id, origin_url } = await req.json();

    const pack = PACKAGES[package_id];
    if (!pack) return json({ error: 'invalid package' }, 400);
    if (!origin_url) return json({ error: 'missing origin_url' }, 400);

    // Recupera usuário do header Authorization (JWT).
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const sb = createClient(SUPA_URL, SUPA_SR);
    let user = null;
    if (token) {
      const { data } = await sb.auth.getUser(token);
      user = data?.user || null;
    }

    const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-06-20' });

    const successUrl = `${origin_url.replace(/\/$/, '')}/perfil?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin_url.replace(/\/$/, '')}/perfil`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: pack.currency,
          product_data: { name: pack.label },
          unit_amount: Math.round(pack.amount * 100),
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user?.email || undefined,
      metadata: {
        package_id,
        user_id: user?.id || '',
        user_email: user?.email || '',
      },
    });

    // Cria registro pendente em payment_transactions
    await sb.from('payment_transactions').insert({
      user_id: user?.id || null,
      user_email: user?.email || null,
      session_id: session.id,
      amount: pack.amount,
      currency: pack.currency,
      status: 'pending',
      package_id,
      metadata: { stripe_session: session.id },
    });

    return json({ url: session.url, session_id: session.id });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
