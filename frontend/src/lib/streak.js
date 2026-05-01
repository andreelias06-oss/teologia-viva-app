import { supabase } from './supabase';

// Tries to call the RPC public.register_devo_read() — this updates current_streak
// in profiles atomically and returns the new values.
// Falls back to a client-side computation if the RPC isn't deployed yet.
export async function registerDevoRead() {
  try {
    const { data, error } = await supabase.rpc('register_devo_read');
    if (!error && data && data.length > 0) {
      const row = data[0];
      return {
        current_streak: row.current_streak,
        best_streak: row.best_streak,
        last_devo_date: row.last_devo_date,
        source: 'rpc',
      };
    }
  } catch {
    /* fall through to local */
  }

  // Local fallback (until SQL is deployed)
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let local = {};
  try {
    local = JSON.parse(localStorage.getItem('tv_local_streak') || '{}');
  } catch {
    /* ignore */
  }
  if (local.last_devo_date === today) {
    return { ...local, source: 'local' };
  }
  const cur = local.last_devo_date === yesterday ? (local.current_streak || 0) + 1 : 1;
  const best = Math.max(cur, local.best_streak || 0);
  const next = { current_streak: cur, best_streak: best, last_devo_date: today };
  try { localStorage.setItem('tv_local_streak', JSON.stringify(next)); } catch { /* ignore */ }
  return { ...next, source: 'local' };
}

export async function getStreak(profile) {
  // Prefer profile data from server (has columns last_devo_date, current_streak, best_streak)
  if (profile?.last_devo_date) {
    return {
      current_streak: profile.current_streak || 0,
      best_streak: profile.best_streak || 0,
      last_devo_date: profile.last_devo_date,
    };
  }
  try {
    const local = JSON.parse(localStorage.getItem('tv_local_streak') || '{}');
    return {
      current_streak: local.current_streak || 0,
      best_streak: local.best_streak || 0,
      last_devo_date: local.last_devo_date || null,
    };
  } catch {
    return { current_streak: 0, best_streak: 0, last_devo_date: null };
  }
}

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];

export function reachedMilestone(prev, current) {
  return STREAK_MILESTONES.find((m) => prev < m && current >= m);
}
