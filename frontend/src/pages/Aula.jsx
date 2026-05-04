import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, MessageCircleQuestion, Sparkles, Lock, Check } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import AITutorDrawer from '../components/AITutorDrawer';
import UpgradeModal from '../components/UpgradeModal';
import { useAuth } from '../contexts/AuthContext';
import { canAccessLesson, effectivePlan } from '../lib/plan';
import { markComplete as savePersistComplete, subscribeProgress } from '../lib/progresso';
import { toast } from 'sonner';

function youtubeEmbed(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  // Already an embed URL — use as-is
  if (/youtube\.com\/embed\//.test(trimmed)) return trimmed.split('&')[0];
  // Standard patterns
  const re = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^&]*&)*v=|embed\/|v\/|shorts\/))([\w-]{11})/;
  const m = trimmed.match(re);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  // Bare 11-char ID
  if (/^[\w-]{11}$/.test(trimmed)) return `https://www.youtube.com/embed/${trimmed}`;
  return null;
}

export default function Aula() {
  const { id } = useParams();
  const [aula, setAula] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const plan = effectivePlan(profile);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setAula(null);
    setCompleted(false);
    (async () => {
      const { data } = await supabase.from('aulas').select('*').eq('id', id).maybeSingle();
      if (!active) return;
      setAula(data);
      if (user?.id && id) {
        const { data: prog } = await supabase
          .from('progresso_aulas')
          .select('aula_id')
          .eq('user_id', user.id)
          .eq('aula_id', id)
          .maybeSingle();
        if (active) setCompleted(!!prog);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id, user?.id]);

  // Realtime: outro dispositivo marca/desmarca esta aula → atualiza UI instantaneamente.
  useEffect(() => {
    if (!user?.id || !id) return;
    const unsub = subscribeProgress(user.id, (payload) => {
      const aulaId = payload.new?.aula_id ?? payload.old?.aula_id;
      if (Number(aulaId) !== Number(id)) return;
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') setCompleted(true);
      else if (payload.eventType === 'DELETE') setCompleted(false);
    });
    return unsub;
  }, [user?.id, id]);

  const markComplete = async () => {
    if (!aula?.id || !user?.id) return;
    try {
      await savePersistComplete({ userId: user.id, aulaId: aula.id, cursoId: aula.curso_id });
      setCompleted(true);
      toast.success('Aula marcada como concluída');
    } catch (e) {
      toast.error('Falha ao salvar progresso');
    }
  };

  const accessible = aula ? canAccessLesson(profile, aula) : true;
  const embed = useMemo(() => youtubeEmbed(aula?.url_video || aula?.video_url), [aula]);

  const contextoTutor = aula
    ? `Aula: ${aula.titulo}\n\nLeitura bíblica: ${aula.leitura_biblica || '—'}\n\nTexto de apoio: ${(aula.conteudo_texto || aula.texto_apoio || aula.descricao || '').slice(0, 1500)}`
    : '';

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-32 bg-navy-light/40" />
        <Skeleton className="h-48 w-full bg-navy-light/40" />
        <Skeleton className="h-32 w-full bg-navy-light/40" />
      </div>
    );
  }

  if (!aula) {
    return <div className="text-foreground/70 text-sm">Aula não encontrada.</div>;
  }

  if (!accessible) {
    return (
      <div className="space-y-5" data-testid="page-aula-bloqueada">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-foreground/70 hover:text-gold text-sm">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="rounded-2xl border border-gold/30 bg-navy-light/30 p-8 text-center space-y-4">
          <Lock size={32} strokeWidth={1.4} className="text-gold mx-auto" />
          <h3 className="font-serif text-2xl text-foreground">Conteúdo Premium</h3>
          <p className="text-foreground/70 text-sm font-sans">
            Esta aula está disponível apenas no plano Premium. Faça upgrade para ter acesso completo às aulas da Academia.
          </p>
          <Button
            onClick={() => setUpgradeOpen(true)}
            data-testid="btn-upgrade"
            className="bg-gold text-navy-dark hover:bg-gold-soft"
          >
            Ver opções de plano
          </Button>
        </div>
        <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6" data-testid="page-aula">
      <button onClick={() => navigate(-1)} data-testid="aula-back" className="flex items-center gap-1 text-foreground/70 hover:text-gold text-sm">
        <ArrowLeft size={16} /> Voltar
      </button>

      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">Aula {aula.ordem || ''}</p>
        <h2 className="font-serif text-3xl text-foreground mt-1" data-testid="aula-titulo">{aula.titulo}</h2>
      </header>

      {aula.leitura_biblica ? (
        <section className="rounded-2xl border border-gold/20 bg-navy-light/30 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-2">Leitura Bíblica</p>
          <p className="font-serif italic text-xl text-gold/95 leading-relaxed" data-testid="aula-leitura">"{aula.leitura_biblica}"</p>
        </section>
      ) : null}

      {embed ? (
        <section
          key={`video-${id}`}
          className="rounded-2xl overflow-hidden border border-gold/20 bg-black aspect-video"
          data-testid="aula-video"
        >
          <iframe
            key={embed}
            src={embed}
            title={aula.titulo || 'Aula'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </section>
      ) : (aula.url_video || aula.video_url) ? (
        <section
          key={`video-file-${id}`}
          className="rounded-2xl overflow-hidden border border-gold/20 bg-black"
          data-testid="aula-video"
        >
          <video key={aula.url_video || aula.video_url} src={aula.url_video || aula.video_url} controls className="w-full" />
        </section>
      ) : null}

      {(aula.conteudo_texto || aula.texto_apoio || aula.descricao) ? (
        <section className="space-y-3" data-testid="aula-texto-apoio">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">Texto de apoio</p>
          <article className="text-foreground/85 leading-relaxed font-sans whitespace-pre-wrap">
            {aula.conteudo_texto || aula.texto_apoio || aula.descricao}
          </article>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sticky bottom-[80px] bg-gradient-to-t from-navy via-navy to-transparent pt-4">
        <Button
          data-testid="btn-tutor-ia"
          onClick={() => setTutorOpen(true)}
          className="w-full bg-gold text-navy-dark hover:bg-gold-soft h-12 active:scale-[0.98]"
        >
          <Sparkles size={16} className="mr-2" /> Tirar dúvida com Tutor IA
          {plan === 'free' && <span className="ml-2 text-[10px] opacity-70">(5/dia)</span>}
        </Button>
        <Button
          data-testid="btn-aula-concluir"
          onClick={markComplete}
          disabled={completed}
          variant="outline"
          className="w-full border-gold/40 text-gold hover:bg-gold/10 h-11"
        >
          {completed ? (
            <><Check size={16} className="mr-2" /> Aula concluída</>
          ) : (
            <><MessageCircleQuestion size={16} className="mr-2" /> Marcar como concluída</>
          )}
        </Button>
      </div>

      <AITutorDrawer
        open={tutorOpen}
        onOpenChange={setTutorOpen}
        contexto={contextoTutor}
        titulo="Tutor IA"
        descricao={`Tire dúvidas sobre: ${aula.titulo}`}
      />
    </div>
  );
}
