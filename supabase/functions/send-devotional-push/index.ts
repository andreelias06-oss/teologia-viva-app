// supabase/functions/send-devotional-push/index.ts
// Edge Function — envia Web Push notifications do devocional diário para todos os
// usuários inscritos. Disparada por pg_cron diariamente às 10:00 UTC (≈ 07:00 BRT).
//
// Secrets necessários (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT  (ex: mailto:contato@teologiaviva.app)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Body opcional (POST):
//   { date: 'YYYY-MM-DD', dryRun?: boolean }

// @ts-nocheck
// deno-lint-ignore-file
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@teologiaviva.app';
const SUPA_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPA_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { date, dryRun } = await safeJson(req);
    const sb = createClient(SUPA_URL, SUPA_SR);

    // 1) Devocional do dia (ou mais recente como fallback).
    const today = date || new Date().toISOString().slice(0, 10);
    let { data: devo } = await sb
      .from('devocionais')
      .select('titulo, versiculo_texto, referencia_biblica, data')
      .eq('data', today)
      .maybeSingle();
    if (!devo) {
      const { data: latest } = await sb
        .from('devocionais')
        .select('titulo, versiculo_texto, referencia_biblica, data')
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle();
      devo = latest;
    }
    if (!devo) {
      return json({ ok: false, error: 'Nenhum devocional disponível' }, 200);
    }

    const title = '☕ Seu devocional de hoje já está disponível!';
    const body = devo.titulo
      ? `${devo.titulo} — Vamos meditar na Palavra?`
      : 'Vamos meditar na Palavra?';

    // 2) Buscar inscrições de usuários com notif_devocional=true.
    const { data: subs } = await sb
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id, profiles!inner(notif_devocional)')
      .eq('profiles.notif_devocional', true);

    if (!subs || subs.length === 0) {
      return json({ ok: true, sent: 0, total: 0, devocional: devo.titulo });
    }

    if (dryRun) {
      return json({ ok: true, dryRun: true, total: subs.length, devocional: devo.titulo, title, body });
    }

    // 3) Enviar para todos.
    const payload = JSON.stringify({
      title,
      body,
      url: '/',
      tag: `devocional-${today}`,
      icon: '/icon-192.png',
    });
    const expiredIds: number[] = [];
    let sent = 0;
    let failed = 0;

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (err: any) {
          failed++;
          // 404/410 → endpoint expirado: remover.
          const sc = err?.statusCode;
          if (sc === 404 || sc === 410) expiredIds.push(s.id);
        }
      }),
    );

    if (expiredIds.length > 0) {
      await sb.from('push_subscriptions').delete().in('id', expiredIds);
    }

    return json({ ok: true, sent, failed, total: subs.length, expired: expiredIds.length, devocional: devo.titulo });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
});

async function safeJson(req: Request) {
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      return await req.json();
    }
  } catch { /* ignore */ }
  return {};
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
