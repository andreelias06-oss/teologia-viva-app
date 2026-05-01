import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '../components/ui/skeleton';
import { ChevronRight, BookMarked, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { effectivePlan } from '../lib/plan';

export default function Academia() {
  const [eixos, setEixos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeEixo, setActiveEixo] = useState(null);
  const navigate = useNavigate();
  const { profile } = useAuth();
  const plan = effectivePlan(profile);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: eixosData }, { data: cursosData }] = await Promise.all([
        supabase.from('eixos').select('*').order('id', { ascending: true }),
        supabase.from('cursos').select('*').order('id', { ascending: true }),
      ]);
      setEixos(eixosData || []);
      setCursos(cursosData || []);
      // Default to "Todos" (null) so user sees all courses up front
      setActiveEixo(null);
      setLoading(false);
    })();
  }, []);

  const filtered = activeEixo
    ? cursos.filter((c) => String(c.eixo_id) === String(activeEixo))
    : cursos;

  return (
    <div className="space-y-6" data-testid="page-academia">
      <section>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">Estudo bíblico</p>
        <h2 className="font-serif text-3xl text-foreground mt-1">Academia</h2>
        <div className="gold-divider w-16 mt-1" />
      </section>

      {loading ? (
        <Skeleton className="h-12 w-full bg-navy-light/40" />
      ) : (
        <div className="-mx-5 px-5 overflow-x-auto no-scrollbar">
          <div className="flex gap-2">
            <button
              data-testid="eixo-pill-all"
              onClick={() => setActiveEixo(null)}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-sans tracking-wide uppercase transition ${
                activeEixo === null
                  ? 'bg-gold text-navy-dark border-gold font-semibold'
                  : 'border-gold/30 text-foreground/75 hover:border-gold/60'
              }`}
            >
              Todos
            </button>
            {eixos.map((e) => (
              <button
                key={e.id}
                data-testid={`eixo-pill-${e.id}`}
                onClick={() => setActiveEixo(e.id)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-sans tracking-wide uppercase transition ${
                  activeEixo === e.id
                    ? 'bg-gold text-navy-dark border-gold font-semibold'
                    : 'border-gold/30 text-foreground/75 hover:border-gold/60'
                }`}
              >
                {e.nome || e.titulo || `Eixo ${e.id}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full bg-navy-light/40" />
          <Skeleton className="h-24 w-full bg-navy-light/40" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gold/15 bg-navy-light/30 p-6 text-foreground/70 text-sm">
          Nenhum curso disponível neste eixo.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => {
            const blocked = plan === 'free' && c.is_premium === true;
            return (
              <li key={c.id}>
                <button
                  data-testid={`curso-card-${c.id}`}
                  onClick={() => navigate(`/curso/${c.id}`)}
                  className="w-full text-left flex items-center gap-4 rounded-2xl border border-gold/15 bg-navy-light/30 p-4 transition hover:border-gold/40 active:scale-[0.99]"
                >
                  <div className="w-14 h-14 shrink-0 rounded-xl border border-gold/30 flex items-center justify-center text-gold bg-navy-dark/40 overflow-hidden">
                    {c.imagem_capa || c.capa_url ? (
                      <img src={c.imagem_capa || c.capa_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <BookMarked size={20} strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-lg text-foreground truncate">{c.titulo || c.nome}</p>
                    {c.descricao && (
                      <p className="text-xs font-sans text-foreground/60 line-clamp-2 mt-0.5">{c.descricao}</p>
                    )}
                  </div>
                  {blocked ? (
                    <Lock size={16} className="text-gold/60" />
                  ) : (
                    <ChevronRight size={18} className="text-gold/60" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
