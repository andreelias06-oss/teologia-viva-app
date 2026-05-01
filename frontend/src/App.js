import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import Layout from './components/Layout';
import AuthPage from './pages/Auth';
import Inicio from './pages/Inicio';
import Academia from './pages/Academia';
import Curso from './pages/Curso';
import Aula from './pages/Aula';
import Biblia from './pages/Biblia';
import Comunidade from './pages/Comunidade';
import Eventos from './pages/Eventos';
import Anotacoes from './pages/Anotacoes';
import Perfil from './pages/Perfil';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-dark">
        <div className="font-serif italic text-gold animate-pulse">Teologia Viva…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/auth"
              element={
                <PublicOnly>
                  <AuthPage />
                </PublicOnly>
              }
            />
            <Route
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route path="/" element={<Inicio />} />
              <Route path="/academia" element={<Academia />} />
              <Route path="/curso/:id" element={<Curso />} />
              <Route path="/aula/:id" element={<Aula />} />
              <Route path="/biblia" element={<Biblia />} />
              <Route path="/comunidade" element={<Comunidade />} />
              <Route path="/eventos" element={<Eventos />} />
              <Route path="/anotacoes" element={<Anotacoes />} />
              <Route path="/perfil" element={<Perfil />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="bottom-center" duration={2500} />
      </AuthProvider>
    </div>
  );
}

export default App;
