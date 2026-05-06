import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '../components/ui/drawer';
import { Plus, NotebookPen, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function Anotacoes() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('anotacoes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setItems(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!conteudo.trim()) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        titulo: titulo.trim() || 'Sem título',
        conteudo: conteudo.trim(),
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('anotacoes').insert(payload);
      if (error) throw error;
      toast.success('Anotação salva');
      setTitulo(''); setConteudo(''); setOpen(false);
      await load();
    } catch (e) {
      toast.error('Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setItems((arr) => arr.filter((x) => x.id !== id));
    try {
      await supabase.from('anotacoes').delete().eq('id', id).eq('user_id', user.id);
    } catch {
      toast.error('Não foi possível excluir');
      load();
    }
  };

  return (
    <div className="space-y-5" data-testid="page-anotacoes">
      <button onClick={() => navigate('/perfil')} className="flex items-center gap-1 text-foreground/70 hover:text-gold text-sm">
        <ArrowLeft size={16} /> Perfil
      </button>

      <section className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">Suas reflexões</p>
          <h2 className="font-serif text-3xl text-foreground mt-1">Anotações</h2>
          <div className="gold-divider w-16 mt-1" />
        </div>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button data-testid="btn-nova-anotacao" className="bg-gold text-navy-dark hover:bg-gold-soft h-10">
              <Plus size={16} className="mr-1" /> Nova
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-navy-dark border-gold/20 max-w-md mx-auto">
            <DrawerHeader>
              <DrawerTitle className="font-serif text-2xl text-gold">Nova anotação</DrawerTitle>
            </DrawerHeader>
            <div className="px-5 space-y-4">
              <Input
                data-testid="input-anotacao-titulo"
                placeholder="Título"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="bg-navy-light/40 border-gold/20 text-foreground"
              />
              <Textarea
                data-testid="input-anotacao-conteudo"
                placeholder="Escreva sua reflexão…"
                rows={8}
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                className="bg-navy-light/40 border-gold/20 text-foreground resize-none"
              />
            </div>
            <DrawerFooter>
              <Button
                data-testid="btn-salvar-anotacao"
                onClick={save}
                disabled={saving || !conteudo.trim()}
                className="bg-gold text-navy-dark hover:bg-gold-soft"
              >
                {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null} Salvar
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </section>

      {loading ? (
        <Skeleton className="h-24 w-full bg-navy-light/40" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gold/15 bg-navy-light/30 p-6 text-foreground/70 text-sm flex items-center gap-3">
          <NotebookPen size={18} className="text-gold" />
          Nenhuma anotação ainda. Toque em "Nova" para começar.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} data-testid={`anotacao-${a.id}`} className="rounded-2xl border border-gold/15 bg-navy-light/30 p-5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-serif text-xl text-foreground">{a.titulo}</h3>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/50 mt-0.5">{formatDate(a.created_at)}</p>
                </div>
                <button
                  onClick={() => remove(a.id)}
                  data-testid={`btn-excluir-anotacao-${a.id}`}
                  className="text-foreground/50 hover:text-destructive transition p-1"
                  aria-label="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-foreground/85 font-sans leading-relaxed text-[15px] whitespace-pre-wrap">{a.conteudo}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
