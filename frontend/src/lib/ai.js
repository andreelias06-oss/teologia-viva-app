import { SUPABASE, supabase } from './supabase';

// Calls the clever-task Edge Function (POST /functions/v1/clever-task with { prompt })
export async function callCleverTask(prompt) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token || SUPABASE.anonKey;

  const res = await fetch(`${SUPABASE.url}/functions/v1/clever-task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE.anonKey,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    const msg = res.status === 0
      ? 'A função de IA está inacessível (CORS). Verifique a configuração da Edge Function clever-task.'
      : `Edge Function retornou ${res.status}. ${detail.slice(0, 200)}`;
    throw new Error(msg);
  }

  const data = await res.json().catch(() => ({}));
  // try to be tolerant about response field names
  return (
    data.output ||
    data.response ||
    data.text ||
    data.message ||
    data.result ||
    data.completion ||
    data.answer ||
    (typeof data === 'string' ? data : JSON.stringify(data))
  );
}
