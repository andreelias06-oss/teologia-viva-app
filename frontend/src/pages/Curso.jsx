import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ChevronRight, Lock, Play } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import { Progress } from '../components/ui/progress';
import { useAuth } from '../contexts/AuthContext';
import { canAccessLesson } from '../lib/plan';

export default function Curso() {
  const { id } = useParams();
  const [curso, setCurso] = useState(null);
  const [aulas, setAulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progresso, setProgresso] = useState({});
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: cursoData }, { data: aulasData }] = await Promise.all([
        supabase.from('cursos').select('*').eq('id', id).maybeSingle(),
        supabase.from('aulas').select('*').eq('curso_id', id).order('ordem', { ascending: true }),
      ]);
      setCurso(cursoData);
      setAulas(aulasData || []);

      // Local progress
      try {
        const raw = localStorage.getItem(`tv_progress_${user?.id}_${id}`);
        if (raw) setProgresso(JSON.parse(raw));
      } catch { /* ignore */ }

      setLoading(false);
    })();
  }, [id, user?.id]);

  const total = aulas.length || 1;
  const done = Object.values(progresso).filter(Boolean).length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="space-y-5" data-testid="page-curso">
      <button
        onClick={() => navigate('/academia')}
        data-testid="curso-back-btn"
        className="flex items-center gap-1 text-foreground/70 hover:text-gold text-sm transition"
      >
        <ArrowLeft size={16} /> Academia
      </button>

      {loading || !curso ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full bg-navy-light/40" />
          <Skeleton className="h-24 w-full bg-navy-light/40" />
        </div>
      ) : (
        <>
          <header className="rounded-2xl border border-gold/20 bg-navy-light/30 overflow-hidden">
            {(curso.capa_url || curso.thumbnail) && (
              <div className="h-36 relative">
                <img src={curso.capa_url || curso.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-navy-dark/90" />
              </div>
            )}
            <div className="p-5 space-y-3">
              <h2 className="font-serif text-3xl text-foreground" data-testid="curso-titulo">
                {curso.nome || curso.titulo}
              </h2>
              {curso.descricao && (
                <p className="text-foreground/75 text-sm font-sans leading-relaxed">{curso.descricao}</p>
              )}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-gold/80 font-sans font-semibold">
                  <span>Progresso</span>
                  <span data-testid="curso-progress-pct">{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5 bg-navy-dark [&>*]:bg-gold" />
              </div>
            </div>
          </header>

          <section>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-3">Aulas</p>
            {aulas.length === 0 ? (
              <div className="rounded-xl border border-gold/15 bg-navy-light/30 p-5 text-sm text-foreground/70">
                Nenhuma aula publicada ainda.
              </div>
            ) : (
              <ul className="space-y-2">
                {aulas.map((a, i) => {
                  const accessible = canAccessLesson(profile, a);
                  return (
                    <li key={a.id}>
                      <button
                        data-testid={`aula-item-${a.id}`}
                        onClick={() => navigate(`/aula/${a.id}`)}
                        className="w-full text-left flex items-center gap-4 rounded-xl border border-gold/15 bg-navy-light/30 px-4 py-3 transition hover:border-gold/40 active:scale-[0.99]"
                      >
                        <span className="w-9 h-9 rounded-full bg-navy-dark border border-gold/30 flex items-center justify-center text-gold font-serif">
                          {a.ordem || i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-serif text-base text-foreground truncate">{a.titulo}</p>
                          <p className="text-[11px] font-sans text-foreground/55 mt-0.5 flex items-center gap-1">
                            <Play size={11} />{a.duracao || 'Aula'} {progresso[a.id] && '· concluída'}
                          </p>
                        </div>
                        {accessible ? (
                          <ChevronRight size={18} className="text-gold/60" />
                        ) : (
                          <Lock size={16} className="text-gold/60" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
