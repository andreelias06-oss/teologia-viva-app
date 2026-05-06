import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { migrateLocalProgressToSupabase } from '../lib/progresso';
import { fetchAppSettings, DEFAULT_SETTINGS } from '../lib/appSettings';
import { setPaywallEnabled } from '../lib/plan';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [appSettings, setAppSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return null; }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) {
      // Fallback: virtual profile so the app keeps working even if `profiles` table doesn't exist
      const synthetic = {
        id: userId,
        plano: 'trial',
        trial_inicio: new Date().toISOString(),
        nome: null,
        synthetic: true,
      };
      setProfile(synthetic);
      return synthetic;
    }
    setProfile(data);
    return data;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user || null);
      setLoading(false);
      // Carrega configurações globais (paywall / beta) em paralelo. Falha
      // silenciosa: usa DEFAULT_SETTINGS (paywall OFF) se a tabela não existir.
      fetchAppSettings().then((s) => {
        if (!mounted) return;
        setAppSettings(s);
        setPaywallEnabled(!!s.paywall_enabled);
      }).catch(() => {});
      // Load profile in background so loader unblocks quickly
      if (data.session?.user) {
        loadProfile(data.session.user.id);
        migrateLocalProgressToSupabase(data.session.user.id).catch(() => { /* ignore */ });
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      setUser(sess?.user || null);
      if (sess?.user) {
        loadProfile(sess.user.id);
        migrateLocalProgressToSupabase(sess.user.id).catch(() => { /* ignore */ });
      }
      else setProfile(null);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [loadProfile]);

  const signUp = async ({ email, password, nome }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } },
    });
    if (error) throw error;
    const userId = data.user?.id;
    if (userId) {
      // Best-effort profile creation. If table/columns differ, we silently keep the synthetic profile.
      try {
        await supabase.from('profiles').upsert(
          {
            id: userId,
            nome: nome || null,
            email,
            plano: 'trial',
            trial_inicio: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch {
        /* ignore */
      }
    }
    // Supabase may return user auto-confirmed but session=null depending on project settings.
    // If user is confirmed (email_confirmed_at present) and we have their password, sign them in now.
    if (!data.session && data.user?.email_confirmed_at) {
      try {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInError && signInData.session) {
          await loadProfile(signInData.user.id);
          return { ...data, session: signInData.session, user: signInData.user };
        }
      } catch {
        /* fall through */
      }
    }

    if (data.session && userId) {
      await loadProfile(userId);
    }

    // If still no session AND user is not confirmed, email confirmation is actually required.
    return { ...data, needsEmailConfirmation: !data.session && !data.user?.email_confirmed_at };
  };

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) await loadProfile(data.user.id);
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user?.id) await loadProfile(user.id);
  };

  // Permite que o painel admin atualize as flags globais sem reload.
  const refreshAppSettings = useCallback(async () => {
    const next = await fetchAppSettings();
    setAppSettings(next);
    setPaywallEnabled(!!next.paywall_enabled);
    return next;
  }, []);

  return (
    <AuthCtx.Provider value={{ session, user, profile, appSettings, loading, signUp, signIn, signOut, refreshProfile, refreshAppSettings }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
