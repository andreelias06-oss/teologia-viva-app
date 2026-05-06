import { useState, useRef, useEffect } from 'react';
import { Drawer, DrawerContent } from './ui/drawer';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { callCleverTask } from '../lib/ai';
import { canUseAI, incrementAICalls } from '../lib/plan';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

/**
 * AITutorDrawer — chat fullscreen no mobile, drawer no desktop.
 *
 * Layout estilo WhatsApp/Telegram (pure flex column, sem position:absolute):
 *   ┌──────────────────────────┐
 *   │  Header (flex-shrink: 0) │
 *   ├──────────────────────────┤
 *   │  Messages (flex: 1,      │
 *   │           overflow-y:    │
 *   │           auto)          │
 *   │                          │
 *   ├──────────────────────────┤
 *   │  Input (flex-shrink: 0)  │
 *   └──────────────────────────┘
 *
 * - 100dvh no mobile responde ao teclado Android (a área visível encolhe e
 *   o input "sobe junto" naturalmente, sem cálculo manual).
 * - O input é IRMÃO da área de mensagens (não overlay) → nunca é "engolido"
 *   pelo teclado nem por reflows do Chrome.
 * - Auto-scroll para o final em cada mensagem nova.
 */
export default function AITutorDrawer({ open, onOpenChange, contexto, titulo = 'Tutor IA', descricao }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Detecta dispositivo touch — mobile recebe modal fullscreen sem Vaul.
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

  // Limpa mensagens quando o drawer abre (novo contexto).
  useEffect(() => {
    if (open) setMessages([]);
  }, [open, contexto]);

  // Auto-scroll para o final em cada mensagem/loading.
  // 2 passos (imediato + rAF) garante que o scroll segue o layout final
  // mesmo depois que o React pinta a nova bolha.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    const raf = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
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
        ? `Contexto:\n${contexto}\n\nPergunta do aluno: ${q}\n\nResponda como tutor de teologia, em português, com base bíblica clara, citando referências quando útil.`
        : `Pergunta sobre teologia: ${q}\n\nResponda em português, com base bíblica clara.`;
      const answer = await callCleverTask(fullPrompt);
      if (!isMountedRef.current) return;
      incrementAICalls(user?.id);
      setMessages((m) => [...m, { role: 'assistant', text: answer }]);
    } catch {
      if (!isMountedRef.current) return;
      toast.error('Falha ao consultar o Tutor IA');
      setMessages((m) => [...m, { role: 'assistant', text: 'Desculpe, não consegui responder agora. Tente novamente.' }]);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  // ─── Header (compartilhado mobile + desktop) ───
  const header = (
    <div
      className="flex items-center justify-between px-5 py-3 border-b border-gold/15"
      style={{ background: '#001529', flexShrink: 0 }}
    >
      <div className="flex-1 min-w-0">
        <p className="font-serif text-xl text-gold flex items-center gap-2 truncate">
          <Sparkles size={18} strokeWidth={1.5} /> {titulo}
        </p>
        {descricao ? (
          <p className="text-foreground/70 text-xs font-sans truncate">{descricao}</p>
        ) : null}
      </div>
      {isMobile ? (
        <button
          type="button"
          data-testid="ai-tutor-mobile-close"
          onClick={() => onOpenChange(false)}
          aria-label="Fechar"
          className="ml-3 w-10 h-10 rounded-full border border-gold/30 text-foreground hover:bg-gold/10 flex items-center justify-center shrink-0"
        >
          <X size={20} />
        </button>
      ) : null}
    </div>
  );

  // ─── Área de mensagens — flex:1 + overflow-y:auto + min-height:0
  // (min-height:0 é o segredo do flex pra deixar o filho rolar quando o
  // conteúdo passa do tamanho do container).
  const messagesArea = (
    <div
      ref={scrollRef}
      data-testid="ai-tutor-messages"
      className="space-y-3 px-5 py-4"
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        // Padding-bottom extra evita a última mensagem grudar na barra de input.
        paddingBottom: '24px',
      }}
    >
      {messages.length === 0 && (
        <div className="text-foreground/55 text-sm font-sans italic text-center py-8 max-w-[85%] mx-auto">
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
          {/* whitespace-pre-wrap + word-break:break-word permite que respostas
              longas da IA quebrem corretamente sem travar a largura da bolha. */}
          <div
            className="font-sans"
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {m.text}
          </div>
        </div>
      ))}
      {loading && (
        <div className="bg-navy-light/70 border border-gold/10 rounded-2xl px-4 py-3 max-w-[60%] flex items-center gap-2 text-gold/80">
          <Loader2 size={16} className="animate-spin" /> <span className="text-sm">Refletindo…</span>
        </div>
      )}
    </div>
  );

  // ─── Barra de input (compartilhada) ───
  const inputBar = (
    <div
      className="flex items-end gap-2 px-5 py-3 border-t border-gold/15"
      style={{ background: '#001529', flexShrink: 0 }}
    >
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
        aria-label="Enviar"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
      </Button>
    </div>
  );

  // ─── Mobile: Modal Fullscreen — flex column puro, sem position:absolute.
  // SEMPRE MONTADO (visibility toggle) — anti-crash insertBefore.
  if (isMobile) {
    return (
      <div
        data-testid="ai-tutor-mobile-modal"
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
          // 100dvh = altura visível dinâmica → encolhe quando o teclado Android
          // abre. Combinado com flex-column, o input "sobe junto" sem JS.
          height: '100dvh',
          maxHeight: '100dvh',
          visibility: open ? 'visible' : 'hidden',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        {header}
        {messagesArea}
        {inputBar}
      </div>
    );
  }

  // ─── Desktop: Drawer Vaul, mas com altura controlada e flex column.
  // DrawerContent ganha max-h-[85vh] e flex-column pra área de mensagens
  // poder rolar ao invés de empurrar o input pra fora.
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="bg-navy-dark border-gold/20 mx-auto p-0"
        style={{
          maxWidth: '480px',
          width: '100%',
          height: '85vh',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {header}
        {messagesArea}
        {inputBar}
      </DrawerContent>
    </Drawer>
  );
}
