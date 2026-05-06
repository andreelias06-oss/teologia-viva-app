import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isAdmin } from '../../lib/admin';
import { ArrowLeft, Shield } from 'lucide-react';

const TABS = [
  { to: '/admin/devocionais', label: 'Devocionais', testid: 'admin-tab-devocionais' },
  { to: '/admin/eixos', label: 'Eixos', testid: 'admin-tab-eixos' },
  { to: '/admin/cursos', label: 'Cursos', testid: 'admin-tab-cursos' },
  { to: '/admin/aulas', label: 'Aulas', testid: 'admin-tab-aulas' },
  { to: '/admin/eventos', label: 'Eventos', testid: 'admin-tab-eventos' },
  { to: '/admin/configuracoes', label: 'Configurações', testid: 'admin-tab-configuracoes' },
];

export default function AdminLayout() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-navy-dark font-serif italic text-gold animate-pulse">Carregando…</div>;
  }
  if (!isAdmin(profile)) {
    return (
      <div className="min-h-screen w-full bg-navy-dark flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <Shield size={32} strokeWidth={1.4} className="text-gold mx-auto" />
          <h3 className="font-serif text-2xl text-foreground">Acesso Restrito</h3>
          <p className="text-foreground/70 text-sm font-sans">Este painel é reservado a curadores do Teologia Viva.</p>
          <button onClick={() => navigate('/')} data-testid="admin-back-to-app" className="text-gold text-sm underline">Voltar ao app</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-navy-dark">
      {/* Curadoria FULL-WIDTH no desktop. Mobile mantém max-w-md centralizado para
          conforto de leitura; lg+ ocupa toda a largura disponível menos a sidebar. */}
      <div className="w-full max-w-md lg:max-w-none lg:ml-16 mx-auto lg:mx-0 min-h-screen bg-gradient-to-b from-navy-dark via-navy to-navy-dark flex flex-col">
        <header className="sticky top-0 z-40 px-5 lg:px-10 pt-5 pb-3 glass-bottom border-b border-gold/10">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/perfil')} data-testid="admin-back" className="flex items-center gap-1 text-foreground/70 hover:text-gold text-sm transition">
              <ArrowLeft size={16} /> App
            </button>
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-gold" />
              <h1 className="font-serif text-lg lg:text-xl tracking-wide text-gold">Curadoria</h1>
            </div>
            <span className="text-[10px] uppercase tracking-[0.15em] font-sans font-semibold text-navy-dark bg-gold rounded-full px-2 py-1">Admin</span>
          </div>
          <nav className="mt-4 -mx-5 lg:-mx-10 px-5 lg:px-10 overflow-x-auto no-scrollbar">
            <ul className="flex gap-2">
              {TABS.map((t) => (
                <li key={t.to}>
                  <NavLink
                    to={t.to}
                    data-testid={t.testid}
                    className={({ isActive }) =>
                      `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-sans tracking-wide uppercase transition ${
                        isActive
                          ? 'bg-gold text-navy-dark border-gold font-semibold'
                          : 'border-gold/30 text-foreground/75 hover:border-gold/60'
                      }`
                    }
                  >
                    {t.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="flex-1 px-5 lg:px-10 py-5 lg:py-8 pb-8 animate-fade-up">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
