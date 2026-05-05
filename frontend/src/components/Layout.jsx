import { Outlet, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { effectivePlan, trialDaysLeft } from '../lib/plan';
import { User, Sparkles } from 'lucide-react';

export default function Layout() {
  const { profile } = useAuth();
  const plan = effectivePlan(profile);
  const days = trialDaysLeft(profile);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-navy-dark flex justify-center">
      <div className="relative w-full max-w-md min-h-screen bg-gradient-to-b from-navy-dark via-navy to-navy-dark flex flex-col pb-[80px]">
        <header className="sticky top-0 z-40 px-5 pt-5 pb-3 flex items-center justify-between glass-bottom border-b border-gold/10">
          <div className="flex items-center gap-2">
            <Sparkles size={18} strokeWidth={1.5} className="text-gold" />
            <h1 className="font-serif text-lg tracking-wide text-foreground">Teologia <span className="italic text-gold">Viva</span></h1>
          </div>
          <div className="flex items-center gap-2">
            {plan === 'trial' && (
              <span data-testid="plan-badge" className="text-[10px] tracking-[0.15em] uppercase font-sans font-semibold text-gold/90 border border-gold/40 rounded-full px-2 py-1">
                Trial · {days}d
              </span>
            )}
            {plan === 'free' && (
              <span data-testid="plan-badge" className="text-[10px] tracking-[0.15em] uppercase font-sans font-semibold text-foreground/60 border border-foreground/20 rounded-full px-2 py-1">
                Free
              </span>
            )}
            {plan === 'premium' && (
              <span data-testid="plan-badge" className="text-[10px] tracking-[0.15em] uppercase font-sans font-semibold text-navy-dark bg-gold rounded-full px-2 py-1">
                Premium
              </span>
            )}
            <button
              data-testid="header-profile-btn"
              onClick={() => navigate('/perfil')}
              className="w-9 h-9 rounded-full border border-gold/40 flex items-center justify-center text-gold hover:bg-gold/10 transition active:scale-95"
              aria-label="Perfil"
            >
              <User size={16} strokeWidth={1.5} />
            </button>
          </div>
        </header>

        <main
          className="flex-1 px-5 py-5"
          style={{ contain: 'layout paint' }}
        >
          <Outlet />
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
