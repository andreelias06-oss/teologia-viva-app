import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Textarea } from './ui/textarea';
import { NotebookPen, Check, Loader2 } from 'lucide-react';

const SAVE_DEBOUNCE_MS = 1500;

/**
 * Bloco de anotações da aula — auto-save com debounce na tabela `anotacoes_aulas`.
 * Salva por (user_id, aula_id) com upsert.
 */
export default function AulaNotes({ aulaId }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('idle');  // idle | saving | saved
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

  // Debounced auto-save.
  useEffect(() => {
    if (!loaded || !user?.id || !aulaId) return;
    if (content === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('saving');
    timerRef.current = setTimeout(async () => {
      try {
        const trimmed = content;
        await supabase
          .from('anotacoes_aulas')
          .upsert(
            { user_id: user.id, aula_id: aulaId, conteudo: trimmed, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,aula_id' },
          );
        lastSavedRef.current = trimmed;
        setStatus('saved');
        setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
      } catch {
        setStatus('idle');
      }
    }, SAVE_DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [content, loaded, user?.id, aulaId]);

  return (
    <section className="rounded-2xl border border-gold/30 bg-navy-light/30 p-5 space-y-3" data-testid="aula-notes">
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
    </section>
  );
}
