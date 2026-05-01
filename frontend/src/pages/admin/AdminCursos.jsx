import { useState, useEffect, useMemo } from 'react';
import { listRows, createRow, updateRow, deleteRow } from '../../lib/admin';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import AdminFormDrawer from '../../components/AdminFormDrawer';
import { toast } from 'sonner';

export default function AdminCursos() {
  const [rows, setRows] = useState([]);
  const [eixos, setEixos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, e] = await Promise.all([
        listRows('cursos', { col: 'id', asc: true }),
        listRows('eixos', { col: 'id', asc: true }),
      ]);
      setRows(c); setEixos(e);
    } catch { toast.error('Falha ao carregar'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const fields = useMemo(() => [
    { key: 'titulo', label: 'Título', type: 'text', required: true },
    { key: 'descricao', label: 'Descrição', type: 'textarea', rows: 3 },
    { key: 'eixo_id', label: 'Eixo', type: 'select', options: eixos.map((e) => ({ value: e.id, label: e.nome })), required: true },
    { key: 'imagem_capa', label: 'Imagem capa (URL)', type: 'text' },
    { key: 'is_premium', label: 'Premium?', type: 'boolean' },
  ], [eixos]);

  const nameOfEixo = (id) => eixos.find((e) => String(e.id) === String(id))?.nome || '—';

  const save = async (form) => {
    try {
      const payload = { ...form, eixo_id: form.eixo_id ? Number(form.eixo_id) : null };
      if (editing?.id) await updateRow('cursos', editing.id, payload);
      else await createRow('cursos', payload);
      toast.success('Salvo'); setOpen(false); load();
    } catch (e) { toast.error(e.message || 'Falha'); }
  };

  const remove = async (r) => {
    if (!window.confirm(`Excluir "${r.titulo}"?`)) return;
    try { await deleteRow('cursos', r.id); toast.success('Excluído'); load(); }
    catch { toast.error('Falha — verifique aulas dependentes'); }
  };

  return (
    <div className="space-y-4" data-testid="admin-cursos">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-foreground">Cursos</h2>
        <Button data-testid="admin-cursos-novo" onClick={() => { setEditing(null); setOpen(true); }} className="bg-gold text-navy-dark hover:bg-gold-soft h-10">
          <Plus size={16} className="mr-1" /> Novo
        </Button>
      </div>

      {loading ? <Skeleton className="h-20 w-full bg-navy-light/40" /> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} data-testid={`admin-curso-${r.id}`} className="rounded-xl border border-gold/15 bg-navy-light/30 p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-serif text-lg text-foreground truncate">{r.titulo}</p>
                  {r.is_premium && <span className="text-[9px] uppercase tracking-[0.15em] text-gold border border-gold/40 rounded-full px-1.5 py-0.5">Premium</span>}
                </div>
                <p className="text-[11px] font-sans text-foreground/55 mt-0.5">{nameOfEixo(r.eixo_id)}</p>
                {r.descricao && <p className="text-xs font-sans text-foreground/60 line-clamp-2 mt-0.5">{r.descricao}</p>}
              </div>
              <button data-testid={`admin-curso-edit-${r.id}`} onClick={() => { setEditing(r); setOpen(true); }} className="p-2 text-gold/80 hover:text-gold"><Pencil size={16} /></button>
              <button data-testid={`admin-curso-delete-${r.id}`} onClick={() => remove(r)} className="p-2 text-foreground/50 hover:text-destructive"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      <AdminFormDrawer
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? 'Editar Curso' : 'Novo Curso'}
        fields={fields}
        initial={editing || { is_premium: false }}
        onSave={save}
      />
    </div>
  );
}
