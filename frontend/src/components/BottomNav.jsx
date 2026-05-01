import { NavLink } from 'react-router-dom';
import { Home, GraduationCap, BookOpen, Users, MapPin } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Início', icon: Home, testid: 'tab-inicio' },
  { to: '/academia', label: 'Academia', icon: GraduationCap, testid: 'tab-academia' },
  { to: '/biblia', label: 'Bíblia', icon: BookOpen, testid: 'tab-biblia' },
  { to: '/comunidade', label: 'Comunidade', icon: Users, testid: 'tab-comunidade' },
  { to: '/eventos', label: 'Eventos', icon: MapPin, testid: 'tab-eventos' },
];

export default function BottomNav() {
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md h-[68px] glass-bottom border-t border-gold/20 z-[100]"
    >
      <ul className="flex justify-around items-stretch h-full px-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.to === '/'}
                data-testid={t.testid}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 h-full text-[10px] tracking-[0.12em] uppercase transition-all duration-300 ${
                    isActive ? 'text-gold' : 'text-foreground/55 hover:text-foreground/80'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex items-center justify-center transition-all ${
                        isActive ? 'drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]' : ''
                      }`}
                    >
                      <Icon size={22} strokeWidth={1.5} />
                    </span>
                    <span className="font-sans font-medium">{t.label}</span>
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
