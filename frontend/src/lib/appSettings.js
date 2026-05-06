// Configurações globais do app (Modo de Manutenção/Cobrança).
//
// Lê e grava na tabela `app_settings` do Supabase. Uma única linha com
// `key='billing'` carrega um JSON com as flags do app.
//
// Schema esperado (rode no SQL editor do Supabase):
//   CREATE TABLE IF NOT EXISTS public.app_settings (
//     key text PRIMARY KEY,
//     value jsonb NOT NULL,
//     updated_at timestamptz DEFAULT now()
//   );
//   ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "settings readable by everyone" ON public.app_settings
//     FOR SELECT USING (true);
//   CREATE POLICY "settings writable by admins" ON public.app_settings
//     FOR ALL TO authenticated
//     USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
//     WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
//   INSERT INTO public.app_settings (key, value)
//     VALUES ('billing', '{"paywall_enabled": false, "beta_message": "Modo Beta — Acesso completo gratuito durante o período de testes."}'::jsonb)
//     ON CONFLICT (key) DO NOTHING;
//
// Se a tabela ainda não existir, o app continua funcionando com o default
// abaixo (paywall OFF), garantindo a fase Beta gratuita imediatamente.

import { supabase } from './supabase';

export const DEFAULT_SETTINGS = {
  paywall_enabled: false,
  beta_message: 'Modo Beta — Acesso completo gratuito durante o período de testes.',
};

export async function fetchAppSettings() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'billing')
      .maybeSingle();
    if (error || !data?.value) return DEFAULT_SETTINGS;
    // Mescla com defaults pra cobrir chaves novas adicionadas no futuro.
    return { ...DEFAULT_SETTINGS, ...data.value };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveAppSettings(value) {
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key: 'billing', value, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
  if (error) {
    // Erro tipicamente: 42P01 (table not exist) ou 42501 (RLS deny).
    const code = error.code || '';
    if (code === '42P01') {
      throw new Error('Tabela `app_settings` não existe no Supabase. Execute o SQL de migração.');
    }
    if (code === '42501') {
      throw new Error('Sem permissão. Confira que sua conta tem `is_admin=true` em profiles.');
    }
    throw error;
  }
}
