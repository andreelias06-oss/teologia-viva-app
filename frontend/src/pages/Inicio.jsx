import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Skeleton } from '../components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, GraduationCap, ChevronRight } from 'lucide-react';

const HERO_BG =
  'https://images.unsplash.com/photo-1564182910735-f4084c663978?crop=entropy&cs=srgb&fm=jpg&w=900&q=80';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Inicio() {
  const [devocional, setDevocional] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('devocionais')
        .select('*')
        .eq('data', todayISO())
        .maybeSingle();
      if (data) {
        setDevocional(data);
      } else {
        // fallback to most recent
        const { data: latest } = await supabase
          .from('devocionais')
          .select('*')
          .order('data', { ascending: false })
          .limit(1)
          .maybeSingle();
        setDevocional(latest);
      }
      setLoading(false);
    })();
  }, []);

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="space-y-6" data-testid="page-inicio">
      <section>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">{today}</p>
        <h2 className="font-serif text-3xl text-foreground mt-1 mb-1">Devocional do dia</h2>
        <div className="gold-divider w-16" />
      </section>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-64 w-full bg-navy-light/40" />
          <Skeleton className="h-20 w-full bg-navy-light/40" />
        </div>
      ) : devocional ? (
        <article
          data-testid="devocional-card"
          className="relative overflow-hidden rounded-2xl border border-gold/20 shadow-2xl"
        >
          <div className="relative h-44">
            <img src={HERO_BG} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-navy-dark/60 via-navy/70 to-navy-dark" />
            <div className="absolute inset-0 flex items-end p-6">
              <h3 className="font-serif text-3xl leading-tight text-foreground" data-testid="devocional-titulo">
                {devocional.titulo}
              </h3>
            </div>
          </div>
          <div className="bg-navy-light/40 backdrop-blur-sm p-6 space-y-4">
            <blockquote className="border-l-2 border-gold pl-4 py-1">
              <p className="font-serif italic text-xl leading-relaxed text-gold/95" data-testid="devocional-versiculo">
                "{devocional.versiculo}"
              </p>
              {devocional.referencia && (
                <cite className="not-italic block mt-2 text-xs uppercase tracking-[0.2em] text-gold/70 font-sans font-semibold">
                  {devocional.referencia}
                </cite>
              )}
            </blockquote>
            <p className="text-foreground/85 leading-relaxed font-sans drop-cap" data-testid="devocional-reflexao">
              {devocional.reflexao}
            </p>
          </div>
        </article>
      ) : (
        <div className="rounded-2xl border border-gold/15 bg-navy-light/30 p-6 text-foreground/70 text-sm">
          Nenhum devocional disponível ainda.
        </div>
      )}

      <section className="pt-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-3">Continue</p>
        <div className="grid grid-cols-1 gap-3">
          {[
            { label: 'Continuar Academia', icon: GraduationCap, to: '/academia', sub: 'Eixos e cursos' },
            { label: 'Abrir a Bíblia', icon: BookOpen, to: '/biblia', sub: 'Leitura fluida' },
            { label: 'Mural de orações', icon: Users, to: '/comunidade', sub: 'Ore por irmãos' },
          ].map((item) => (
            <button
              key={item.to}
              data-testid={`shortcut-${item.to.replace('/', '')}`}
              onClick={() => navigate(item.to)}
              className="flex items-center justify-between gap-4 rounded-xl border border-gold/15 bg-navy-light/30 p-4 text-left transition hover:border-gold/40 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full border border-gold/30 flex items-center justify-center text-gold">
                  <item.icon size={18} strokeWidth={1.5} />
                </span>
                <div>
                  <p className="font-serif text-lg text-foreground">{item.label}</p>
                  <p className="text-xs font-sans text-foreground/55">{item.sub}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gold/60" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
