import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { effectivePlan, trialDaysLeft, getAICallsToday, PLAN } from '../lib/plan';
import { LogOut, NotebookPen, Sparkles, Crown } from 'lucide-react';
import StreakBadge from '../components/StreakBadge';

export default function Perfil() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [progressoAtual, setProgressoAtual] = useState({ curso: null, pct: 0, totalAulas: 0, doneAulas: 0 });

  const plan = effectivePlan(profile);
  const days = trialDaysLeft(profile);
  const aiUsed = getAICallsToday(user?.id);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      // Find a course with progress in localStorage
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(`tv_progress_${user.id}_`));
      let best = null;
      for (const k of keys) {
        try {
          const obj = JSON.parse(localStorage.getItem(k) || '{}');
          const done = Object.values(obj).filter(Boolean).length;
          if (done > 0) {
            const cursoId = k.split(`tv_progress_${user.id}_`)[1];
            best = { cursoId, done };
            break;
          }
        } catch { /* ignore */ }
      }
      if (best) {
        const [{ data: curso }, { data: aulas }] = await Promise.all([
          supabase.from('cursos').select('*').eq('id', best.cursoId).maybeSingle(),
          supabase.from('aulas').select('id').eq('curso_id', best.cursoId),
        ]);
        const total = aulas?.length || 0;
        const pct = total ? Math.round((best.done / total) * 100) : 0;
        setProgressoAtual({ curso, pct, totalAulas: total, doneAulas: best.done });
      }
    })();
  }, [user?.id]);

  const planLabel = plan === PLAN.PREMIUM ? 'Premium' : plan === PLAN.TRIAL ? `Trial · ${days} dia(s)` : 'Free';

  return (
    <div className="space-y-6" data-testid="page-perfil">
      <section>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">Sua jornada</p>
        <h2 className="font-serif text-3xl text-foreground mt-1">Perfil</h2>
        <div className="gold-divider w-16 mt-1" />
      </section>

      <div className="rounded-2xl border border-gold/20 bg-navy-light/30 p-5 space-y-1">
        <p className="text-foreground/60 text-xs uppercase tracking-[0.15em] font-sans">Conectado</p>
        <p className="font-serif text-xl text-foreground" data-testid="perfil-email">{user?.email}</p>
        {profile?.nome && <p className="text-foreground/70 text-sm font-sans">{profile.nome}</p>}
      </div>

      <StreakBadge
        current={profile?.current_streak || 0}
        best={profile?.best_streak || 0}
      />

      <div className={`rounded-2xl border p-5 space-y-3 ${plan === PLAN.PREMIUM ? 'border-gold bg-gold/10' : 'border-gold/20 bg-navy-light/30'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {plan === PLAN.PREMIUM ? <Crown size={18} className="text-gold" /> : <Sparkles size={18} className="text-gold" />}
            <p className="font-serif text-2xl text-foreground" data-testid="perfil-plano">{planLabel}</p>
          </div>
          {plan !== PLAN.PREMIUM && (
            <Button data-testid="btn-fazer-upgrade" className="bg-gold text-navy-dark hover:bg-gold-soft h-9">
              Upgrade
            </Button>
          )}
        </div>
        {plan === PLAN.TRIAL && (
          <p className="text-xs text-foreground/70 font-sans">
            Você tem acesso completo por mais {days} dia(s). Após esse período, sua conta passa para o plano Free.
          </p>
        )}
        {plan === PLAN.FREE && (
          <p className="text-xs text-foreground/70 font-sans">
            Plano Free: 5 consultas de IA por dia ({aiUsed}/5 usadas hoje) · acesso à 1ª aula de cada curso.
          </p>
        )}
        {plan === PLAN.PREMIUM && (
          <p className="text-xs text-foreground/70 font-sans">Acesso total a aulas, IA ilimitada e recursos avançados.</p>
        )}
      </div>

      {progressoAtual.curso ? (
        <div className="rounded-2xl border border-gold/15 bg-navy-light/30 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.15em] text-gold/80 font-sans font-semibold">Curso atual</p>
            <button
              onClick={() => navigate(`/curso/${progressoAtual.curso.id}`)}
              className="text-xs text-gold hover:underline font-sans"
            >
              Continuar
            </button>
          </div>
          <h3 className="font-serif text-xl text-foreground">{progressoAtual.curso.nome || progressoAtual.curso.titulo}</h3>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-foreground/70 font-sans">
              <span>{progressoAtual.doneAulas} de {progressoAtual.totalAulas} aulas</span>
              <span>{progressoAtual.pct}%</span>
            </div>
            <Progress value={progressoAtual.pct} className="h-1.5 bg-navy-dark [&>*]:bg-gold" />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gold/15 bg-navy-light/30 p-5 text-sm text-foreground/70">
          Comece um curso na Academia para acompanhar seu progresso aqui.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        <Button
          data-testid="btn-anotacoes"
          variant="outline"
          onClick={() => navigate('/anotacoes')}
          className="border-gold/30 text-foreground hover:bg-gold/10 h-12 justify-start"
        >
          <NotebookPen size={16} className="mr-2 text-gold" /> Minhas Anotações
        </Button>
        <Button
          data-testid="btn-sair"
          variant="outline"
          onClick={async () => { await signOut(); navigate('/auth', { replace: true }); }}
          className="border-destructive/40 text-destructive-foreground hover:bg-destructive/20 h-12 justify-start"
        >
          <LogOut size={16} className="mr-2" /> Sair
        </Button>
      </div>
    </div>
  );
}
