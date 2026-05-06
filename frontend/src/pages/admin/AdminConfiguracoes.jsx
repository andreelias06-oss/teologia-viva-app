import { useEffect, useState } from 'react';
import { fetchAppSettings, saveAppSettings, DEFAULT_SETTINGS } from '../../lib/appSettings';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { Loader2, ShieldAlert, Sparkles, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Admin → Configurações Globais
 * Toggle do "Modo de Cobrança / Paywall" + mensagem Beta.
 *
 * Quando paywall_enabled=false (padrão Beta), todas as aulas e o Tutor IA
 * ficam liberados pra qualquer usuário logado.
 */
export default function AdminConfiguracoes() {
  const { refreshAppSettings } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const s = await fetchAppSettings();
      if (!mounted) return;
      setSettings(s);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await saveAppSettings(settings);
      await refreshAppSettings();
      toast.success('Configurações salvas e sincronizadas para todos os usuários.');
    } catch (e) {
      setError(e?.message || 'Falha ao salvar');
      toast.error(e?.message || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-gold/70" />
      </div>
    );
  }

  const paywallOff = !settings.paywall_enabled;

  return (
    <div className="space-y-6" data-testid="admin-configuracoes">
      <div>
        <h2 className="font-serif text-2xl lg:text-3xl text-foreground">Configurações</h2>
        <p className="text-xs lg:text-sm font-sans text-foreground/60 mt-0.5">
          Controle global do modo de cobrança e mensagens Beta. Mudanças se aplicam imediatamente a todos os usuários.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[480px_1fr] lg:gap-8 lg:items-start space-y-6 lg:space-y-0">
        {/* Coluna ESQUERDA: toggle principal + mensagem Beta */}
        <div className="space-y-4">
          {/* Toggle paywall */}
          <div
            className={`rounded-2xl border p-5 lg:p-6 space-y-4 ${
              paywallOff
                ? 'border-gold/35 bg-gradient-to-br from-gold/10 to-navy-light/10'
                : 'border-destructive/40 bg-destructive/5'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center shrink-0 border ${
                  paywallOff ? 'bg-gold/20 border-gold/40' : 'bg-destructive/20 border-destructive/40'
                }`}
              >
                {paywallOff ? <Sparkles size={18} className="text-gold" /> : <ShieldAlert size={18} className="text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-lg lg:text-xl text-foreground">Modo de Cobrança</p>
                <p className="text-xs lg:text-sm font-sans text-foreground/70 mt-1 leading-relaxed">
                  Quando <strong>desativado</strong>, todas as aulas e o Tutor IA ficam acessíveis a qualquer usuário logado (modo Beta).
                  Ao <strong>ativar</strong>, o paywall normal volta a valer (Trial 7 dias → Free com limite → Premium).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-navy-light/30 rounded-xl border border-gold/15 px-4 py-3">
              <div>
                <p className="text-sm font-sans font-semibold text-foreground">Cobrança ativa</p>
                <p className="text-[11px] font-sans text-foreground/60">
                  {settings.paywall_enabled ? 'Paywall normal habilitado' : 'BETA — Tudo liberado para logados'}
                </p>
              </div>
              <Switch
                data-testid="toggle-paywall"
                checked={!!settings.paywall_enabled}
                onCheckedChange={(v) => update({ paywall_enabled: v })}
              />
            </div>
          </div>

          {/* Mensagem Beta */}
          <div className="rounded-2xl border border-gold/20 bg-navy-light/20 p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gold/80 font-sans font-semibold">
              Mensagem do Modo Beta
            </p>
            <p className="text-xs font-sans text-foreground/65">
              Texto exibido no badge "Status da Conta" do perfil quando a cobrança está desativada.
            </p>
            <Textarea
              data-testid="input-beta-message"
              value={settings.beta_message || ''}
              onChange={(e) => update({ beta_message: e.target.value })}
              rows={3}
              maxLength={200}
              placeholder="Modo Beta — Acesso completo gratuito durante o período de testes."
              className="bg-navy-dark/60 border-gold/30 text-foreground resize-none font-sans text-sm"
            />
          </div>

          <Button
            data-testid="btn-save-settings"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 bg-gold text-navy-dark hover:bg-gold-soft active:scale-[0.98]"
          >
            {saving ? (
              <><Loader2 size={16} className="mr-2 animate-spin" /> Salvando…</>
            ) : (
              <><Save size={16} className="mr-2" /> Salvar configurações</>
            )}
          </Button>

          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
              <div className="text-xs font-sans text-destructive-foreground/90 space-y-1">
                <p>{error}</p>
                {/Tabela.*não existe/i.test(error) ? (
                  <p>
                    Rode o SQL de migração no Supabase Dashboard → SQL Editor (veja `lib/appSettings.js` para o script completo).
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Coluna DIREITA: preview do estado atual */}
        <aside>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-3">
            Estado atual
          </p>
          <div className="rounded-2xl border border-gold/15 bg-navy-light/20 p-6 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/55 font-sans font-semibold">
                Cobrança
              </p>
              <p className={`mt-1 font-serif text-2xl ${paywallOff ? 'text-gold' : 'text-destructive'}`}>
                {paywallOff ? 'Desativada (Beta)' : 'Ativa'}
              </p>
            </div>
            <div className="border-t border-gold/15 pt-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/55 font-sans font-semibold">
                Status para usuários logados
              </p>
              <p className="mt-1 font-serif text-xl text-foreground">
                {paywallOff ? 'Premium · Beta (automático)' : 'Trial / Free / Premium (real)'}
              </p>
            </div>
            <div className="border-t border-gold/15 pt-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/55 font-sans font-semibold">
                Acesso a Aulas
              </p>
              <p className="mt-1 font-sans text-sm text-foreground/80">
                {paywallOff
                  ? 'Todas as 21 aulas liberadas para qualquer usuário logado.'
                  : 'Aulas premium exigem plano Trial/Premium.'}
              </p>
            </div>
            <div className="border-t border-gold/15 pt-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/55 font-sans font-semibold">
                Tutor IA
              </p>
              <p className="mt-1 font-sans text-sm text-foreground/80">
                {paywallOff
                  ? 'Sem limite diário para usuários logados.'
                  : '5 consultas/dia para Free; ilimitado para Trial/Premium.'}
              </p>
            </div>
            <div className="border-t border-gold/15 pt-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/55 font-sans font-semibold">
                Curadoria (Admin)
              </p>
              <p className="mt-1 font-sans text-sm text-foreground/80">
                Sempre acessível para usuários com <code>is_admin=true</code>.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
