import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { NotebookPen, Check, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

const SAVE_DEBOUNCE_MS = 1500;

/**
 * Bloco de anotações da aula — auto-save (debounce) + botão "Salvar Anotação" explícito.
 * Salva por (user_id, aula_id) com upsert na tabela `anotacoes_aulas`.
 */
export default function AulaNotes({ aulaId }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('idle');  // idle | saving | saved
  const [manualSaving, setManualSaving] = useState(false);
  const lastSavedRef = useRef('');
  const timerRef = useRef(null);

  // Carrega anotação existente.
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setContent('');
    setStatus('idle');
    if (!user?.id || !aulaId) return;
    (async () => {
      const { data } = await supabase
        .from('anotacoes_aulas')
        .select('conteudo')
        .eq('user_id', user.id)
        .eq('aula_id', aulaId)
        .maybeSingle();
      if (!active) return;
      const c = data?.conteudo || '';
      setContent(c);
      lastSavedRef.current = c;
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [user?.id, aulaId]);

  // Core de persistência — reutilizado pelo debounce e pelo botão manual.
  const persist = async (value) => {
    if (!user?.id || !aulaId) return;
    await supabase
      .from('anotacoes_aulas')
      .upsert(
        { user_id: user.id, aula_id: aulaId, conteudo: value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,aula_id' },
      );
    lastSavedRef.current = value;
  };

  // Debounced auto-save.
  useEffect(() => {
    if (!loaded || !user?.id || !aulaId) return;
    if (content === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('saving');
    timerRef.current = setTimeout(async () => {
      try {
        await persist(content);
        setStatus('saved');
        setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
      } catch {
        setStatus('idle');
      }
    }, SAVE_DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, loaded, user?.id, aulaId]);

  const handleManualSave = async () => {
    if (!user?.id || !aulaId) return;
    // Cancela debounce pendente para evitar double-write.
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    // Tira o foco do textarea — evita insertBefore crash no Chrome Android.
    if (typeof document !== 'undefined' && document.activeElement?.blur) {
      try { document.activeElement.blur(); } catch { /* ignore */ }
    }
    setManualSaving(true);
    setStatus('saving');
    try {
      // Respiro técnico antes da escrita + re-render.
      await new Promise((r) => setTimeout(r, 200));
      await persist(content);
      setStatus('saved');
      toast.success('Anotação salva!');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch (e) {
      setStatus('idle');
      toast.error('Falha ao salvar anotação');
    } finally {
      setManualSaving(false);
    }
  };

  const hasUnsaved = loaded && content !== lastSavedRef.current;

  return (
    <section
      className="rounded-2xl border border-gold/30 bg-navy-light/30 p-5 space-y-3"
      data-testid="aula-notes"
      style={{ contain: 'layout paint' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-gold/80 font-sans font-semibold flex items-center gap-2">
          <NotebookPen size={14} /> Minhas anotações
        </p>
        <span className="text-[10px] font-sans text-foreground/50 flex items-center gap-1 min-h-[14px]">
          {status === 'saving' ? (<><Loader2 size={11} className="animate-spin" /> Salvando…</>)
            : status === 'saved' ? (<><Check size={11} className="text-gold" /> Salvo</>)
            : ' '}
        </span>
      </div>
      <Textarea
        data-testid="aula-notes-input"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={loaded ? 'Anote aqui suas reflexões e descobertas sobre esta aula…' : 'Carregando…'}
        rows={6}
        disabled={!loaded || !user?.id}
        className="bg-navy-dark/60 border-gold/30 text-foreground resize-y font-sans text-sm leading-relaxed"
        style={{ minHeight: '120px' }}
      />
      <Button
        data-testid="btn-salvar-anotacao"
        onClick={handleManualSave}
        disabled={!loaded || !user?.id || manualSaving}
        className="w-full h-11 active:scale-[0.98] transition-transform font-sans"
        style={{ backgroundColor: '#C5A059', color: '#001529' }}
      >
        {manualSaving ? (
          <><Loader2 size={16} className="mr-2 animate-spin" /> Salvando...</>
        ) : (
          <><Save size={16} className="mr-2" /> {hasUnsaved ? 'Salvar Anotação' : 'Salvar Anotação'}</>
        )}
      </Button>
    </section>
  );
}
