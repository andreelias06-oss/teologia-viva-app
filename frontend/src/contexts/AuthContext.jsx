import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
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
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      setUser(sess?.user || null);
      if (sess?.user) await loadProfile(sess.user.id);
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
      await loadProfile(userId);
    }
    return data;
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

  return (
    <AuthCtx.Provider value={{ session, user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
