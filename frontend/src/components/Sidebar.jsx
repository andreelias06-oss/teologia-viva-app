import { NavLink } from 'react-router-dom';
import { Home, GraduationCap, BookOpen, Users, MapPin } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Início', icon: Home, testid: 'side-inicio' },
  { to: '/academia', label: 'Academia', icon: GraduationCap, testid: 'side-academia' },
  { to: '/biblia', label: 'Bíblia', icon: BookOpen, testid: 'side-biblia' },
  { to: '/comunidade', label: 'Comunidade', icon: Users, testid: 'side-comunidade' },
  { to: '/eventos', label: 'Eventos', icon: MapPin, testid: 'side-eventos' },
];

/**
 * Sidebar lateral esquerda — visível só em telas lg+ (≥1024px).
 * Design minimalista: ícones pequenos, label revela em hover/active.
 * Largura colapsada: 64px (rail).
 */
export default function Sidebar() {
  return (
    <nav
      data-testid="sidebar-nav"
      aria-label="Navegação principal"
      className="hidden lg:flex fixed top-0 left-0 h-screen w-16 flex-col items-center py-6 z-40 border-r border-gold/15 bg-navy-dark/85 backdrop-blur-md"
    >
      {/* Logo mark */}
      <div className="w-10 h-10 rounded-full border border-gold/30 flex items-center justify-center text-gold mb-8 select-none">
        <span className="font-serif italic text-base">Tv</span>
      </div>

      <ul className="flex flex-col gap-1 w-full px-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.to === '/'}
                data-testid={t.testid}
                className={({ isActive }) =>
                  `group relative w-full h-11 rounded-lg flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-gold/15 text-gold'
                      : 'text-foreground/55 hover:text-foreground hover:bg-gold/5'
                  }`
                }
                aria-label={t.label}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                    {/* Active indicator — small gold dot à esquerda */}
                    {isActive ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gold"
                      />
                    ) : null}
                    {/* Tooltip-label no hover */}
                    <span
                      className="pointer-events-none absolute left-[60px] z-50 px-2 py-1 rounded-md text-[11px] font-sans tracking-wide bg-navy-dark border border-gold/30 text-foreground whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition"
                    >
                      {t.label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
