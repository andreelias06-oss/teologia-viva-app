import { useEffect, useMemo, useState } from 'react';
import { BOOKS, fetchChapter } from '../lib/bible';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '../components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import { Sparkles, Loader2, ChevronLeft, ChevronRight, BookOpen, Bookmark, Highlighter, Save, Trash2 } from 'lucide-react';
import { callCleverTask } from '../lib/ai';
import { useAuth } from '../contexts/AuthContext';
import { canUseAI, incrementAICalls } from '../lib/plan';
import { loadChapterNotes, upsertVerseNote, COLOR_MAP } from '../lib/bibleNotes';
import { toast } from 'sonner';

export default function Biblia() {
  const [bookId, setBookId] = useState('joao');
  const [chapter, setChapter] = useState(3);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [chapterData, setChapterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVerse, setSelectedVerse] = useState(null);
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
      try {
        const data = await fetchChapter(bookId, chapter);
        if (active) setChapterData(data);
        if (user?.id) {
          const map = await loadChapterNotes({ userId: user.id, bookId, chapter });
          if (active) setNotes(map);
        } else if (active) {
          setNotes({});
        }
      } catch (e) {
        toast.error('Não foi possível carregar o capítulo');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [bookId, chapter, user?.id]);

  const currentNote = selectedVerse ? notes[selectedVerse.number] : null;

  const onVerseClick = (v) => {
    setSelectedVerse(v);
    setExplanation('');
    setDraftObs(notes[v.number]?.observacao || '');
    setDrawerOpen(true);
  };

  const persist = async (patch) => {
    if (!user?.id || !selectedVerse || !book) return;
    try {
      const row = await upsertVerseNote({
        userId: user.id,
        bookId,
        bookNome: book.nome,
        chapter,
        verse: selectedVerse.number,
        verseText: selectedVerse.text,
        patch,
      });
      setNotes((m) => {
        const next = { ...m };
        if (row) next[selectedVerse.number] = row;
        else delete next[selectedVerse.number];
        return next;
      });
      return row;
    } catch (e) {
      toast.error('Falha ao salvar');
    }
  };

  const handleHighlight = async (color) => {
    const newColor = currentNote?.color === color ? null : color;
    await persist({ color: newColor });
    toast.success(newColor ? 'Destaque salvo' : 'Destaque removido');
  };

  const handleFavorito = async (lista) => {
    const newLista = currentNote?.favorito_lista === lista ? null : lista;
    await persist({ favorito_lista: newLista });
    toast.success(newLista ? `Salvo em ${lista === 'promessas' ? 'Promessas' : 'Estudos'}` : 'Removido dos favoritos');
  };

  const handleSaveObs = async () => {
    setSavingObs(true);
    await persist({ observacao: draftObs.trim() || null });
    setSavingObs(false);
    toast.success('Observação salva');
  };

  const handleExplain = async () => {
    if (!selectedVerse) return;
    const check = canUseAI(profile, user?.id);
    if (!check.ok) {
      toast.error(`Limite diário de ${check.limit} consultas atingido. Upgrade para Premium.`);
      return;
    }
    setExplaining(true);
    setExplanation('');
    try {
      const prompt = `Explique de forma clara, devocional e teologicamente fiel o seguinte versículo bíblico em português:\n\nReferência: ${book?.nome} ${chapter}:${selectedVerse.number}\nTexto: "${selectedVerse.text}"\n\nIncentive aplicação prática à vida cristã.`;
      const ans = await callCleverTask(prompt);
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

      <article className="parchment rounded-2xl px-6 py-7 shadow-inner" data-testid="biblia-reader">
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
                return (
                  <button
                    key={v.number}
                    data-testid={`verse-${v.number}`}
                    onClick={() => onVerseClick(v)}
                    style={{ background: bg }}
                    className="text-left inline rounded px-0.5 transition hover:bg-gold/15 active:bg-gold/25"
                    title={note?.observacao ? 'Com observação' : undefined}
                  >
                    <span className="verse-num">{v.number}</span>
                    <span>{v.text}</span>
                    {isFav && <Bookmark size={11} className="inline ml-1 -mt-1 text-gold-muted" fill="currentColor" />}
                    {note?.observacao && <span className="ml-1 text-[10px] align-top text-gold-muted">✎</span>}
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

      {/* Verse Study drawer — scrollable content + extra bottom padding to clear nav + Emergent badge */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-navy-dark border-gold/20 max-w-md mx-auto z-[120] max-h-[92vh]">
          <DrawerHeader className="border-b border-gold/10 pb-3">
            <DrawerTitle className="font-serif text-xl text-gold">
              {book?.nome} {chapter}:{selectedVerse?.number}
            </DrawerTitle>
            <DrawerDescription className="text-foreground/85 font-serif italic text-base leading-relaxed pt-2">
              "{selectedVerse?.text}"
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto px-5 py-4 space-y-5" style={{ paddingBottom: '120px' }}>
            {/* Section: Destacar */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-2 flex items-center gap-1">
                <Highlighter size={12} /> Destacar
              </p>
              <div className="flex gap-2">
                {Object.entries(COLOR_MAP).map(([key, c]) => (
                  <button
                    key={key}
                    data-testid={`highlight-${key}`}
                    onClick={() => handleHighlight(key)}
                    className={`flex-1 h-10 rounded-lg border-2 transition active:scale-95 ${
                      currentNote?.color === key ? 'ring-2 ring-offset-2 ring-offset-navy-dark' : ''
                    }`}
                    style={{
                      background: c.bg,
                      borderColor: currentNote?.color === key ? c.ring : 'transparent',
                      ...(currentNote?.color === key && { '--tw-ring-color': c.ring }),
                    }}
                    aria-label={c.label}
                  />
                ))}
              </div>
            </section>

            {/* Section: Favoritos */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-2 flex items-center gap-1">
                <Bookmark size={12} /> Favoritar em
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[{ key: 'promessas', label: 'Promessas' }, { key: 'estudos', label: 'Estudos' }].map((f) => {
                  const active = currentNote?.favorito_lista === f.key;
                  return (
                    <button
                      key={f.key}
                      data-testid={`favorito-${f.key}`}
                      onClick={() => handleFavorito(f.key)}
                      className={`h-10 rounded-lg border text-sm font-sans tracking-wide transition active:scale-[0.98] ${
                        active ? 'bg-gold text-navy-dark border-gold font-semibold' : 'border-gold/30 text-foreground/85 hover:border-gold/60'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Section: Observação */}
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
                  disabled={savingObs || draftObs === (currentNote?.observacao || '')}
                  className="flex-1 bg-gold text-navy-dark hover:bg-gold-soft"
                >
                  {savingObs ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
                  Salvar
                </Button>
                {currentNote?.observacao && (
                  <Button
                    data-testid="btn-excluir-obs"
                    onClick={async () => { setDraftObs(''); await persist({ observacao: null }); toast.success('Observação removida'); }}
                    variant="outline"
                    className="border-destructive/40 text-destructive-foreground hover:bg-destructive/20"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </section>

            {/* Section: Explicar com IA — INLINE, aparece logo abaixo do versículo (não depende de footer) */}
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
                {explaining ? <><Loader2 size={16} className="mr-2 animate-spin" /> Refletindo…</> : <><Sparkles size={16} className="mr-2" /> Explicar com IA</>}
              </Button>
              {explanation && (
                <div className="mt-3 rounded-xl border border-gold/15 bg-navy-light/40 p-4">
                  <p
                    className="text-foreground/90 font-sans whitespace-pre-wrap leading-relaxed text-sm"
                    data-testid="verse-explanation"
                  >{explanation}</p>
                </div>
              )}
            </section>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
