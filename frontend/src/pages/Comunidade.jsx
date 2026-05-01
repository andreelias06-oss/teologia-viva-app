import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerTrigger } from '../components/ui/drawer';
import { Heart, HandHeart, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function Comunidade() {
  const { user, profile } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [iPrayed, setIPrayed] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [autorNome, setAutorNome] = useState('');
  const [pedido, setPedido] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('mural_oracoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setPedidos(data || []);

    if (user?.id && data?.length) {
      const ids = data.map((p) => p.id);
      const { data: inter } = await supabase
        .from('interacoes_oracao')
        .select('oracao_id')
        .eq('user_id', user.id)
        .in('oracao_id', ids);
      const map = {};
      (inter || []).forEach((i) => {
        map[i.oracao_id] = true;
      });
      setIPrayed(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const vouOrar = async (p) => {
    if (!user?.id) { toast.error('Faça login'); return; }
    if (iPrayed[p.id]) return;
    setIPrayed((m) => ({ ...m, [p.id]: true }));
    setPedidos((arr) => arr.map((x) => x.id === p.id ? { ...x, contagem_oracoes: (x.contagem_oracoes || 0) + 1 } : x));
    try {
      await supabase.from('interacoes_oracao').insert({ oracao_id: p.id, user_id: user.id });
      const novo = (p.contagem_oracoes || 0) + 1;
      await supabase.from('mural_oracoes').update({ contagem_oracoes: novo }).eq('id', p.id);
    } catch {
      // revert on failure
      setIPrayed((m) => { const c = { ...m }; delete c[p.id]; return c; });
      setPedidos((arr) => arr.map((x) => x.id === p.id ? { ...x, contagem_oracoes: Math.max(0, (x.contagem_oracoes || 1) - 1) } : x));
      toast.error('Não foi possível registrar — tente novamente');
    }
  };

  const submitPedido = async () => {
    if (!pedido.trim() || !user?.id) return;
    setSubmitting(true);
    try {
      const payload = {
        user_id: user.id,
        nome_usuario: autorNome?.trim() || profile?.nome || 'Anônimo',
        pedido: pedido.trim(),
        is_anonimo: !autorNome?.trim() && !profile?.nome,
        contagem_oracoes: 0,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('mural_oracoes').insert(payload);
      if (error) throw error;
      toast.success('Pedido publicado');
      setPedido('');
      setAutorNome('');
      setCreateOpen(false);
      await load();
    } catch (e) {
      toast.error('Falha ao publicar pedido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="page-comunidade">
      <section className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">Mural</p>
          <h2 className="font-serif text-3xl text-foreground mt-1">Comunidade</h2>
          <div className="gold-divider w-16 mt-1" />
        </div>
        <Drawer open={createOpen} onOpenChange={setCreateOpen}>
          <DrawerTrigger asChild>
            <Button data-testid="btn-novo-pedido" className="bg-gold text-navy-dark hover:bg-gold-soft h-10">
              <Plus size={16} className="mr-1" /> Pedido
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-navy-dark border-gold/20 max-w-md mx-auto">
            <DrawerHeader>
              <DrawerTitle className="font-serif text-2xl text-gold">Compartilhar pedido</DrawerTitle>
            </DrawerHeader>
            <div className="px-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs uppercase tracking-[0.15em]">Seu nome (ou anônimo)</Label>
                <Input
                  data-testid="input-pedido-nome"
                  value={autorNome}
                  onChange={(e) => setAutorNome(e.target.value)}
                  placeholder={profile?.nome || 'Anônimo'}
                  className="bg-navy-light/40 border-gold/20 text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs uppercase tracking-[0.15em]">Pedido</Label>
                <Textarea
                  data-testid="input-pedido-texto"
                  value={pedido}
                  onChange={(e) => setPedido(e.target.value)}
                  rows={5}
                  placeholder="Compartilhe seu pedido de oração…"
                  className="bg-navy-light/40 border-gold/20 text-foreground resize-none"
                />
              </div>
            </div>
            <DrawerFooter>
              <Button
                data-testid="btn-publicar-pedido"
                onClick={submitPedido}
                disabled={submitting || !pedido.trim()}
                className="bg-gold text-navy-dark hover:bg-gold-soft"
              >
                {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Publicar
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </section>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full bg-navy-light/40" />
          <Skeleton className="h-24 w-full bg-navy-light/40" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-2xl border border-gold/15 bg-navy-light/30 p-6 text-foreground/70 text-sm">
          Ainda não há pedidos. Seja o primeiro a compartilhar.
        </div>
      ) : (
        <ul className="space-y-3">
          {pedidos.map((p) => {
            const iP = !!iPrayed[p.id];
            return (
              <li
                key={p.id}
                data-testid={`pedido-${p.id}`}
                className="rounded-2xl border border-gold/15 bg-navy-light/30 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="font-serif text-base text-gold/90">{p.is_anonimo ? 'Anônimo' : (p.nome_usuario || p.autor_nome || 'Anônimo')}</p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/50">{formatDate(p.created_at)}</p>
                </div>
                <p className="text-foreground/90 font-sans leading-relaxed text-[15px] whitespace-pre-wrap">{p.pedido}</p>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1.5 text-gold/80 text-xs font-sans">
                    <Heart size={14} fill="currentColor" />
                    <span data-testid={`pedido-contador-${p.id}`}>{p.contagem_oracoes || 0} {((p.contagem_oracoes || 0) === 1) ? 'pessoa orou' : 'pessoas oraram'}</span>
                  </div>
                  <Button
                    data-testid={`btn-vou-orar-${p.id}`}
                    onClick={() => vouOrar(p)}
                    disabled={iP}
                    variant={iP ? 'default' : 'outline'}
                    size="sm"
                    className={iP
                      ? 'bg-gold text-navy-dark hover:bg-gold'
                      : 'border-gold/40 text-gold hover:bg-gold/10'}
                  >
                    <HandHeart size={14} className="mr-1.5" /> {iP ? 'Orei' : 'Vou Orar'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
