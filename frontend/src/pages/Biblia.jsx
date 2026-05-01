import { useEffect, useMemo, useState } from 'react';
import { BOOKS, fetchChapter } from '../lib/bible';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '../components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Sparkles, Loader2, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { callCleverTask } from '../lib/ai';
import { useAuth } from '../contexts/AuthContext';
import { canUseAI, incrementAICalls } from '../lib/plan';
import { toast } from 'sonner';

export default function Biblia() {
  const [bookId, setBookId] = useState('joao');
  const [chapter, setChapter] = useState(3);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [chapterData, setChapterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVerse, setSelectedVerse] = useState(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState('');
  const { user, profile } = useAuth();

  const book = useMemo(() => BOOKS.find((b) => b.id === bookId), [bookId]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchChapter(bookId, chapter);
        if (active) setChapterData(data);
      } catch (e) {
        toast.error('Não foi possível carregar o capítulo');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [bookId, chapter]);

  const onVerseClick = (v) => {
    setSelectedVerse(v);
    setExplanation('');
    setExplainOpen(true);
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
      toast.error('Falha ao consultar a IA. Verifique a Edge Function e tente novamente.');
    } finally {
      setExplaining(false);
    }
  };

  const goPrev = () => {
    if (chapter > 1) setChapter(chapter - 1);
    else {
      const idx = BOOKS.findIndex((b) => b.id === bookId);
      if (idx > 0) {
        setBookId(BOOKS[idx - 1].id);
        setChapter(BOOKS[idx - 1].chapters);
      }
    }
  };
  const goNext = () => {
    if (book && chapter < book.chapters) setChapter(chapter + 1);
    else {
      const idx = BOOKS.findIndex((b) => b.id === bookId);
      if (idx < BOOKS.length - 1) {
        setBookId(BOOKS[idx + 1].id);
        setChapter(1);
      }
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
        <Button
          data-testid="biblia-book-picker"
          variant="outline"
          onClick={() => setPickerOpen(true)}
          className="flex-1 border-gold/30 bg-navy-light/30 text-foreground hover:bg-navy-light/50"
        >
          <BookOpen size={16} className="mr-2 text-gold" />
          {book?.nome} {chapter}
        </Button>
        <Button onClick={goPrev} variant="outline" size="icon" className="border-gold/30 text-gold" data-testid="biblia-prev">
          <ChevronLeft size={18} />
        </Button>
        <Button onClick={goNext} variant="outline" size="icon" className="border-gold/30 text-gold" data-testid="biblia-next">
          <ChevronRight size={18} />
        </Button>
      </div>

      <article className="parchment rounded-2xl px-6 py-7 shadow-inner" data-testid="biblia-reader">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : chapterData ? (
          <>
            <h3 className="font-serif text-2xl text-sepia-text mb-4 text-center">
              {book?.nome} <span className="text-gold-muted">{chapter}</span>
            </h3>
            <div className="gold-divider w-12 mx-auto mb-5" />
            <div className="font-serif text-[19px] leading-loose text-sepia-text">
              {chapterData.verses.map((v) => (
                <button
                  key={v.number}
                  data-testid={`verse-${v.number}`}
                  onClick={() => onVerseClick(v)}
                  className="text-left inline rounded px-0.5 transition hover:bg-gold/15 active:bg-gold/25"
                >
                  <span className="verse-num">{v.number}</span>
                  <span>{v.text} </span>
                </button>
              ))}
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
        <SheetContent side="bottom" className="bg-navy-dark border-gold/20 max-w-md mx-auto h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-serif text-2xl text-gold">Escolher livro</SheetTitle>
          </SheetHeader>
          <div className="pb-10 space-y-6 mt-4">
            {[
              { label: 'Antigo Testamento', list: BOOKS.filter((b) => b.ot) },
              { label: 'Novo Testamento', list: BOOKS.filter((b) => !b.ot) },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold/70 font-sans font-semibold mb-2">{s.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {s.list.map((b) => (
                    <button
                      key={b.id}
                      data-testid={`pick-book-${b.id}`}
                      onClick={() => {
                        setBookId(b.id);
                        setChapter(1);
                        setPickerOpen(false);
                        setChapterPickerOpen(true);
                      }}
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

      <Sheet open={chapterPickerOpen} onOpenChange={setChapterPickerOpen}>
        <SheetContent side="bottom" className="bg-navy-dark border-gold/20 max-w-md mx-auto h-[60vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-serif text-2xl text-gold">{book?.nome} — Capítulo</SheetTitle>
          </SheetHeader>
          <div className="pb-10 mt-4">
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: book?.chapters || 1 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  data-testid={`pick-chapter-${n}`}
                  onClick={() => {
                    setChapter(n);
                    setChapterPickerOpen(false);
                  }}
                  className={`rounded-lg border h-10 text-sm font-serif transition ${
                    chapter === n
                      ? 'bg-gold text-navy-dark border-gold font-semibold'
                      : 'border-gold/15 bg-navy-light/30 text-foreground hover:border-gold/40'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Verse explain drawer */}
      <Drawer open={explainOpen} onOpenChange={setExplainOpen}>
        <DrawerContent className="bg-navy-dark border-gold/20 max-w-md mx-auto">
          <DrawerHeader className="border-b border-gold/10">
            <DrawerTitle className="font-serif text-xl text-gold">
              {book?.nome} {chapter}:{selectedVerse?.number}
            </DrawerTitle>
            <DrawerDescription className="text-foreground/85 font-serif italic text-base leading-relaxed pt-2">
              "{selectedVerse?.text}"
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-5 py-4 max-h-[45vh] overflow-y-auto">
            {explanation ? (
              <p className="text-foreground/90 font-sans whitespace-pre-wrap leading-relaxed text-sm" data-testid="verse-explanation">
                {explanation}
              </p>
            ) : (
              <p className="text-foreground/55 text-sm font-sans italic">
                Toque em "Explicar com IA" para receber uma explicação devocional deste versículo.
              </p>
            )}
          </div>
          <DrawerFooter className="border-t border-gold/10">
            <Button
              data-testid="btn-explicar-ia"
              onClick={handleExplain}
              disabled={explaining}
              className="bg-gold text-navy-dark hover:bg-gold-soft active:scale-[0.98]"
            >
              {explaining ? <><Loader2 size={16} className="mr-2 animate-spin" /> Refletindo…</> : <><Sparkles size={16} className="mr-2" /> Explicar com IA</>}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
