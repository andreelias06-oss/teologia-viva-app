// Helpers de Web Push para o frontend.
// Fluxo: registerSW → askPermission → subscribe → save no Supabase.

import { supabase } from './supabase';

const VAPID_PUBLIC = process.env.REACT_APP_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[push] SW register failed:', e);
    return null;
  }
}

export async function askPermission() {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

export async function subscribePush(userId) {
  if (!isPushSupported()) throw new Error('Notificações não suportadas neste dispositivo');
  if (!VAPID_PUBLIC) throw new Error('VAPID public key ausente');
  const perm = await askPermission();
  if (perm !== 'granted') throw new Error('Permissão de notificação negada');

  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await registerServiceWorker();
  if (!reg) throw new Error('Service Worker indisponível');

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }
  // sub.toJSON() → { endpoint, keys: { p256dh, auth } }
  const j = sub.toJSON();
  const row = {
    user_id: userId,
    endpoint: j.endpoint,
    p256dh: j.keys?.p256dh,
    auth: j.keys?.auth,
    user_agent: navigator.userAgent.slice(0, 200),
  };
  // upsert por endpoint
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' });
  if (error) throw error;
  return sub;
}

export async function unsubscribePush() {
  const sub = await getCurrentSubscription();
  if (sub) {
    try {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    } catch { /* ignore */ }
    try {
      await sub.unsubscribe();
    } catch { /* ignore */ }
  }
}
