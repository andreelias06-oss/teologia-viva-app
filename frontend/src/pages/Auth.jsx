import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn({ email, password });
        toast.success('Bem-vindo de volta');
        navigate('/', { replace: true });
      } else {
        const result = await signUp({ email, password, nome });
        if (result?.needsEmailConfirmation) {
          toast.success('Conta criada! Confirme seu email para entrar.', { duration: 6000 });
          setMode('login');
        } else {
          toast.success('Conta criada — seu trial de 7 dias começou');
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      const msg = err?.message || 'Falha na autenticação';
      if (msg.toLowerCase().includes('email_not_confirmed') || msg.toLowerCase().includes('email not confirmed')) {
        toast.error('Confirme seu email antes de entrar. Verifique sua caixa de entrada.', { duration: 6000 });
      } else if (msg.toLowerCase().includes('invalid login credentials')) {
        toast.error('Email ou senha incorretos');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-navy-dark flex items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="flex items-center gap-2 mb-3 animate-fade-in">
          <Sparkles size={24} strokeWidth={1.4} className="text-gold animate-glow rounded-full" />
          <h1 className="font-serif text-4xl tracking-tight text-foreground">
            Teologia <span className="italic text-gold">Viva</span>
          </h1>
        </div>
        <p className="text-foreground/60 text-sm font-sans tracking-[0.1em] uppercase mb-10 text-center animate-fade-in">
          Devocional · Academia · Comunidade
        </p>

        <div className="w-full bg-navy-light/40 border border-gold/15 rounded-2xl p-6 backdrop-blur-sm animate-fade-up">
          <div className="flex gap-1 mb-6 bg-navy-dark/60 rounded-full p-1 border border-gold/10">
            <button
              data-testid="auth-tab-login"
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm rounded-full transition font-sans tracking-wide ${
                mode === 'login' ? 'bg-gold text-navy-dark font-semibold' : 'text-foreground/60'
              }`}
            >
              Entrar
            </button>
            <button
              data-testid="auth-tab-signup"
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-sm rounded-full transition font-sans tracking-wide ${
                mode === 'signup' ? 'bg-gold text-navy-dark font-semibold' : 'text-foreground/60'
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label htmlFor="nome" className="text-foreground/80 text-xs uppercase tracking-[0.15em]">Nome</Label>
                <Input
                  id="nome"
                  data-testid="auth-input-nome"
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="bg-navy-dark/60 border-gold/20 text-foreground"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-foreground/80 text-xs uppercase tracking-[0.15em]">Email</Label>
              <Input
                id="email"
                data-testid="auth-input-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-navy-dark/60 border-gold/20 text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-foreground/80 text-xs uppercase tracking-[0.15em]">Senha</Label>
              <Input
                id="password"
                data-testid="auth-input-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-navy-dark/60 border-gold/20 text-foreground"
              />
            </div>

            <Button
              data-testid="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-gold hover:bg-gold-soft text-navy-dark h-12 text-base font-semibold tracking-wide active:scale-[0.98]"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : mode === 'login' ? 'Entrar' : 'Começar trial de 7 dias'}
            </Button>
          </form>

          {mode === 'signup' && (
            <p className="text-foreground/50 text-xs mt-4 text-center font-sans">
              Acesso completo por 7 dias. Sem cartão de crédito.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
