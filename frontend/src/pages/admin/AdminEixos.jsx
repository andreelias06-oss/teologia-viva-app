import { useState, useEffect } from 'react';
import { listRows, createRow, updateRow, deleteRow } from '../../lib/admin';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import AdminFormDrawer from '../../components/AdminFormDrawer';
import { toast } from 'sonner';

const FIELDS = [
  { key: 'nome', label: 'Nome', type: 'text', required: true },
  { key: 'descricao', label: 'Descrição', type: 'textarea', rows: 3 },
];

export default function AdminEixos() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setRows(await listRows('eixos', { col: 'id', asc: true })); } catch { toast.error('Falha ao carregar'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (form) => {
    try {
      if (editing?.id) await updateRow('eixos', editing.id, form);
      else await createRow('eixos', form);
      toast.success('Salvo');
      setOpen(false); load();
    } catch (e) { toast.error(e.message || 'Falha'); }
  };

  const remove = async (r) => {
    if (!window.confirm(`Excluir "${r.nome}"? Cursos ligados podem ser afetados.`)) return;
    try { await deleteRow('eixos', r.id); toast.success('Excluído'); load(); }
    catch (e) { toast.error('Falha — verifique dependências'); }
  };

  return (
    <div className="space-y-4" data-testid="admin-eixos">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-foreground">Eixos</h2>
        <Button data-testid="admin-eixos-novo" onClick={() => { setEditing(null); setOpen(true); }} className="bg-gold text-navy-dark hover:bg-gold-soft h-10">
          <Plus size={16} className="mr-1" /> Novo
        </Button>
      </div>

      {loading ? <Skeleton className="h-20 w-full bg-navy-light/40" /> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} data-testid={`admin-eixo-${r.id}`} className="rounded-xl border border-gold/15 bg-navy-light/30 p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-serif text-lg text-foreground">{r.nome}</p>
                {r.descricao && <p className="text-xs font-sans text-foreground/60 line-clamp-2 mt-0.5">{r.descricao}</p>}
              </div>
              <button data-testid={`admin-eixo-edit-${r.id}`} onClick={() => { setEditing(r); setOpen(true); }} className="p-2 text-gold/80 hover:text-gold"><Pencil size={16} /></button>
              <button data-testid={`admin-eixo-delete-${r.id}`} onClick={() => remove(r)} className="p-2 text-foreground/50 hover:text-destructive"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      <AdminFormDrawer
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? 'Editar Eixo' : 'Novo Eixo'}
        fields={FIELDS}
        initial={editing || {}}
        onSave={save}
      />
    </div>
  );
}
