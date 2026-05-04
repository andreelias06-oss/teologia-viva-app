import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Crown, Check, Sparkles, BookOpen, MessageCircleQuestion, Bookmark } from 'lucide-react';
import { effectivePlan, trialDaysLeft, PLAN } from '../lib/plan';
import { useAuth } from '../contexts/AuthContext';

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

        <div className="rounded-xl border border-gold/20 bg-navy-light/40 p-4 text-center space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold/70 font-sans font-semibold">Em breve</p>
          <p className="text-foreground/80 text-sm font-sans">
            A assinatura Premium estará disponível em breve via Stripe.
          </p>
          <p className="text-foreground/60 text-xs font-sans italic">
            Quer ser avisado quando lançar? Fale com o time pelo e-mail{' '}
            <a href="mailto:contato@teologiaviva.app" className="text-gold underline">
              contato@teologiaviva.app
            </a>
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            data-testid="upgrade-modal-notify"
            onClick={() => {
              window.location.href =
                'mailto:contato@teologiaviva.app?subject=Quero%20Premium%20-%20Teologia%20Viva&body=Ol%C3%A1!%20Gostaria%20de%20ser%20avisado%20quando%20o%20plano%20Premium%20estiver%20dispon%C3%ADvel.';
            }}
            className="bg-gold text-navy-dark hover:bg-gold-soft h-11 w-full"
          >
            <Sparkles size={16} className="mr-2" /> Quero ser avisado
          </Button>
          <Button
            data-testid="upgrade-modal-close"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gold/30 text-foreground hover:bg-gold/10 h-10 w-full"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
