import { useState, useRef, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from './ui/drawer';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { callCleverTask } from '../lib/ai';
import { canUseAI, incrementAICalls } from '../lib/plan';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function AITutorDrawer({ open, onOpenChange, contexto, titulo = 'Tutor IA', descricao }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Detecta dispositivo touch (S24 Ultra etc.) — modal fullscreen no mobile.
  const [isMobile, setIsMobile] = useState(() => {
    try { return window.matchMedia('(pointer: coarse)').matches; }
    catch { return false; }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: coarse)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Trava scroll do body quando modal mobile está aberto.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open && isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open, isMobile]);

  useEffect(() => {
    if (open) setMessages([]);
  }, [open, contexto]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q) return;
    const check = canUseAI(profile, user?.id);
    if (!check.ok) {
      toast.error(`Limite diário de ${check.limit} consultas atingido. Upgrade para Premium.`);
      return;
    }
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);
    try {
      const fullPrompt = contexto
        ? `Contexto da aula:\n${contexto}\n\nPergunta do aluno: ${q}\n\nResponda como tutor de teologia, em português, com base bíblica clara, citando referências quando útil.`
        : `Pergunta sobre teologia: ${q}\n\nResponda em português, com base bíblica clara.`;
      const answer = await callCleverTask(fullPrompt);
      incrementAICalls(user?.id);
      setMessages((m) => [...m, { role: 'assistant', text: answer }]);
    } catch (e) {
      toast.error('Falha ao consultar o Tutor IA');
      setMessages((m) => [...m, { role: 'assistant', text: 'Desculpe, não consegui responder agora. Tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  };

  // ─── Conteúdo compartilhado entre Drawer (desktop) e Modal Fullscreen (mobile) ───
  const messagesArea = (
    <div
      ref={scrollRef}
      className="overflow-y-auto space-y-3 px-5 py-4"
      data-testid="ai-tutor-messages"
      style={isMobile ? { flex: 1, minHeight: 0 } : { maxHeight: '55vh' }}
    >
      {messages.length === 0 && (
        <div className="text-foreground/50 text-sm font-sans italic text-center py-8">
          Faça uma pergunta sobre o conteúdo. O tutor responde com base nas Escrituras.
        </div>
      )}
      {messages.map((m, i) => (
        <div
          key={i}
          className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            m.role === 'user'
              ? 'ml-auto bg-gold/15 border border-gold/30 text-foreground'
              : 'bg-navy-light/70 border border-gold/10 text-foreground/90'
          }`}
        >
          <div className="text-[10px] uppercase tracking-[0.15em] mb-1 text-gold/70">
            {m.role === 'user' ? 'Você' : 'Tutor'}
          </div>
          <div className="whitespace-pre-wrap font-sans">{m.text}</div>
        </div>
      ))}
      {loading && (
        <div className="bg-navy-light/70 border border-gold/10 rounded-2xl px-4 py-3 max-w-[60%] flex items-center gap-2 text-gold/80">
          <Loader2 size={16} className="animate-spin" /> <span className="text-sm">Refletindo…</span>
        </div>
      )}
    </div>
  );

  const inputBar = (
    <div className="flex items-end gap-2 px-5 py-3 bg-[#001529] border-t border-gold/15">
      <Textarea
        data-testid="ai-tutor-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Pergunte ao tutor…"
        rows={2}
        className="bg-navy-light/40 border-gold/20 text-foreground resize-none flex-1"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <Button
        data-testid="ai-tutor-send"
        onClick={send}
        disabled={loading || !input.trim()}
        className="bg-gold text-navy-dark hover:bg-gold-soft active:scale-95 h-12 w-12 p-0 shrink-0"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
      </Button>
    </div>
  );

  // ─── Mobile: Modal Fullscreen com header fixo + input fixo + scroll independente ───
  if (isMobile) {
    if (!open) return null;
    return (
      <div
        data-testid="ai-tutor-mobile-modal"
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99998,
          background: '#001529',
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
        }}
      >
        {/* Header fixo */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-gold/15 shrink-0"
          style={{ background: '#001529' }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-serif text-xl text-gold flex items-center gap-2 truncate">
              <Sparkles size={18} strokeWidth={1.5} /> {titulo}
            </p>
            {descricao ? (
              <p className="text-foreground/70 text-xs font-sans truncate">{descricao}</p>
            ) : null}
          </div>
          <button
            type="button"
            data-testid="ai-tutor-mobile-close"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="ml-3 w-10 h-10 rounded-full border border-gold/30 text-foreground hover:bg-gold/10 flex items-center justify-center shrink-0"
          >
            <X size={20} />
          </button>
        </div>
        {/* Mensagens — flex:1 e scroll próprio */}
        {messagesArea}
        {/* Input bar fixo no fundo. Em Android, quando o teclado abre, a janela visual encolhe e
            como usamos 100dvh + flex column, o input "sobe junto" e o scroll segue o último msg. */}
        {inputBar}
      </div>
    );
  }

  // ─── Desktop: mantém Drawer Vaul tradicional ───
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-navy-dark border-gold/20 max-w-md mx-auto">
        <DrawerHeader className="border-b border-gold/10">
          <DrawerTitle className="font-serif text-2xl text-gold flex items-center gap-2">
            <Sparkles size={18} strokeWidth={1.5} /> {titulo}
          </DrawerTitle>
          {descricao && <DrawerDescription className="text-foreground/70 text-sm">{descricao}</DrawerDescription>}
        </DrawerHeader>
        {messagesArea}
        <DrawerFooter className="border-t border-gold/10 gap-2 p-0">
          {inputBar}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
