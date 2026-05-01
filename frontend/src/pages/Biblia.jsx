import { useEffect, useMemo, useState } from 'react';
import { BOOKS, fetchChapter } from '../lib/bible';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '../components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import {
  Sparkles, Loader2, ChevronLeft, ChevronRight, BookOpen,
  Bookmark, Highlighter, Save, Trash2, X, FileText,
} from 'lucide-react';
import { callCleverTask } from '../lib/ai';
import { useAuth } from '../contexts/AuthContext';
import { canUseAI, incrementAICalls } from '../lib/plan';
import { loadChapterNotes, upsertVerseNote, COLOR_MAP } from '../lib/bibleNotes';
import VerseExplanation from '../components/VerseExplanation';
import ErrorBoundary from '../components/ErrorBoundary';
import { toast } from 'sonner';

export default function Biblia() {
  const [bookId, setBookId] = useState('joao');
  const [chapter, setChapter] = useState(3);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [chapterData, setChapterData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Seleção múltipla
  const [selectedVerses, setSelectedVerses] = useState([]); // [{number, text}, ...]
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [notes, setNotes] = useState({}); // verse → row
  const [draftObs, setDraftObs] = useState('');
  const [savingObs, setSavingObs] = useState(false);
  const { user, profile } = useAuth();

  const book = useMemo(() => BOOKS.find((b) => b.id === bookId), [bookId]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setSelectedVerses([]);
      try {
        const data = await fetchChapter(bookId, chapter);
        if (!active) return;
        setChapterData(data);
        if (user?.id) {
          const map = await loadChapterNotes({ userId: user.id, bookId, chapter });
          if (active) setNotes(map);
        } else {
          setNotes({});
        }
      } catch (e) {
        if (active) toast.error('Não foi possível carregar o capítulo');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [bookId, chapter, user?.id]);

  // Número(s) selecionado(s) ordenado(s)
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
      if (exists) return prev.filter((x) => x.number !== v.number);
      return [...prev, v];
    });
  };

  const clearSelection = () => {
    setSelectedVerses([]);
    setDrawerOpen(false);
    setExplanation('');
    setDraftObs('');
  };

  const openStudyMenu = () => {
    if (selectedVerses.length === 0) return;
    setExplanation('');
    if (isSingle) {
      setDraftObs(notes[selectedVerses[0].number]?.observacao || '');
    } else {
      setDraftObs('');
    }
    setDrawerOpen(true);
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
    // Toggle: se TODOS selecionados já têm essa cor, remove. Caso contrário, aplica.
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
    if (!isSingle) return; // observação pessoal só para versículo único
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

  const buildPrompt = () => {
    if (selectedVerses.length === 0) return '';
    const ordered = [...selectedVerses].sort((a, b) => a.number - b.number);
    const refs = ordered.map((v) => `${v.number}`).join(', ');
    const body = ordered.map((v) => `${v.number}. "${v.text}"`).join('\n');
    return (
      `Explique de forma clara, devocional e teologicamente fiel o(s) versículo(s) a seguir em português:\n\n` +
      `Referência: ${book?.nome} ${chapter}:${refs}\n${body}\n\n` +
      `Se houver mais de um versículo, relacione-os entre si. Incentive aplicação prática à vida cristã.`
    );
  };

  const handleExplain = async () => {
    if (selectedVerses.length === 0) return;
    const check = canUseAI(profile, user?.id);
    if (!check.ok) {
      toast.error(`Limite diário de ${check.limit} consultas atingido. Upgrade para Premium.`);
      return;
    }
    setExplanation('');
    setExplaining(true);
    try {
      const ans = await callCleverTask(buildPrompt());
      incrementAICalls(user?.id);
      setExplanation(ans);
    } catch (e) {
      toast.error('Falha ao consultar a IA');
    } finally {
      setExplaining(false);
    }
  };

  const goPrev = () => {
    if (chapter > 1) setChapter(chapter - 1);
    else {
      const idx = BOOKS.findIndex((b) => b.id === bookId);
      if (idx > 0) { setBookId(BOOKS[idx - 1].id); setChapter(BOOKS[idx - 1].chapters); }
    }
  };
  const goNext = () => {
    if (book && chapter < book.chapters) setChapter(chapter + 1);
    else {
      const idx = BOOKS.findIndex((b) => b.id === bookId);
      if (idx < BOOKS.length - 1) { setBookId(BOOKS[idx + 1].id); setChapter(1); }
    }
  };

  const refLabel = useMemo(() => {
    if (selectedNumbers.length === 0) return '';
    if (selectedNumbers.length === 1) return `${book?.nome} ${chapter}:${selectedNumbers[0]}`;
    // Range compacto: 1,2,3,5 → "1-3, 5"
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
    <div className="space-y-5" data-testid="page-biblia">
      <section>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">Sagrada Escritura</p>
        <h2 className="font-serif text-3xl text-foreground mt-1">Bíblia</h2>
        <div className="gold-divider w-16 mt-1" />
      </section>

      <div className="flex items-center gap-2">
        <Button data-testid="biblia-book-picker" variant="outline" onClick={() => setPickerOpen(true)}
          className="flex-1 border-gold/30 bg-navy-light/30 text-foreground hover:bg-navy-light/50">
          <BookOpen size={16} className="mr-2 text-gold" />
          {book?.nome} {chapter}
        </Button>
        <Button onClick={goPrev} variant="outline" size="icon" className="border-gold/30 text-gold" data-testid="biblia-prev"><ChevronLeft size={18} /></Button>
        <Button onClick={goNext} variant="outline" size="icon" className="border-gold/30 text-gold" data-testid="biblia-next"><ChevronRight size={18} /></Button>
      </div>

      {selectedVerses.length > 0 ? (
        <p className="text-[11px] text-gold/70 font-sans text-center">
          Toque em versículos para selecionar. Toque de novo para desmarcar.
        </p>
      ) : null}

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
            <div className="font-serif text-[19px] leading-loose text-sepia-text">
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

      {/* Book / Chapter pickers */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="bg-navy-dark border-gold/20 max-w-md mx-auto h-[80vh] overflow-y-auto z-[120]">
          <SheetHeader><SheetTitle className="font-serif text-2xl text-gold">Escolher livro</SheetTitle></SheetHeader>
          <div className="pb-10 space-y-6 mt-4">
            {[{ label: 'Antigo Testamento', list: BOOKS.filter((b) => b.ot) }, { label: 'Novo Testamento', list: BOOKS.filter((b) => !b.ot) }].map((s) => (
              <div key={s.label}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold/70 font-sans font-semibold mb-2">{s.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {s.list.map((b) => (
                    <button key={b.id} data-testid={`pick-book-${b.id}`}
                      onClick={() => { setBookId(b.id); setChapter(1); setPickerOpen(false); setChapterPickerOpen(true); }}
                      className="text-left rounded-lg border border-gold/15 bg-navy-light/30 px-3 py-2 text-sm font-serif text-foreground hover:border-gold/40">
                      {b.nome}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={chapterPickerOpen} onOpenChange={setChapterPickerOpen}>
        <SheetContent side="bottom" className="bg-navy-dark border-gold/20 max-w-md mx-auto h-[60vh] overflow-y-auto z-[120]">
          <SheetHeader><SheetTitle className="font-serif text-2xl text-gold">{book?.nome} — Capítulo</SheetTitle></SheetHeader>
          <div className="pb-10 mt-4">
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: book?.chapters || 1 }, (_, i) => i + 1).map((n) => (
                <button key={n} data-testid={`pick-chapter-${n}`}
                  onClick={() => { setChapter(n); setChapterPickerOpen(false); }}
                  className={`rounded-lg border h-10 text-sm font-serif transition ${
                    chapter === n ? 'bg-gold text-navy-dark border-gold font-semibold' : 'border-gold/15 bg-navy-light/30 text-foreground hover:border-gold/40'
                  }`}>{n}</button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Barra de ação flutuante para seleção múltipla */}
      {selectedVerses.length > 0 ? (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-[88px] z-[115] w-[92%] max-w-md"
          data-testid="selection-bar"
        >
          <div className="rounded-2xl border border-gold/30 bg-navy-dark/95 backdrop-blur px-4 py-3 shadow-xl flex items-center gap-3">
            <button
              onClick={clearSelection}
              data-testid="selection-clear"
              className="text-foreground/70 hover:text-foreground shrink-0"
              aria-label="Limpar seleção"
            >
              <X size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/70 font-sans font-semibold">
                {selectedVerses.length} versículo{selectedVerses.length > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-foreground truncate font-serif">{refLabel}</p>
            </div>
            <Button
              data-testid="selection-open-study"
              onClick={openStudyMenu}
              className="bg-gold text-navy-dark hover:bg-gold-soft h-10 shrink-0"
            >
              <FileText size={14} className="mr-1" /> Menu de estudo
            </Button>
          </div>
        </div>
      ) : null}

      {/* Study drawer — com múltiplos versículos */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-navy-dark border-gold/20 max-w-md mx-auto z-[120] max-h-[92vh]">
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

            {/* Explicar com IA — isolado por ErrorBoundary e key de seleção */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-2 flex items-center gap-1">
                <Sparkles size={12} /> Tutor IA
              </p>
              <Button
                data-testid="btn-explicar-ia"
                onClick={handleExplain}
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
