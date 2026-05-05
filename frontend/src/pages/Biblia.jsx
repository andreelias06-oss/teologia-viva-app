import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchChapter, listBooks, getChaptersCount, TRANSLATIONS, DEFAULT_TRANSLATION } from '../lib/bible';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '../components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import {
  Sparkles, Loader2, ChevronLeft, ChevronRight, BookOpen,
  Bookmark, Highlighter, Save, Trash2, X, FileText, Type, Share2, Download,
} from 'lucide-react';
import { callCleverTask } from '../lib/ai';
import { useAuth } from '../contexts/AuthContext';
import { canUseAI, incrementAICalls } from '../lib/plan';
import { loadChapterNotes, upsertVerseNote, COLOR_MAP } from '../lib/bibleNotes';
import VerseExplanation from '../components/VerseExplanation';
import ErrorBoundary from '../components/ErrorBoundary';
import ShareVerseCard from '../components/ShareVerseCard';
import { shareVerseCard, saveVerseCard } from '../lib/share';
import { toast } from 'sonner';

const FONT_SIZES = [
  { id: 'sm', label: 'Pequeno', cls: 'text-[16px] leading-relaxed' },
  { id: 'md', label: 'Médio', cls: 'text-[19px] leading-loose' },
  { id: 'lg', label: 'Grande', cls: 'text-[22px] leading-loose' },
  { id: 'xl', label: 'Extra grande', cls: 'text-[25px] leading-loose' },
];
const LS_FONT = 'tv_biblia_font_size';
const LS_TRANSLATION = 'tv_biblia_translation';
const LS_BOOK = 'tv_biblia_book';
const LS_CHAPTER = 'tv_biblia_chapter';

