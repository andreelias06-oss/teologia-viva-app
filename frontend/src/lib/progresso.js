// Progresso de aulas — fonte de verdade no Supabase (`progresso_aulas`).
// Funções utilitárias + migração automática do localStorage no login.

import { supabase } from './supabase';

// Lista IDs de aulas concluídas pelo usuário (opcional: filtrado por curso).
export async function listProgress({ userId, cursoId } = {}) {
  if (!userId) return [];
  let q = supabase.from('progresso_aulas').select('aula_id, curso_id, completed_at').eq('user_id', userId);
  if (cursoId) q = q.eq('curso_id', cursoId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Marca uma aula como concluída (idempotente).
export async function markComplete({ userId, aulaId, cursoId }) {
  if (!userId || !aulaId) return null;
  const row = { user_id: userId, aula_id: aulaId, curso_id: cursoId || null };
  const { error } = await supabase
    .from('progresso_aulas')
    .upsert(row, { onConflict: 'user_id,aula_id' });
  if (error) throw error;
  return true;
}

// Remove a marca de conclusão.
export async function unmarkComplete({ userId, aulaId }) {
  if (!userId || !aulaId) return null;
  const { error } = await supabase
    .from('progresso_aulas')
    .delete()
    .eq('user_id', userId)
    .eq('aula_id', aulaId);
  if (error) throw error;
  return true;
}

// Migração one-shot do localStorage → Supabase.
// Lê todas as chaves `tv_progress_${userId}_${cursoId}` e faz upsert em massa.
// Após sucesso, marca uma flag para não rodar de novo no mesmo dispositivo.
const MIGRATED_KEY = 'tv_progress_migrated_v1';

export async function migrateLocalProgressToSupabase(userId) {
  if (!userId) return { migrated: 0, skipped: true };
  try {
    if (localStorage.getItem(`${MIGRATED_KEY}_${userId}`) === '1') {
      return { migrated: 0, skipped: true };
    }
  } catch { /* ignore */ }

  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`tv_progress_${userId}_`)) keys.push(k);
    }
  } catch { return { migrated: 0, skipped: true }; }

  if (keys.length === 0) {
    try { localStorage.setItem(`${MIGRATED_KEY}_${userId}`, '1'); } catch { /* ignore */ }
    return { migrated: 0 };
  }

  const rows = [];
  for (const k of keys) {
    try {
      const obj = JSON.parse(localStorage.getItem(k) || '{}');
      const cursoId = parseInt(k.split(`tv_progress_${userId}_`)[1], 10);
      for (const [aulaIdStr, done] of Object.entries(obj)) {
        if (!done) continue;
        const aulaId = parseInt(aulaIdStr, 10);
        if (!Number.isFinite(aulaId)) continue;
        rows.push({
          user_id: userId,
          aula_id: aulaId,
          curso_id: Number.isFinite(cursoId) ? cursoId : null,
        });
      }
    } catch { /* skip key */ }
  }

  if (rows.length === 0) {
    try { localStorage.setItem(`${MIGRATED_KEY}_${userId}`, '1'); } catch { /* ignore */ }
    return { migrated: 0 };
  }

  const { error } = await supabase
    .from('progresso_aulas')
    .upsert(rows, { onConflict: 'user_id,aula_id', ignoreDuplicates: true });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[progresso] migrate failed:', error);
    return { migrated: 0, error };
  }

  try { localStorage.setItem(`${MIGRATED_KEY}_${userId}`, '1'); } catch { /* ignore */ }
  return { migrated: rows.length };
}

// Subscribe to realtime changes — chamadas para `onChange` quando a tabela muda para esse user.
// Retorna função unsubscribe.
export function subscribeProgress(userId, onChange) {
  if (!userId) return () => {};
  const channel = supabase
    .channel(`progresso-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'progresso_aulas', filter: `user_id=eq.${userId}` },
      (payload) => {
        try { onChange?.(payload); } catch { /* ignore */ }
      },
    )
    .subscribe();
  return () => {
    try { supabase.removeChannel(channel); } catch { /* ignore */ }
  };
}
