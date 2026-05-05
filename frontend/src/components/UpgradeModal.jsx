import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Crown, Check, Sparkles, BookOpen, MessageCircleQuestion, Bookmark, Loader2 } from 'lucide-react';
import { effectivePlan, trialDaysLeft, PLAN } from '../lib/plan';
import { useAuth } from '../contexts/AuthContext';
import { startCheckout, PACKAGES } from '../lib/payments';
import { toast } from 'sonner';

const BENEFITS = [
  { icon: BookOpen, text: 'Acesso completo a todos os cursos da Academia' },
  { icon: MessageCircleQuestion, text: 'Tutor IA ilimitado — sem limite diário de consultas' },
  { icon: Sparkles, text: 'Explicação de versículos sem restrição na Bíblia' },
  { icon: Bookmark, text: 'Suporte premium e novos conteúdos em primeira mão' },
];

export default function UpgradeModal({ open, onOpenChange }) {
  const { profile } = useAuth();
  const plan = effectivePlan(profile);
  const days = trialDaysLeft(profile);
  const pack = PACKAGES.premium_mensal;
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      await startCheckout('premium_mensal');
      // O navegador é redirecionado para Stripe; só veremos esta linha se algo deu errado.
    } catch (e) {
      toast.error(e?.message || 'Falha ao iniciar pagamento');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-navy-dark border-gold/30 max-w-[92%] sm:max-w-md mx-auto z-[140]"
        data-testid="upgrade-modal"
      >
        <DialogHeader className="space-y-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full border-2 border-gold flex items-center justify-center">
              <Crown size={26} className="text-gold" strokeWidth={1.5} />
            </div>
          </div>
          <DialogTitle className="font-serif text-2xl text-center text-foreground">
            Teologia Viva <span className="italic text-gold">Premium</span>
          </DialogTitle>
          <DialogDescription className="text-center text-foreground/70 text-sm font-sans">
            {plan === PLAN.TRIAL
              ? `Você está no Trial — restam ${days} dia(s). Continue com acesso total.`
              : 'Liberte todo o potencial de estudo com o plano Premium.'}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 my-2">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <li key={b.text} className="flex items-start gap-3">
                <span className="mt-0.5 w-6 h-6 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
                  <Check size={12} className="text-gold" strokeWidth={2.5} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-sans text-foreground/90 leading-snug flex items-center gap-2">
                    <Icon size={14} className="text-gold/70 shrink-0" /> {b.text}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 text-center space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">Modo Teste · Stripe</p>
          <p className="text-foreground/95 text-2xl font-serif">
            R$ {pack.amount.toFixed(2).replace('.', ',')} <span className="text-sm text-foreground/60">/ mês</span>
          </p>
          <p className="text-foreground/60 text-xs font-sans italic">
            Cancele quando quiser. Pagamento processado pela Stripe.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            data-testid="upgrade-modal-checkout"
            onClick={handleCheckout}
            disabled={loading}
            className="bg-gold text-navy-dark hover:bg-gold-soft h-11 w-full"
          >
            {loading ? (
              <><Loader2 size={16} className="mr-2 animate-spin" /> Abrindo pagamento…</>
            ) : (
              <><Crown size={16} className="mr-2" /> Quero ser Premium</>
            )}
          </Button>
          <Button
            data-testid="upgrade-modal-close"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gold/30 text-foreground hover:bg-gold/10 h-10 w-full"
          >
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
