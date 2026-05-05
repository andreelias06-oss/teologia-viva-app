import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Switch } from '../components/ui/switch';
import { effectivePlan, trialDaysLeft, getAICallsToday, PLAN } from '../lib/plan';
import { LogOut, NotebookPen, Sparkles, Crown, Shield, Bell } from 'lucide-react';
import StreakBadge from '../components/StreakBadge';
import UpgradeModal from '../components/UpgradeModal';
import { isAdmin } from '../lib/admin';
import { isPushSupported, subscribePush, unsubscribePush, getCurrentSubscription } from '../lib/push';
import { pollSessionStatus } from '../lib/payments';
import { toast } from 'sonner';

export default function Perfil() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [progressoAtual, setProgressoAtual] = useState({ curso: null, pct: 0, totalAulas: 0, doneAulas: 0 });
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Notificações de devocional + meditação
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [meditacaoEnabled, setMeditacaoEnabled] = useState(false);
  const [meditacaoLoading, setMeditacaoLoading] = useState(false);
  const pushSupported = isPushSupported();

  // Stripe checkout return — se houver `?session_id=...`, faz polling do status.
  useEffect(() => {
    const sid = searchParams.get('session_id');
    if (!sid) return;
    let cancelled = false;
    (async () => {
      toast.loading('Confirmando pagamento…', { id: 'pay-status' });
      const res = await pollSessionStatus(sid);
      if (cancelled) return;
      if (res.status === 'complete' && (res.payment_status === 'paid' || !res.payment_status)) {
        toast.success('Pagamento confirmado! Bem-vindo ao Premium 👑', { id: 'pay-status' });
      } else if (res.status === 'expired') {
        toast.error('Sessão de pagamento expirou', { id: 'pay-status' });
      } else {
        toast.error('Pagamento não confirmado. Tente novamente.', { id: 'pay-status' });
      }
      // limpa o search param
      const np = new URLSearchParams(searchParams);
      np.delete('session_id');
      setSearchParams(np, { replace: true });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = effectivePlan(profile);
  const days = trialDaysLeft(profile);
  const aiUsed = getAICallsToday(user?.id);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      // Busca o curso com mais aulas concluídas no Supabase.
      const { data: rows } = await supabase
        .from('progresso_aulas')
        .select('curso_id')
        .eq('user_id', user.id)
        .not('curso_id', 'is', null);
      if (!active) return;
      if (!rows || rows.length === 0) return;
      const counts = {};
      rows.forEach((r) => { counts[r.curso_id] = (counts[r.curso_id] || 0) + 1; });
      const bestCursoId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!bestCursoId) return;
      const done = counts[bestCursoId];
      const [{ data: curso }, { data: aulas }] = await Promise.all([
        supabase.from('cursos').select('*').eq('id', bestCursoId).maybeSingle(),
        supabase.from('aulas').select('id').eq('curso_id', bestCursoId),
      ]);
      if (!active) return;
      const total = aulas?.length || 0;
      const pct = total ? Math.round((done / total) * 100) : 0;
      setProgressoAtual({ curso, pct, totalAulas: total, doneAulas: done });
    })();
    return () => { active = false; };
  }, [user?.id]);

  // Sincroniza estado dos switches com profile + subscription real do navegador
  useEffect(() => {
    let active = true;
    (async () => {
      if (!pushSupported) {
        if (active) { setNotifEnabled(false); setMeditacaoEnabled(false); }
        return;
      }
      const sub = await getCurrentSubscription();
      const dbDevo = !!profile?.notif_devocional;
      const dbMed = !!profile?.notif_meditacao;
      if (active) {
        setNotifEnabled(dbDevo && !!sub);
        setMeditacaoEnabled(dbMed && !!sub);
      }
    })();
    return () => { active = false; };
  }, [profile?.notif_devocional, profile?.notif_meditacao, pushSupported]);

  // Garante que existe uma subscription ativa antes de salvar a preferência.
  // Reutiliza a mesma subscription para os dois tipos de push.
  const ensureSubscription = async () => {
    if (!user?.id) return false;
    try {
      await subscribePush(user.id);
      return true;
    } catch (e) {
      toast.error(e?.message || 'Falha ao habilitar notificações');
      return false;
    }
  };

  const toggleNotif = async (next) => {
    if (!user?.id) return;
    if (!pushSupported) {
      toast.error('Notificações não são suportadas neste dispositivo.');
      return;
    }
    setNotifLoading(true);
    try {
      if (next) {
        const ok = await ensureSubscription();
        if (!ok) return;
        await supabase.from('profiles').update({ notif_devocional: true }).eq('id', user.id);
        setNotifEnabled(true);
        toast.success('Notificação do devocional ativada!');
      } else {
        await supabase.from('profiles').update({ notif_devocional: false }).eq('id', user.id);
        setNotifEnabled(false);
        // Só remove a subscription se NENHUM dos dois estiver ativo.
        if (!meditacaoEnabled) await unsubscribePush();
        toast.success('Notificação do devocional desativada');
      }
    } catch (e) {
      toast.error(e?.message || 'Falha ao atualizar notificações');
    } finally {
      setNotifLoading(false);
    }
  };

  const toggleMeditacao = async (next) => {
    if (!user?.id) return;
    if (!pushSupported) {
      toast.error('Notificações não são suportadas neste dispositivo.');
      return;
    }
    setMeditacaoLoading(true);
    try {
      if (next) {
        const ok = await ensureSubscription();
        if (!ok) return;
        await supabase.from('profiles').update({ notif_meditacao: true }).eq('id', user.id);
        setMeditacaoEnabled(true);
        toast.success('Lembrete de meditação ativado!');
      } else {
        await supabase.from('profiles').update({ notif_meditacao: false }).eq('id', user.id);
        setMeditacaoEnabled(false);
        if (!notifEnabled) await unsubscribePush();
        toast.success('Lembrete de meditação desativado');
      }
    } catch (e) {
      toast.error(e?.message || 'Falha ao atualizar notificações');
    } finally {
      setMeditacaoLoading(false);
    }
  };

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
            <Button
              data-testid="btn-fazer-upgrade"
              onClick={() => setUpgradeOpen(true)}
              className="bg-gold text-navy-dark hover:bg-gold-soft h-9"
            >
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

      <div className="rounded-2xl border border-gold/15 bg-navy-light/30 p-5 space-y-4" data-testid="config-notif">
        <div className="flex items-center gap-3">
          <Bell size={18} className="text-gold" />
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold/80 font-sans font-semibold">Configurações</p>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-sans text-sm text-foreground">Notificação do devocional diário</p>
            <p className="font-sans text-xs text-foreground/60 mt-0.5">
              Receba um aviso toda manhã (07:00) com o devocional do dia.
            </p>
            {!pushSupported && (
              <p className="font-sans text-xs text-destructive-foreground/80 mt-1">
                Indisponível neste navegador.
              </p>
            )}
          </div>
          <Switch
            data-testid="switch-notif-devocional"
            checked={notifEnabled}
            disabled={!pushSupported || notifLoading}
            onCheckedChange={toggleNotif}
          />
        </div>

        <div className="border-t border-gold/10" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-sans text-sm text-foreground">Lembrete de meditação</p>
            <p className="font-sans text-xs text-foreground/60 mt-0.5">
              Receba um lembrete às 18:00 para retomar o devocional do dia. <span className="text-gold/80">Opcional.</span>
            </p>
          </div>
          <Switch
            data-testid="switch-notif-meditacao"
            checked={meditacaoEnabled}
            disabled={!pushSupported || meditacaoLoading}
            onCheckedChange={toggleMeditacao}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Button
          data-testid="btn-anotacoes"
          variant="outline"
          onClick={() => navigate('/anotacoes')}
          className="border-gold/30 text-foreground hover:bg-gold/10 h-12 justify-start"
        >
          <NotebookPen size={16} className="mr-2 text-gold" /> Minhas Anotações
        </Button>
        {isAdmin(profile) && (
          <Button
            data-testid="btn-admin"
            variant="outline"
            onClick={() => navigate('/admin')}
            className="border-gold text-gold bg-gold/5 hover:bg-gold/15 h-12 justify-start"
          >
            <Shield size={16} className="mr-2" /> Painel de Curadoria
          </Button>
        )}
        <Button
          data-testid="btn-sair"
          variant="outline"
          onClick={async () => { await signOut(); navigate('/auth', { replace: true }); }}
          className="border-destructive/40 text-destructive-foreground hover:bg-destructive/20 h-12 justify-start"
        >
          <LogOut size={16} className="mr-2" /> Sair
        </Button>
      </div>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
