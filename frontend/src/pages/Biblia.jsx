import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchChapter, listBooks, getChaptersCount, TRANSLATIONS, DEFAULT_TRANSLATION } from '../lib/bible';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '../components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import {
  Sparkles, Loader2, ChevronLeft, ChevronRight, BookOpen,
  Bookmark, Highlighter, Save, Trash2, X, FileText, Type,
} from 'lucide-react';
import { callCleverTask } from '../lib/ai';
import { useAuth } from '../contexts/AuthContext';
import { canUseAI, incrementAICalls } from '../lib/plan';
import { loadChapterNotes, upsertVerseNote, COLOR_MAP } from '../lib/bibleNotes';
import VerseExplanation from '../components/VerseExplanation';
import ErrorBoundary from '../components/ErrorBoundary';
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

  // Seleção múltipla
  const [selectedVerses, setSelectedVerses] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [highlightSheetOpen, setHighlightSheetOpen] = useState(false);

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

  // Seleção
  const selectedNumbers = useMemo(
    () => selectedVerses.map((v) => v.number).sort((a, b) => a - b),
    [selectedVerses],
  );
  const selectionKey = selectedNumbers.join('-') || 'none';
  const isSingle = selectedVerses.length === 1;
  const singleNote = isSingle ? notes[selectedVerses[0].number] : null;

  const toggleVerse = (v) => {
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
    try {
      const results = await Promise.all(selectedVerses.map((v) => persistOne(v, patch)));
      setNotes((m) => {
        const next = { ...m };
        selectedVerses.forEach((v, i) => {
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
    const allHave = selectedVerses.length > 0 && selectedVerses.every((v) => notes[v.number]?.color === color);
    const newColor = allHave ? null : color;
    await applyToAll({ color: newColor }, newColor ? 'Destaque aplicado' : 'Destaque removido');
  };

  const handleFavorito = async (lista) => {
    const allHave = selectedVerses.length > 0 && selectedVerses.every((v) => notes[v.number]?.favorito_lista === lista);
    const newLista = allHave ? null : lista;
    await applyToAll(
      { favorito_lista: newLista },
      newLista ? `Salvo em ${lista === 'promessas' ? 'Promessas' : 'Estudos'}` : 'Removido dos favoritos',
    );
  };

  const handleSaveObs = async () => {
    if (!isSingle) return;
    setSavingObs(true);
    try {
      const row = await persistOne(selectedVerses[0], { observacao: draftObs.trim() || null });
      setNotes((m) => {
        const next = { ...m };
        if (row) next[selectedVerses[0].number] = row;
        else delete next[selectedVerses[0].number];
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

  // Tutor IA da barra flutuante: abre o drawer + dispara IA com os textos selecionados.
  // Captura o snapshot dos versículos para evitar staleness do closure.
  const openTutorIA = () => {
    if (selectedVerses.length === 0) return;
    const versesNow = selectedVerses.slice();
    if (versesNow.length === 1) setDraftObs(notes[versesNow[0].number]?.observacao || '');
    else setDraftObs('');
    setExplanation('');
    setDrawerOpen(true);
    runAIExplain(versesNow);
  };

  // Abre o drawer (Menu de estudo) sem disparar a IA automaticamente
  const openStudyMenu = () => {
    if (selectedVerses.length === 0) return;
    setExplanation('');
    if (isSingle) setDraftObs(notes[selectedVerses[0].number]?.observacao || '');
    else setDraftObs('');
    setDrawerOpen(true);
  };

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
    if (selectedNumbers.length === 0) return '';
    if (selectedNumbers.length === 1) return `${book?.nome} ${chapter}:${selectedNumbers[0]}`;
    const parts = [];
    let start = selectedNumbers[0];
    let prev = start;
    for (let i = 1; i <= selectedNumbers.length; i++) {
      const n = selectedNumbers[i];
      if (n === prev + 1) { prev = n; continue; }
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = n; prev = n;
    }
    return `${book?.nome} ${chapter}:${parts.join(', ')}`;
  }, [selectedNumbers, book, chapter]);

  return (
    <div className="space-y-4 pb-2" data-testid="page-biblia">
      <section>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">Sagrada Escritura</p>
        <h2 className="font-serif text-3xl text-foreground mt-1">Bíblia</h2>
        <div className="gold-divider w-16 mt-1" />
      </section>

      {/* Controles principais STICKY: ficam fixos no topo enquanto rola.
          Sticky relativo ao Layout, que tem header próprio em top-0. Empilhamos abaixo dele. */}
      <div
        className="sticky z-30 -mx-5 px-5 py-3 bg-navy-dark/95 backdrop-blur-md border-b border-gold/10 space-y-2"
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

      <article className="parchment rounded-2xl px-6 py-7 shadow-inner pb-24" data-testid="biblia-reader">
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
                return (
                  <button
                    key={v.number}
                    data-testid={`verse-${v.number}`}
                    onClick={() => toggleVerse(v)}
                    style={{ background: bg }}
                    className={`text-left inline rounded px-0.5 transition hover:bg-gold/15 active:bg-gold/25 ${
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

      {/* Barra de ação flutuante — fundo sólido para garantir visibilidade em todos os dispositivos.
          Renderizada como Portal no <body> para evitar bug do containing block do animate-fade-up
          (transform no ancestral faz position:fixed virar position:absolute). */}
      {selectedVerses.length > 0 && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed left-1/2 -translate-x-1/2 w-[94%] max-w-md"
              style={{
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)',
                zIndex: 9999,
                background: '#1A1A1A',
                borderRadius: '16px',
                border: '2px solid rgba(212, 175, 55, 0.55)',
                boxShadow: '0 18px 38px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(212, 175, 55, 0.15)',
                padding: '12px',
              }}
              data-testid="selection-bar"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={clearSelection}
                    data-testid="selection-clear"
                    className="text-foreground/70 hover:text-foreground shrink-0"
                    aria-label="Limpar seleção"
                    style={{ padding: '4px' }}
                  >
                    <X size={18} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">
                      {selectedVerses.length} versículo{selectedVerses.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-foreground truncate font-serif">{refLabel}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    data-testid="selection-highlight"
                    onClick={() => setHighlightSheetOpen(true)}
                    variant="outline"
                    className="border-gold/40 bg-transparent text-foreground hover:bg-gold/15 h-10 text-xs font-sans"
                  >
                    <Highlighter size={14} className="mr-1 text-gold" /> Destacar
                  </Button>
                  <Button
                    data-testid="selection-tutor-ia"
                    onClick={openTutorIA}
                    className="bg-gold text-navy-dark hover:bg-gold-soft h-10 text-xs font-sans font-semibold"
                  >
                    <Sparkles size={14} className="mr-1" /> Tutor IA
                  </Button>
                  <Button
                    data-testid="selection-open-study"
                    onClick={openStudyMenu}
                    variant="outline"
                    className="border-gold/40 bg-transparent text-foreground hover:bg-gold/15 h-10 text-xs font-sans"
                  >
                    <FileText size={14} className="mr-1 text-gold" /> Menu
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Sheet rápido de cores para "Destacar" da barra flutuante */}
      <Sheet open={highlightSheetOpen} onOpenChange={setHighlightSheetOpen}>
        <SheetContent side="bottom" className="bg-navy-dark border-gold/20 max-w-md mx-auto z-[210]">
          <SheetHeader>
            <SheetTitle className="font-serif text-xl text-gold flex items-center gap-2">
              <Highlighter size={16} /> Destacar versículos
            </SheetTitle>
          </SheetHeader>
          <div className="px-2 py-4 space-y-3">
            <p className="text-xs text-foreground/70 font-sans">
              Aplica a cor escolhida em {selectedVerses.length} versículo{selectedVerses.length > 1 ? 's' : ''} selecionado{selectedVerses.length > 1 ? 's' : ''}.
            </p>
            <div className="flex gap-2">
              {Object.entries(COLOR_MAP).map(([key, c]) => {
                const allHave = selectedVerses.length > 0 && selectedVerses.every((v) => notes[v.number]?.color === key);
                return (
                  <button
                    key={key}
                    data-testid={`quick-highlight-${key}`}
                    onClick={async () => {
                      await handleHighlight(key);
                      setHighlightSheetOpen(false);
                    }}
                    className={`flex-1 h-12 rounded-lg border-2 transition active:scale-95 ${
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
          </div>
        </SheetContent>
      </Sheet>

      {/* Drawer — Menu de estudo completo */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-navy-dark border-gold/20 max-w-md mx-auto z-[220] max-h-[92vh]">
          <DrawerHeader className="border-b border-gold/10 pb-3">
            <DrawerTitle className="font-serif text-xl text-gold" data-testid="drawer-ref">
              {refLabel}
            </DrawerTitle>
            <DrawerDescription className="text-foreground/85 font-serif italic text-base leading-relaxed pt-2 max-h-32 overflow-y-auto">
              {selectedVerses
                .slice()
                .sort((a, b) => a.number - b.number)
                .map((v) => (
                  <span key={v.number} className="block">
                    <span className="text-gold-muted text-xs mr-1">{v.number}</span>
                    {v.text}
                  </span>
                ))}
            </DrawerDescription>
          </DrawerHeader>

          <div
            key={`study-${selectionKey}`}
            className="overflow-y-auto px-5 py-4 space-y-5"
            style={{ paddingBottom: '120px' }}
          >
            {/* Destacar */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-2 flex items-center gap-1">
                <Highlighter size={12} /> Destacar {selectedVerses.length > 1 ? `(${selectedVerses.length})` : ''}
              </p>
              <div className="flex gap-2">
                {Object.entries(COLOR_MAP).map(([key, c]) => {
                  const allHave = selectedVerses.length > 0 && selectedVerses.every((v) => notes[v.number]?.color === key);
                  return (
                    <button
                      key={key}
                      data-testid={`highlight-${key}`}
                      onClick={() => handleHighlight(key)}
                      className={`flex-1 h-10 rounded-lg border-2 transition active:scale-95 ${
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
                  const allHave = selectedVerses.length > 0 && selectedVerses.every((v) => notes[v.number]?.favorito_lista === f.key);
                  return (
                    <button
                      key={f.key}
                      data-testid={`favorito-${f.key}`}
                      onClick={() => handleFavorito(f.key)}
                      className={`h-10 rounded-lg border text-sm font-sans tracking-wide transition active:scale-[0.98] ${
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
            {isSingle ? (
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
                        await persistOne(selectedVerses[0], { observacao: null });
                        setNotes((m) => {
                          const next = { ...m };
                          const n = selectedVerses[0].number;
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
                onClick={() => runAIExplain()}
                disabled={explaining}
                className="w-full bg-gold text-navy-dark hover:bg-gold-soft h-11 active:scale-[0.98]"
              >
                {explaining ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Refletindo…</>
                ) : (
                  <><Sparkles size={16} className="mr-2" /> Explicar com IA</>
                )}
              </Button>
              <ErrorBoundary resetKey={selectionKey}>
                <div key={`explanation-${selectionKey}`} className="mt-3">
                  <VerseExplanation loading={explaining} text={explanation} />
                </div>
              </ErrorBoundary>
            </section>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
