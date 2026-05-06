import { useState, useEffect } from 'react';
import { supabase, SUPABASE } from '../lib/supabase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Sparkles, Loader2, X, RefreshCw, Check, AlertCircle, Calendar, Pencil } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Wizard fullscreen para geração de devocional pela IA.
 *
 * Fluxo:
 *  1. Admin escolhe a data (default = hoje).
 *  2. Clica "Gerar com IA" → chama Edge Function `generate-daily-devotional` com { date, force:true }.
 *  3. Edge function INSERE nova linha em `devocionais` (substitui se já existia para a data).
 *  4. Preview dos campos gerados (Título, Versículo, Reflexão, Oração).
 *  5. "Concluir" → fecha + dispara `onSaved` → AdminDevocionais.load().
 *  6. "Gerar novamente" → re-chama com nova data ou força nova geração.
 *  7. "Editar manualmente" → fecha o wizard e abre o AdminFormDrawer pré-preenchido.
 *
 * Sempre montado no DOM (visibility toggle) — segue padrão anti-crash do app.
 */
export default function DevocionalAIWizard({ open, onClose, onSaved, onEdit }) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(todayISO);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);  // devocional gerado
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setData(todayISO);
      setResult(null);
      setError('');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Trava scroll do body enquanto wizard está aberto.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const generate = async () => {
    if (!data) { toast.error('Informe a data'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || SUPABASE.anonKey;
      const res = await fetch(`${SUPABASE.url}/functions/v1/generate-daily-devotional`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE.anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date: data, force: true }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message || payload?.error || 'Falha na geração');
      const dev = payload?.devocional;
      if (!dev) throw new Error('Resposta inválida da IA');
      setResult(dev);
      toast.success('Devocional gerado e salvo automaticamente!');
    } catch (e) {
      setError(e?.message || 'Falha ao gerar');
      toast.error(e?.message || 'Falha ao gerar');
    } finally {
      setLoading(false);
    }
  };

  const handleConcluir = () => {
    onSaved?.();
    onClose?.();
  };

  const handleEditar = () => {
    if (result) onEdit?.(result);
    onClose?.();
  };

  return (
    <div
      data-testid="devocional-ai-wizard"
      role="dialog"
      aria-modal={open ? 'true' : 'false'}
      aria-hidden={open ? 'false' : 'true'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99998,
        background: '#001529',
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        visibility: open ? 'visible' : 'hidden',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-gold/15 shrink-0"
        style={{ background: '#001529' }}
      >
        <div className="flex-1 min-w-0">
          <p className="font-serif text-xl text-gold flex items-center gap-2 truncate">
            <Sparkles size={18} strokeWidth={1.5} /> Criar Devocional com IA
          </p>
          <p className="text-foreground/65 text-xs font-sans truncate">
            A IA escreve um devocional cristocêntrico para a data escolhida.
          </p>
        </div>
        <button
          type="button"
          data-testid="wizard-close"
          onClick={onClose}
          aria-label="Fechar"
          className="ml-3 w-10 h-10 rounded-full border border-gold/30 text-foreground hover:bg-gold/10 flex items-center justify-center shrink-0"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body — scroll independente */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        {/* Step 1: Data picker */}
        <section className="rounded-2xl border border-gold/25 bg-navy-light/20 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gold" />
            <p className="text-[10px] uppercase tracking-[0.18em] text-gold/80 font-sans font-semibold">
              Data do Devocional
            </p>
          </div>
          <Input
            data-testid="wizard-date-input"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            disabled={loading}
            className="bg-navy-dark/60 border-gold/30 text-foreground h-12 text-base font-sans"
          />
          <p className="text-[11px] font-sans text-foreground/55 italic">
            Padrão: hoje. Você pode escolher datas futuras (agendar) ou passadas (preencher histórico).
          </p>
        </section>

        {/* Step 2: Generate / Result */}
        {!result ? (
          <section className="space-y-3">
            <Button
              data-testid="wizard-generate"
              onClick={generate}
              disabled={loading || !data}
              className="w-full h-14 text-base bg-gold text-navy-dark hover:bg-gold-soft active:scale-[0.98]"
            >
              {loading ? (
                <><Loader2 size={18} className="mr-2 animate-spin" /> A IA está refletindo…</>
              ) : (
                <><Sparkles size={18} className="mr-2" /> Gerar com IA</>
              )}
            </Button>
            {error ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                <p className="text-xs font-sans text-destructive-foreground/90">{error}</p>
              </div>
            ) : null}
            <p className="text-[11px] font-sans text-foreground/55 italic text-center">
              A IA leva ~5-10 segundos. Cada geração cria/substitui automaticamente o devocional dessa data.
            </p>
          </section>
        ) : (
          <section data-testid="wizard-result" className="space-y-4">
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 flex items-center gap-2">
              <Check size={18} className="text-gold shrink-0" />
              <p className="text-sm font-sans text-foreground/90">
                Devocional salvo automaticamente em <span className="text-gold font-semibold">{data}</span>.
              </p>
            </div>

            <Section label="Título" value={result.titulo} testid="result-titulo" />
            <Section
              label="Versículo"
              value={`${result.versiculo_texto || ''}\n— ${result.referencia_biblica || ''}`}
              testid="result-versiculo"
              italic
            />
            <Section label="Reflexão & Aplicação" value={result.reflexao} testid="result-reflexao" />
            <Section label="Oração Sugerida" value={result.oracao_sugerida} testid="result-oracao" italic />
          </section>
        )}
      </div>

      {/* Footer — ações sticky */}
      <div
        className="border-t border-gold/15 px-5 py-4 shrink-0 grid gap-2"
        style={{ background: '#001529' }}
      >
        {result ? (
          <>
            <Button
              data-testid="wizard-concluir"
              onClick={handleConcluir}
              className="w-full h-12 bg-gold text-navy-dark hover:bg-gold-soft"
            >
              <Check size={16} className="mr-2" /> Concluir
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                data-testid="wizard-regen"
                onClick={generate}
                disabled={loading}
                variant="outline"
                className="h-11 border-gold/40 text-gold hover:bg-gold/10"
              >
                <RefreshCw size={14} className="mr-2" /> Gerar novamente
              </Button>
              <Button
                data-testid="wizard-edit"
                onClick={handleEditar}
                variant="outline"
                className="h-11 border-gold/40 text-foreground hover:bg-gold/10"
              >
                <Pencil size={14} className="mr-2" /> Editar manualmente
              </Button>
            </div>
          </>
        ) : (
          <Button
            data-testid="wizard-cancel"
            onClick={onClose}
            disabled={loading}
            variant="outline"
            className="w-full h-11 border-gold/30 text-foreground/80 hover:bg-gold/10"
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}

function Section({ label, value, testid, italic = false }) {
  return (
    <div className="rounded-xl border border-gold/20 bg-navy-light/20 p-4 space-y-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gold/80 font-sans font-semibold">
        {label}
      </p>
      <p
        data-testid={testid}
        className={`text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap ${italic ? 'font-serif italic text-base' : 'font-sans'}`}
      >
        {value || '—'}
      </p>
    </div>
  );
}