export default function Biblia() {
  // Persistência simples
  const [translationId, setTranslationId] = useState(() => {
    try { return localStorage.getItem(LS_TRANSLATION) || DEFAULT_TRANSLATION; }
    catch { return DEFAULT_TRANSLATION; }
  });
  const [fontSizeId, setFontSizeId] = useState(() => {
    try { return localStorage.getItem(LS_FONT) || 'md'; }
    catch { return 'md'; }
  });
  const fontCls = useMemo(
    () => (FONT_SIZES.find((f) => f.id === fontSizeId) || FONT_SIZES[1]).cls,
    [fontSizeId],
  );

  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_BOOK);
      // Migração: schema antigo usava ids tipo "joao", "genesis". Agora usamos abbrev "jo", "gn".
      if (raw && raw.length > 4) return 'jo';
      return raw || 'jo';
    } catch { return 'jo'; }
  });
  const [chapter, setChapter] = useState(() => {
    try { return parseInt(localStorage.getItem(LS_CHAPTER) || '3', 10); } catch { return 3; }
  });
  const [chaptersCount, setChaptersCount] = useState(0);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [chapterData, setChapterData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Seleção múltipla (lista da Bíblia)
  const [selectedVerses, setSelectedVerses] = useState([]);

  // Detecta dispositivo touch (mobile/tablet com touch) — no S24 Ultra retorna true.
  // Mobile recebe MODAL FULLSCREEN sem Vaul/animação para eliminar o crash insertBefore.
  const [isMobile, setIsMobile] = useState(() => {
    try {
      return typeof window !== 'undefined'
        && window.matchMedia('(pointer: coarse)').matches;
    } catch { return false; }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: coarse)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Breakpoint desktop largo (Tailwind `lg` = 1024px). No desktop, o painel de estudo
  // vira uma coluna lateral sticky em vez do Drawer Vaul — evita duplicação de UI.
  const [isDesktopWide, setIsDesktopWide] = useState(() => {
    try {
      return typeof window !== 'undefined'
        && window.matchMedia('(min-width: 1024px)').matches;
    } catch { return false; }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => setIsDesktopWide(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Quando o modal/drawer abre no mobile, suspende interações da lista por 1 segundo.
  const [suspendList, setSuspendList] = useState(false);

  // ESTADO ISOLADO DO DRAWER — desacoplado da seleção da Bíblia.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVerses, setDrawerVerses] = useState([]);
  const aiVersesRef = useRef(null);
  const [aiNonce, setAiNonce] = useState(0);

  // Trava o scroll do body enquanto modal mobile está aberto
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (drawerOpen && isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [drawerOpen, isMobile]);

  const [highlightSheetOpen, setHighlightSheetOpen] = useState(false);

  // Compartilhamento — ref para o card off-screen e estado de loading.
  const shareCardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  // Fonte de versículos para o card de compartilhamento:
  // prioriza drawerVerses (painel de estudo aberto), senão selectedVerses da floating bar.
  const getCardVerses = () => (drawerVerses && drawerVerses.length > 0 ? drawerVerses : selectedVerses);

  const handleShare = async () => {
    const verses = getCardVerses();
    if (!verses || verses.length === 0) return;
    setSharing(true);
    try {
      // Respiro técnico: evita 'corrida de processamento' do Chrome Android
      // (insertBefore crash quando state/DOM ainda está estabilizando).
      if (typeof document !== 'undefined' && document.activeElement?.blur) {
        try { document.activeElement.blur(); } catch { /* ignore */ }
      }
      await new Promise((r) => setTimeout(r, 200));
      const res = await shareVerseCard(shareCardRef.current, {
        reference: refLabel,
        title: 'Teologia Viva',
        text: `${refLabel} — Teologia Viva`,
      });
      if (res.method === 'download') toast.success('Imagem baixada');
      else if (res.method === 'share') toast.success('Compartilhado!');
    } catch (e) {
      toast.error(e?.message || 'Falha ao compartilhar');
    } finally {
      setSharing(false);
    }
  };

  const handleSaveImage = async () => {
    const verses = getCardVerses();
    if (!verses || verses.length === 0) return;
    setSharing(true);
    try {
      if (typeof document !== 'undefined' && document.activeElement?.blur) {
        try { document.activeElement.blur(); } catch { /* ignore */ }
      }
      await new Promise((r) => setTimeout(r, 200));
      await saveVerseCard(shareCardRef.current, { reference: refLabel });
      toast.success('Imagem salva na galeria');
    } catch (e) {
      toast.error(e?.message || 'Falha ao salvar imagem');
    } finally {
      setSharing(false);
    }
  };

  // Aliases — mesmos handlers, chamados direto pela barra de seleção (quick actions).
  const handleShareFromSelection = handleShare;
  const handleSaveFromSelection = handleSaveImage;

  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [notes, setNotes] = useState({});
  const [draftObs, setDraftObs] = useState('');
  const [savingObs, setSavingObs] = useState(false);
  const { user, profile } = useAuth();

  const book = useMemo(() => books.find((b) => b.id === bookId) || null, [books, bookId]);

  // Carregar lista de livros para a versão atual
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await listBooks(translationId);
        if (!active) return;
        setBooks(list);
        // Se o livro atual não existe nessa versão, vai para o primeiro
        if (!list.some((b) => b.id === bookId)) {
          setBookId(list[0]?.id || 'jo');
          setChapter(1);
        }
      } catch (e) {
        toast.error('Não foi possível carregar a lista de livros');
      }
    })();
    return () => { active = false; };
  }, [translationId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Carregar capítulo + número total de capítulos do livro
  useEffect(() => {
    let active = true;
    (async () => {
      if (!bookId) return;
      setLoading(true);
      setSelectedVerses([]);
      try {
        const data = await fetchChapter(bookId, chapter, translationId);
        if (!active) return;
        setChapterData(data);
        const cnt = Array.isArray(data?.verses) ? null : 0;
        // chaptersCount: contagem total via getChaptersCount (independente do capítulo atual)
        const totalCh = await getChaptersCount(bookId, translationId);
        if (!active) return;
        setChaptersCount(totalCh);
        // notes (highlights/observações por usuário)
        if (user?.id) {
          const map = await loadChapterNotes({ userId: user.id, bookId, chapter });
          if (active) setNotes(map);
        } else {
          setNotes({});
        }
        try {
          localStorage.setItem(LS_BOOK, bookId);
          localStorage.setItem(LS_CHAPTER, String(chapter));
        } catch { /* ignore */ }
        // suppress unused var warning
        if (cnt) { /* no-op */ }
      } catch (e) {
        if (active) toast.error('Não foi possível carregar o capítulo');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [bookId, chapter, user?.id, translationId]);

  const handleTranslationChange = (newId) => {
    setTranslationId(newId);
    try { localStorage.setItem(LS_TRANSLATION, newId); } catch { /* ignore */ }
  };

  const cycleFontSize = () => {
    const idx = FONT_SIZES.findIndex((f) => f.id === fontSizeId);
    const next = FONT_SIZES[(idx + 1) % FONT_SIZES.length];
    setFontSizeId(next.id);
    try { localStorage.setItem(LS_FONT, next.id); } catch { /* ignore */ }
    toast.success(`Texto: ${next.label}`, { duration: 1200 });
  };

  // Seleção (vista pela barra) — Bíblia
  const selectedNumbers = useMemo(
    () => selectedVerses.map((v) => v.number).sort((a, b) => a - b),
    [selectedVerses],
  );

  // Drawer: trabalha com `drawerVerses` (snapshot independente).
  const drawerNumbers = useMemo(
    () => drawerVerses.map((v) => v.number).sort((a, b) => a - b),
    [drawerVerses],
  );
  const drawerKey = drawerNumbers.join('-') || 'none';
  const isSingleDrawer = drawerVerses.length === 1;
  const singleNote = isSingleDrawer ? notes[drawerVerses[0].number] : null;

  const toggleVerse = (v) => {
    if (suspendList) return;  // ignora toques durante a suspensão de 1s
    setSelectedVerses((prev) => {
      const exists = prev.some((x) => x.number === v.number);
      const next = exists ? prev.filter((x) => x.number !== v.number) : [...prev, v];
      // eslint-disable-next-line no-console
      console.log('[Biblia] toggleVerse', v.number, '→ selectedCount:', next.length);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedVerses([]);
    setDrawerOpen(false);
    setExplanation('');
    setDraftObs('');
  };

  const persistOne = async (verse, patch) => {
    if (!user?.id || !book) return null;
    const row = await upsertVerseNote({
      userId: user.id,
      bookId,
      bookNome: book.nome,
      chapter,
      verse: verse.number,
      verseText: verse.text,
      patch,
    });
    return row;
  };

  const applyToAll = async (patch, successMsg) => {
    if (!user?.id) return;
    // Dentro do drawer: opera sobre drawerVerses; senão (caso barra ainda esteja viva): selectedVerses
    const verses = drawerOpen ? drawerVerses : selectedVerses;
    try {
      const results = await Promise.all(verses.map((v) => persistOne(v, patch)));
      setNotes((m) => {
        const next = { ...m };
        verses.forEach((v, i) => {
          const row = results[i];
          if (row) next[v.number] = row;
          else delete next[v.number];
        });
        return next;
      });
      if (successMsg) toast.success(successMsg);
    } catch (e) {
      toast.error('Falha ao salvar');
    }
  };

  const handleHighlight = async (color) => {
    const verses = drawerOpen ? drawerVerses : selectedVerses;
    const allHave = verses.length > 0 && verses.every((v) => notes[v.number]?.color === color);
    const newColor = allHave ? null : color;
    await applyToAll({ color: newColor }, newColor ? 'Destaque aplicado' : 'Destaque removido');
  };

  const handleFavorito = async (lista) => {
    const verses = drawerOpen ? drawerVerses : selectedVerses;
    const allHave = verses.length > 0 && verses.every((v) => notes[v.number]?.favorito_lista === lista);
    const newLista = allHave ? null : lista;
    await applyToAll(
      { favorito_lista: newLista },
      newLista ? `Salvo em ${lista === 'promessas' ? 'Promessas' : 'Estudos'}` : 'Removido dos favoritos',
    );
  };

  const handleSaveObs = async () => {
    if (!isSingleDrawer) return;
    const verse = drawerVerses[0];
    setSavingObs(true);
    try {
      // Respiro técnico (Chrome Android) — deixa o teclado/reflow se estabilizar
      // antes do UPDATE do Supabase e do subsequente re-render da lista.
      if (typeof document !== 'undefined' && document.activeElement?.blur) {
        try { document.activeElement.blur(); } catch { /* ignore */ }
      }
      await new Promise((r) => setTimeout(r, 200));
      const row = await persistOne(verse, { observacao: draftObs.trim() || null });
      setNotes((m) => {
        const next = { ...m };
        if (row) next[verse.number] = row;
        else delete next[verse.number];
        return next;
      });
      toast.success('Observação salva');
    } catch {
      toast.error('Falha ao salvar');
    } finally {
      setSavingObs(false);
    }
  };

  const buildPrompt = (verses) => {
    if (!verses || verses.length === 0) return '';
    const ordered = [...verses].sort((a, b) => a.number - b.number);
    const refs = ordered.map((v) => `${v.number}`).join(', ');
    const body = ordered.map((v) => `${v.number}. "${v.text}"`).join('\n');
    return (
      `Explique de forma clara, devocional e teologicamente fiel o(s) versículo(s) a seguir em português:\n\n` +
      `Referência: ${book?.nome} ${chapter}:${refs}\n${body}\n\n` +
      `Se houver mais de um versículo, relacione-os entre si. Incentive aplicação prática à vida cristã.`
    );
  };

  // Roda a IA com a lista atual de versículos selecionados, ou com a lista passada (caso a chamada
  // seja imediata após selecionar — para evitar problemas de closure/estado).
  const runAIExplain = async (versesToExplain) => {
    const verses = versesToExplain || selectedVerses;
    if (verses.length === 0) return;
    const check = canUseAI(profile, user?.id);
    if (!check.ok) {
      toast.error(`Limite diário de ${check.limit} consultas atingido. Upgrade para Premium.`);
      return;
    }
    setExplanation('');
    setExplaining(true);
    try {
      const ans = await callCleverTask(buildPrompt(verses));
      incrementAICalls(user?.id);
      setExplanation(ans);
    } catch (e) {
      toast.error('Falha ao consultar a IA');
    } finally {
      setExplaining(false);
    }
  };

  // === DESACOPLAMENTO TOTAL ===
  // Passo 1: snapshot dos versículos selecionados em variável local + ref.
  // Passo 2: limpa selectedVerses (fecha a barra) — encerra a renderização da seleção na lista.
  // Passo 3: setTimeout(100ms) → React respira → setDrawerVerses + setDrawerOpen(true).
  // Passo 4: useEffect dispara IA quando drawer já está aberto (delay 320ms para Vaul terminar).
  // Helper: blur active element + scroll para topo (preventScroll do teclado Android)
  const prepareForModal = () => {
    if (typeof document === 'undefined') return;
    const ae = document.activeElement;
    if (ae && typeof ae.blur === 'function') {
      try { ae.blur(); } catch { /* ignore */ }
    }
    try {
      window.scrollTo({ top: window.scrollY, left: 0, behavior: 'instant' });
    } catch { /* ignore */ }
  };

  const openTutorIA = () => {
    if (selectedVerses.length === 0) return;
    prepareForModal();
    const snapshot = selectedVerses.slice();
    aiVersesRef.current = snapshot;
    setSuspendList(true);
    setSelectedVerses([]);
    setExplanation('');
    setDraftObs('');
    window.setTimeout(() => {
      setDrawerVerses(snapshot);
      if (snapshot.length === 1) setDraftObs(notes[snapshot[0].number]?.observacao || '');
      setDrawerOpen(true);
      setAiNonce((n) => n + 1);
      window.setTimeout(() => setSuspendList(false), 1000);
    }, 100);
  };

  const openStudyMenu = () => {
    if (selectedVerses.length === 0) return;
    prepareForModal();
    const snapshot = selectedVerses.slice();
    setSuspendList(true);
    setSelectedVerses([]);
    setExplanation('');
    setDraftObs('');
    window.setTimeout(() => {
      setDrawerVerses(snapshot);
      if (snapshot.length === 1) setDraftObs(notes[snapshot[0].number]?.observacao || '');
      setDrawerOpen(true);
      window.setTimeout(() => setSuspendList(false), 1000);
    }, 100);
  };

  // useEffect: dispara a IA quando o drawer já está aberto + nonce mudou (após Vaul animar 220ms).
  useEffect(() => {
    if (!drawerOpen) return;
    if (!aiVersesRef.current || aiVersesRef.current.length === 0) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      const verses = aiVersesRef.current;
      aiVersesRef.current = null;
      runAIExplain(verses);
    }, 320);
    return () => { cancelled = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiNonce, drawerOpen]);

  // Limpa drawerVerses quando o drawer fecha — evita resíduos no próximo open.
  useEffect(() => {
    if (drawerOpen) return;
    const t = window.setTimeout(() => {
      setDrawerVerses([]);
      setExplanation('');
      setDraftObs('');
      aiVersesRef.current = null;
    }, 250);
    return () => window.clearTimeout(t);
  }, [drawerOpen]);

  const goPrev = () => {
    if (chapter > 1) { setChapter(chapter - 1); return; }
    const idx = books.findIndex((b) => b.id === bookId);
    if (idx > 0) {
      const prev = books[idx - 1];
      (async () => {
        const total = await getChaptersCount(prev.id, translationId);
        setBookId(prev.id);
        setChapter(total || 1);
      })();
    }
  };
  const goNext = () => {
    if (chapter < chaptersCount) { setChapter(chapter + 1); return; }
    const idx = books.findIndex((b) => b.id === bookId);
    if (idx < books.length - 1) {
      setBookId(books[idx + 1].id);
      setChapter(1);
    }
  };

  const refLabel = useMemo(() => {
    const nums = drawerOpen ? drawerNumbers : selectedNumbers;
    if (nums.length === 0) return '';
    if (nums.length === 1) return `${book?.nome} ${chapter}:${nums[0]}`;
    const parts = [];
    let start = nums[0];
    let prev = start;
    for (let i = 1; i <= nums.length; i++) {
      const n = nums[i];
      if (n === prev + 1) { prev = n; continue; }
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = n; prev = n;
    }
    return `${book?.nome} ${chapter}:${parts.join(', ')}`;
  }, [selectedNumbers, drawerNumbers, drawerOpen, book, chapter]);

  // Painel de estudo — extraído como função para ser reutilizado pelo
  // Modal Fullscreen mobile, pelo Drawer Vaul (desktop estreito) E pela
  // Sidebar desktop lg+. Evita duplicação de código.
  const renderStudyBody = () => (
          <div
            key={`study-${drawerKey}`}
            className="overflow-y-auto px-5 py-4 space-y-5"
            style={{ paddingBottom: '120px' }}
          >
            {/* Destacar */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-2 flex items-center gap-1">
                <Highlighter size={12} /> Destacar {drawerVerses.length > 1 ? `(${drawerVerses.length})` : ''}
              </p>
              <div className="flex gap-2">
                {Object.entries(COLOR_MAP).map(([key, c]) => {
                  const allHave = drawerVerses.length > 0 && drawerVerses.every((v) => notes[v.number]?.color === key);
                  return (
                    <button
                      key={key}
                      data-testid={`highlight-${key}`}
                      onClick={() => handleHighlight(key)}
                      className={`flex-1 h-10 rounded-lg border-2 active:scale-95 ${
                        allHave ? 'ring-2 ring-offset-2 ring-offset-navy-dark' : ''
                      }`}
                      style={{
                        background: c.bg,
                        borderColor: allHave ? c.ring : 'transparent',
                        ...(allHave && { '--tw-ring-color': c.ring }),
                      }}
                      aria-label={c.label}
                    />
                  );
                })}
              </div>
            </section>

            {/* Favoritos */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-2 flex items-center gap-1">
                <Bookmark size={12} /> Favoritar em
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[{ key: 'promessas', label: 'Promessas' }, { key: 'estudos', label: 'Estudos' }].map((f) => {
                  const allHave = drawerVerses.length > 0 && drawerVerses.every((v) => notes[v.number]?.favorito_lista === f.key);
                  return (
                    <button
                      key={f.key}
                      data-testid={`favorito-${f.key}`}
                      onClick={() => handleFavorito(f.key)}
                      className={`h-10 rounded-lg border text-sm font-sans tracking-wide active:scale-[0.98] ${
                        allHave ? 'bg-gold text-navy-dark border-gold font-semibold' : 'border-gold/30 text-foreground/85 hover:border-gold/60'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Observação — somente com seleção única */}
            {isSingleDrawer ? (
              <section>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-2">Observação pessoal</p>
                <Textarea
                  data-testid="verse-obs-input"
                  value={draftObs}
                  onChange={(e) => setDraftObs(e.target.value)}
                  rows={4}
                  placeholder="Escreva sua reflexão sobre este versículo…"
                  className="bg-navy-light/40 border-gold/20 text-foreground resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    data-testid="btn-salvar-obs"
                    onClick={handleSaveObs}
                    disabled={savingObs || draftObs === (singleNote?.observacao || '')}
                    className="flex-1 bg-gold text-navy-dark hover:bg-gold-soft"
                  >
                    {savingObs ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
                    Salvar
                  </Button>
                  {singleNote?.observacao ? (
                    <Button
                      data-testid="btn-excluir-obs"
                      onClick={async () => {
                        setDraftObs('');
                        await persistOne(drawerVerses[0], { observacao: null });
                        setNotes((m) => {
                          const next = { ...m };
                          const n = drawerVerses[0].number;
                          if (next[n]) next[n] = { ...next[n], observacao: null };
                          return next;
                        });
                        toast.success('Observação removida');
                      }}
                      variant="outline"
                      className="border-destructive/40 text-destructive-foreground hover:bg-destructive/20"
                    >
                      <Trash2 size={14} />
                    </Button>
                  ) : null}
                </div>
              </section>
            ) : (
              <section>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-2">Observação pessoal</p>
                <p className="text-xs text-foreground/60 font-sans italic">
                  Observações pessoais são por versículo. Selecione apenas 1 para adicionar uma observação.
                </p>
              </section>
            )}

            {/* Tutor IA */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-2 flex items-center gap-1">
                <Sparkles size={12} /> Tutor IA
              </p>
              <Button
                data-testid="btn-explicar-ia"
                onClick={() => runAIExplain(drawerVerses)}
                disabled={explaining}
                className="w-full bg-gold text-navy-dark hover:bg-gold-soft h-11 active:scale-[0.98]"
              >
                {explaining ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Refletindo…</>
                ) : (
                  <><Sparkles size={16} className="mr-2" /> Explicar com IA</>
                )}
              </Button>
              <ErrorBoundary
                resetKey={drawerKey}
                onRetry={() => runAIExplain(drawerVerses)}
              >
                <div key={`explanation-${drawerKey}`} className="mt-3">
                  <VerseExplanation loading={explaining} text={explanation} />
                </div>
              </ErrorBoundary>
            </section>

            {/* Compartilhar */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-2 flex items-center gap-1">
                <Share2 size={12} /> Compartilhar
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  data-testid="btn-compartilhar"
                  onClick={handleShare}
                  disabled={sharing || drawerVerses.length === 0}
                  className="bg-gold text-navy-dark hover:bg-gold-soft h-11 active:scale-[0.98]"
                >
                  {sharing ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> …</>
                  ) : (
                    <><Share2 size={16} className="mr-2" /> Compartilhar</>
                  )}
                </Button>
                <Button
                  data-testid="btn-salvar-imagem"
                  onClick={handleSaveImage}
                  disabled={sharing || drawerVerses.length === 0}
                  variant="outline"
                  className="border-gold/40 bg-transparent text-foreground hover:bg-gold/15 h-11"
                >
                  <Download size={16} className="mr-2 text-gold" /> Salvar imagem
                </Button>
              </div>
              <p className="text-[11px] text-foreground/55 font-sans mt-2 text-center italic">
                Compartilhe no WhatsApp/Stories ou baixe direto na galeria.
              </p>
            </section>
          </div>
  );

  return (
    <div className="space-y-4 pb-2" data-testid="page-biblia">
      <section>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">Sagrada Escritura</p>
        <h2 className="font-serif text-3xl text-foreground mt-1">Bíblia</h2>
        <div className="gold-divider w-16 mt-1" />
      </section>

      {/* Grid 2-col desktop: reader à esquerda, painel de estudo à direita (sticky).
          Mobile: coluna única + Drawer/Modal (fluxo preservado). */}
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start space-y-4 lg:space-y-0">
        <div className="space-y-4 min-w-0">
      {/* Controles principais STICKY: ficam fixos no topo enquanto rola.
          Sticky relativo ao Layout, que tem header próprio em top-0. Empilhamos abaixo dele. */}
      <div
        className="sticky z-30 -mx-5 px-5 lg:mx-0 lg:px-0 py-3 bg-navy-dark/95 backdrop-blur-md border-b border-gold/10 space-y-2"
        style={{ top: 0 }}
        data-testid="biblia-controls"
      >
        <div className="flex items-center gap-2">
          <select
            data-testid="biblia-translation-select"
            value={translationId}
            onChange={(e) => handleTranslationChange(e.target.value)}
            className="flex-1 h-11 rounded-md bg-navy-light/60 border border-gold/40 text-foreground px-3 text-sm font-sans font-semibold"
          >
            {TRANSLATIONS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <Button
            data-testid="biblia-font-size"
            onClick={cycleFontSize}
            variant="outline"
            className="border-gold/40 bg-navy-light/40 text-gold hover:bg-gold/15 h-11 px-3 shrink-0"
            aria-label="Tamanho do texto"
          >
            <Type size={14} className="mr-1" />
            <span className="text-base font-bold">A</span>
            <span className="text-xs ml-0.5">a</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            data-testid="biblia-book-picker"
            variant="outline"
            onClick={() => setPickerOpen(true)}
            className="flex-1 border-gold/30 bg-navy-light/30 text-foreground hover:bg-navy-light/50 h-11"
          >
            <BookOpen size={16} className="mr-2 text-gold" />
            {book?.nome || '—'} {chapter}
          </Button>
          <Button onClick={goPrev} variant="outline" size="icon" className="border-gold/30 text-gold h-11 w-11 shrink-0" data-testid="biblia-prev"><ChevronLeft size={18} /></Button>
          <Button onClick={goNext} variant="outline" size="icon" className="border-gold/30 text-gold h-11 w-11 shrink-0" data-testid="biblia-next"><ChevronRight size={18} /></Button>
        </div>
      </div>

      <article
        className="parchment rounded-2xl px-6 py-7 shadow-inner pb-24"
        data-testid="biblia-reader"
        // Bíblia INERTE enquanto o drawer estiver aberto NO MOBILE — evita novas interações
        // que poderiam disparar mutações de DOM e causar 'Failed to execute insertBefore'.
        // No desktop (lg+) a sidebar mostra o painel lado a lado; mantemos o reader interativo.
        style={drawerOpen && !isDesktopWide ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
        aria-hidden={drawerOpen && !isDesktopWide ? 'true' : undefined}
      >
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" />
          </div>
        ) : chapterData ? (
          <>
            <h3 className="font-serif text-2xl text-sepia-text mb-4 text-center">
              {book?.nome} <span className="text-gold-muted">{chapter}</span>
            </h3>
            <div className="gold-divider w-12 mx-auto mb-5" />
            <div className={`font-serif text-sepia-text ${fontCls}`}>
              {chapterData.verses.map((v) => {
                const note = notes[v.number];
                const bg = note?.color ? COLOR_MAP[note.color].bg : 'transparent';
                const isFav = !!note?.favorito_lista;
                const isSelected = selectedVerses.some((s) => s.number === v.number);
                const stableKey = `v-${bookId}-${chapter}-${v.number}`;
                return (
                  <button
                    key={stableKey}
                    id={stableKey}
                    data-testid={`verse-${v.number}`}
                    onClick={() => toggleVerse(v)}
                    style={{ background: bg }}
                    className={`text-left inline rounded px-0.5 ${
                      isSelected ? 'ring-2 ring-gold ring-offset-1 ring-offset-transparent bg-gold/25' : ''
                    }`}
                    title={note?.observacao ? 'Com observação' : undefined}
                  >
                    <span className="verse-num">{v.number}</span>
                    <span>{v.text}</span>
                    {isFav ? <Bookmark size={11} className="inline ml-1 -mt-1 text-gold-muted" fill="currentColor" /> : null}
                    {note?.observacao ? <span className="ml-1 text-[10px] align-top text-gold-muted">✎</span> : null}
                    <span> </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] mt-6 text-sepia-ink/60 font-sans text-center">
              {chapterData.translation}
            </p>
          </>
        ) : (
          <p className="text-sepia-ink">Capítulo indisponível.</p>
        )}
      </article>
        </div>

        {/* ── DESKTOP SIDEBAR (30%): Painel de estudo sempre visível ── */}
        <aside className="hidden lg:block">
          <div
            className="sticky top-24 rounded-2xl border border-gold/25 bg-navy-light/20 overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 8rem)', display: 'flex', flexDirection: 'column', contain: 'layout paint' }}
          >
            {drawerOpen && drawerVerses.length > 0 ? (
              <>
                <div className="px-5 py-3 border-b border-gold/15 shrink-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gold/70 font-sans font-semibold">Menu de estudo</p>
                  <p className="font-serif text-lg text-gold truncate">{refLabel}</p>
                </div>
                <div className="px-5 py-3 max-h-[24vh] overflow-y-auto border-b border-gold/10 shrink-0">
                  <div className="text-foreground/90 font-serif italic text-sm leading-relaxed">
                    {drawerVerses
                      .slice()
                      .sort((a, b) => a.number - b.number)
                      .map((v) => (
                        <span key={`dv-side-${v.number}`} className="block">
                          <span className="text-gold-muted text-xs mr-1">{v.number}</span>
                          {v.text}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto" data-testid="study-desktop-sidebar">
                  {renderStudyBody()}
                </div>
              </>
            ) : (
              <div className="p-8 text-center space-y-3">
                <Sparkles size={22} className="mx-auto text-gold/70" />
                <p className="font-serif text-lg text-foreground/85">Selecione um versículo</p>
                <p className="text-xs text-foreground/60 font-sans">
                  Clique em um versículo ao lado para destacar, favoritar, pedir explicação da IA ou compartilhar.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Sheet — escolher livro */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="bg-navy-dark border-gold/20 max-w-md mx-auto h-[80vh] overflow-y-auto z-[120]">
          <SheetHeader><SheetTitle className="font-serif text-2xl text-gold">Escolher livro</SheetTitle></SheetHeader>
          <div className="pb-10 space-y-6 mt-4">
            {[{ label: 'Antigo Testamento', list: books.filter((b) => b.ot) },
              { label: 'Novo Testamento', list: books.filter((b) => !b.ot) }].map((s) => (
              <div key={s.label}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold/70 font-sans font-semibold mb-2">{s.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {s.list.map((b) => (
                    <button
                      key={b.id}
                      data-testid={`pick-book-${b.id}`}
                      onClick={() => { setBookId(b.id); setChapter(1); setPickerOpen(false); setChapterPickerOpen(true); }}
                      className="text-left rounded-lg border border-gold/15 bg-navy-light/30 px-3 py-2 text-sm font-serif text-foreground hover:border-gold/40"
                    >
                      {b.nome}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet — escolher capítulo */}
      <Sheet open={chapterPickerOpen} onOpenChange={setChapterPickerOpen}>
        <SheetContent side="bottom" className="bg-navy-dark border-gold/20 max-w-md mx-auto h-[60vh] overflow-y-auto z-[120]">
          <SheetHeader><SheetTitle className="font-serif text-2xl text-gold">{book?.nome} — Capítulo</SheetTitle></SheetHeader>
          <div className="pb-10 mt-4">
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: chaptersCount || 1 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  data-testid={`pick-chapter-${n}`}
                  onClick={() => { setChapter(n); setChapterPickerOpen(false); }}
                  className={`rounded-lg border h-10 text-sm font-serif transition ${
                    chapter === n ? 'bg-gold text-navy-dark border-gold font-semibold' : 'border-gold/15 bg-navy-light/30 text-foreground hover:border-gold/40'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Barra de ferramentas — SEMPRE MONTADA no DOM. Usa visibility+pointerEvents
          para não sofrer mount/unmount (evita `insertBefore` crash no Chrome Android). */}
      <div
        data-testid="selection-bar"
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: '90px',
          width: 'calc(100% - 24px)',
          maxWidth: '440px',
          background: '#0B1A2C',
          border: '2px solid rgba(212, 175, 55, 0.55)',
          borderRadius: '14px',
          boxShadow: '0 14px 32px rgba(0,0,0,0.7)',
          padding: '10px',
          zIndex: 99999,
          visibility: selectedVerses.length > 0 ? 'visible' : 'hidden',
          opacity: selectedVerses.length > 0 ? 1 : 0,
          pointerEvents: selectedVerses.length > 0 ? 'auto' : 'none',
          transition: 'opacity 120ms ease',
        }}
        aria-hidden={selectedVerses.length === 0}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <button
            onClick={clearSelection}
            data-testid="selection-clear"
            aria-label="Limpar seleção"
            style={{ color: '#E5E7EB', padding: '4px', background: 'transparent', border: 0 }}
          >
            <X size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#D4AF37', fontWeight: 600 }}>
              {selectedVerses.length} versículo{selectedVerses.length > 1 ? 's' : ''}
            </p>
            <p
              style={{ fontSize: '14px', color: '#F5F1E6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'serif' }}
            >
              {refLabel}
            </p>
          </div>
        </div>
        {/* Linha 1: Destacar / Tutor IA / Menu */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
          <button
            data-testid="selection-highlight"
            onClick={() => setHighlightSheetOpen(true)}
            style={{
              background: 'transparent', color: '#F5F1E6', border: '1px solid rgba(212, 175, 55, 0.4)',
              borderRadius: '8px', height: '40px', fontSize: '12px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            }}
          >
            <Highlighter size={14} color="#D4AF37" /> Destacar
          </button>
          <button
            data-testid="selection-tutor-ia"
            onClick={openTutorIA}
            style={{
              background: '#D4AF37', color: '#0B1A2C', border: 0, borderRadius: '8px',
              height: '40px', fontSize: '12px', fontWeight: 700, display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: '4px',
            }}
          >
            <Sparkles size={14} /> Tutor IA
          </button>
          <button
            data-testid="selection-open-study"
            onClick={openStudyMenu}
            style={{
              background: 'transparent', color: '#F5F1E6', border: '1px solid rgba(212, 175, 55, 0.4)',
              borderRadius: '8px', height: '40px', fontSize: '12px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            }}
          >
            <FileText size={14} color="#D4AF37" /> Menu
          </button>
        </div>
        {/* Linha 2: Compartilhar / Salvar Imagem / Observação — SEMPRE visíveis */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          <button
            data-testid="selection-share"
            onClick={handleShareFromSelection}
            disabled={sharing}
            style={{
              background: 'transparent', color: '#F5F1E6', border: '1px solid rgba(212, 175, 55, 0.4)',
              borderRadius: '8px', height: '40px', fontSize: '11px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              opacity: sharing ? 0.5 : 1,
            }}
          >
            <Share2 size={14} color="#D4AF37" /> Compartilhar
          </button>
          <button
            data-testid="selection-save-image"
            onClick={handleSaveFromSelection}
            disabled={sharing}
            style={{
              background: 'transparent', color: '#F5F1E6', border: '1px solid rgba(212, 175, 55, 0.4)',
              borderRadius: '8px', height: '40px', fontSize: '11px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              opacity: sharing ? 0.5 : 1,
            }}
          >
            <Download size={14} color="#D4AF37" /> Salvar
          </button>
          <button
            data-testid="selection-obs"
            onClick={openStudyMenu}
            style={{
              background: 'transparent', color: '#F5F1E6', border: '1px solid rgba(212, 175, 55, 0.4)',
              borderRadius: '8px', height: '40px', fontSize: '11px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            }}
          >
            <Save size={14} color="#D4AF37" /> Observação
          </button>
        </div>
      </div>

      {/* Sheet rápido de cores para "Destacar" — usa drawerVerses se drawer aberto, senão selectedVerses */}
      <Sheet open={highlightSheetOpen} onOpenChange={setHighlightSheetOpen}>
        <SheetContent side="bottom" className="bg-navy-dark border-gold/20 max-w-md mx-auto z-[210]">
          <SheetHeader>
            <SheetTitle className="font-serif text-xl text-gold flex items-center gap-2">
              <Highlighter size={16} /> Destacar versículos
            </SheetTitle>
          </SheetHeader>
          <div className="px-2 py-4 space-y-3">
            {(() => {
              const verses = drawerOpen ? drawerVerses : selectedVerses;
              return (
                <>
                  <p className="text-xs text-foreground/70 font-sans">
                    Aplica a cor escolhida em {verses.length} versículo{verses.length > 1 ? 's' : ''} selecionado{verses.length > 1 ? 's' : ''}.
                  </p>
                  <div className="flex gap-2">
                    {Object.entries(COLOR_MAP).map(([key, c]) => {
                      const allHave = verses.length > 0 && verses.every((v) => notes[v.number]?.color === key);
                      return (
                        <button
                          key={key}
                          data-testid={`quick-highlight-${key}`}
                          onClick={async () => {
                            await handleHighlight(key);
                            setHighlightSheetOpen(false);
                          }}
                          className={`flex-1 h-12 rounded-lg border-2 active:scale-95 ${
                            allHave ? 'ring-2 ring-offset-2 ring-offset-navy-dark' : ''
                          }`}
                          style={{
                            background: c.bg,
                            borderColor: allHave ? c.ring : 'transparent',
                            ...(allHave && { '--tw-ring-color': c.ring }),
                          }}
                          aria-label={c.label}
                        />
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>

      {/* CONTEÚDO DE ESTUDO — renderizado em Drawer (desktop estreito),
          Modal Fullscreen (mobile/touch) ou Sidebar lateral (desktop lg+). */}
      {(() => {
        if (isDesktopWide) return null;  // lg: a sidebar acima já mostra o mesmo conteúdo
        const studyBody = renderStudyBody();

        // === MOBILE: Modal fullscreen SEMPRE MONTADO (visibility toggle).
        // Evita mount/unmount → elimina insertBefore crash no Chrome Android. ===
        if (isMobile) {
          return (
            <div
              key={`mobile-modal-${drawerKey}`}
              data-testid="study-mobile-modal"
              role="dialog"
              aria-modal={drawerOpen ? 'true' : 'false'}
              aria-hidden={drawerOpen ? 'false' : 'true'}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99998,
                background: '#0B1A2C',
                display: 'flex',
                flexDirection: 'column',
                visibility: drawerOpen ? 'visible' : 'hidden',
                pointerEvents: drawerOpen ? 'auto' : 'none',
              }}
            >
              {/* Header com botão fechar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gold/15">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gold/70 font-sans font-semibold">Menu de estudo</p>
                  <p className="font-serif text-lg text-gold truncate">{refLabel}</p>
                </div>
                <button
                  type="button"
                  data-testid="study-mobile-close"
                  onClick={() => setDrawerOpen(false)}
                  className="ml-3 w-10 h-10 rounded-full border border-gold/30 text-foreground hover:bg-gold/10 flex items-center justify-center"
                  aria-label="Fechar"
                >
                  <X size={20} />
                </button>
              </div>
              {/* Versículos */}
              <div className="px-5 py-3 max-h-[28vh] overflow-y-auto border-b border-gold/10">
                <div className="text-foreground/90 font-serif italic text-base leading-relaxed">
                  {drawerVerses
                    .slice()
                    .sort((a, b) => a.number - b.number)
                    .map((v) => (
                      <span key={`mv-${v.number}`} className="block">
                        <span className="text-gold-muted text-xs mr-1">{v.number}</span>
                        {v.text}
                      </span>
                    ))}
                </div>
              </div>
              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                {studyBody}
              </div>
            </div>
          );
        }

        // === DESKTOP: Drawer Vaul tradicional ===
        return (
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerContent
              key={`drawer-${drawerKey}`}
              className="bg-navy-dark border-gold/20 max-w-md mx-auto z-[220] max-h-[92vh]"
            >
              <DrawerHeader className="border-b border-gold/10 pb-3">
                <DrawerTitle className="font-serif text-xl text-gold" data-testid="drawer-ref">
                  {refLabel}
                </DrawerTitle>
                <DrawerDescription className="text-foreground/85 font-serif italic text-base leading-relaxed pt-2 max-h-32 overflow-y-auto">
                  {drawerVerses
                    .slice()
                    .sort((a, b) => a.number - b.number)
                    .map((v) => (
                      <span key={`dv-${v.number}`} className="block">
                        <span className="text-gold-muted text-xs mr-1">{v.number}</span>
                        {v.text}
                      </span>
                    ))}
                </DrawerDescription>
              </DrawerHeader>
              {studyBody}
            </DrawerContent>
          </Drawer>
        );
      })()}

      {/* Card off-screen para gerar PNG via html-to-image (não interativo) */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-99999px',
          top: 0,
          pointerEvents: 'none',
          opacity: 0,
        }}
      >
        <div ref={shareCardRef}>
          <ShareVerseCard
            verses={getCardVerses()}
            reference={refLabel}
            translation={chapterData?.translation}
          />
        </div>
      </div>
    </div>
  );
}
