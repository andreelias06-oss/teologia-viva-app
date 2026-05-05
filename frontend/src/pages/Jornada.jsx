import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Highlighter, Bookmark, BookOpen, NotebookPen, ArrowRight } from 'lucide-react';
import { COLOR_MAP } from '../lib/bibleNotes';

export default function Jornada() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-5" data-testid="page-jornada">
      <section>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">Sua trilha de estudo</p>
        <h2 className="font-serif text-3xl text-foreground mt-1">Minha Jornada</h2>
        <div className="gold-divider w-16 mt-1" />
      </section>

      <Tabs defaultValue="destaques" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-navy-light/40 border border-gold/15">
          <TabsTrigger value="destaques" data-testid="tab-destaques" className="data-[state=active]:bg-gold data-[state=active]:text-navy-dark">
            <Highlighter size={14} className="mr-1.5" /> Destaques
          </TabsTrigger>
          <TabsTrigger value="anotacoes" data-testid="tab-anotacoes" className="data-[state=active]:bg-gold data-[state=active]:text-navy-dark">
            <NotebookPen size={14} className="mr-1.5" /> Anotações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="destaques" className="mt-4">
          <DestaquesTab userId={user?.id} navigate={navigate} />
        </TabsContent>

        <TabsContent value="anotacoes" className="mt-4">
          <AnotacoesTab userId={user?.id} navigate={navigate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DestaquesTab({ userId, navigate }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('anotacoes_biblia')
        .select('*')
        .eq('user_id', userId)
        .or('color.not.is.null,favorito_lista.not.is.null,observacao.not.is.null')
        .order('book_id', { ascending: true })
        .order('chapter', { ascending: true })
        .order('verse', { ascending: true });
      setRows(data || []);
    })();
  }, [userId]);

  if (rows === null) return <Skeleton className="h-32 w-full bg-navy-light/40" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Highlighter size={28} className="text-gold/60" />}
        title="Nenhum destaque ainda"
        text="Abra a Bíblia, toque em um versículo e use 'Destacar' ou 'Favoritar' para salvá-lo aqui."
        cta="Ir para a Bíblia"
        onClick={() => navigate('/biblia')}
      />
    );
  }
  return (
    <div className="space-y-2" data-testid="lista-destaques">
      {rows.map((r) => {
        const color = r.color ? COLOR_MAP[r.color] : null;
        return (
          <div
            key={`${r.book_id}-${r.chapter}-${r.verse}`}
            className="rounded-xl border border-gold/15 bg-navy-light/30 p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gold font-sans font-semibold">
                {r.book_nome} {r.chapter}:{r.verse}
              </p>
              <div className="flex items-center gap-2">
                {color ? <span className="w-3 h-3 rounded-sm" style={{ background: color.bg }} /> : null}
                {r.favorito_lista ? <Bookmark size={12} className="text-gold-muted" fill="currentColor" /> : null}
              </div>
            </div>
            {r.verse_text ? (
              <p className="font-serif italic text-foreground/90 leading-relaxed">"{r.verse_text}"</p>
            ) : null}
            {r.observacao ? (
              <p className="text-foreground/75 text-sm font-sans whitespace-pre-wrap border-l-2 border-gold/30 pl-3">
                {r.observacao}
              </p>
            ) : null}
            <button
              onClick={() => navigate('/biblia')}
              data-testid={`destaque-goto-${r.book_id}-${r.chapter}`}
              className="text-xs text-gold/80 hover:text-gold font-sans flex items-center gap-1"
            >
              <BookOpen size={12} /> Ir para o capítulo <ArrowRight size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AnotacoesTab({ userId, navigate }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('anotacoes_aulas')
        .select('aula_id, conteudo, updated_at, aulas(id, titulo, ordem, curso_id, cursos(id, titulo))')
        .eq('user_id', userId)
        .neq('conteudo', '')
        .order('updated_at', { ascending: false });
      setRows(data || []);
    })();
  }, [userId]);

  if (rows === null) return <Skeleton className="h-32 w-full bg-navy-light/40" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<NotebookPen size={28} className="text-gold/60" />}
        title="Nenhuma anotação ainda"
        text="Abra qualquer aula da Academia e use o bloco 'Minhas anotações' para registrar suas reflexões."
        cta="Ir para a Academia"
        onClick={() => navigate('/academia')}
      />
    );
  }
  return (
    <div className="space-y-2" data-testid="lista-anotacoes">
      {rows.map((r) => {
        const cursoTit = r.aulas?.cursos?.titulo || 'Curso';
        const aulaTit = r.aulas?.titulo || 'Aula';
        return (
          <div
            key={r.aula_id}
            className="rounded-xl border border-gold/15 bg-navy-light/30 p-4 space-y-2"
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-gold/80 font-sans font-semibold">{cursoTit}</p>
              <p className="font-serif text-lg text-foreground leading-tight">{aulaTit}</p>
            </div>
            <p className="text-foreground/85 text-sm font-sans whitespace-pre-wrap leading-relaxed line-clamp-6">
              {r.conteudo}
            </p>
            <button
              onClick={() => navigate(`/aula/${r.aula_id}`)}
              data-testid={`anotacao-goto-${r.aula_id}`}
              className="text-xs text-gold/80 hover:text-gold font-sans flex items-center gap-1"
            >
              Abrir aula <ArrowRight size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ icon, title, text, cta, onClick }) {
  return (
    <div className="rounded-2xl border border-gold/15 bg-navy-light/30 p-6 text-center space-y-3">
      <div className="flex justify-center">{icon}</div>
      <p className="font-serif text-lg text-foreground">{title}</p>
      <p className="text-foreground/65 text-sm font-sans">{text}</p>
      {cta ? (
        <Button onClick={onClick} className="bg-gold text-navy-dark hover:bg-gold-soft mt-2">
          {cta}
        </Button>
      ) : null}
    </div>
  );
}
