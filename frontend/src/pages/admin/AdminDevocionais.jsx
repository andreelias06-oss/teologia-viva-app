import { useState, useEffect } from 'react';
import { listRows, createRow, updateRow, deleteRow } from '../../lib/admin';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import AdminFormDrawer from '../../components/AdminFormDrawer';
import { toast } from 'sonner';

const FIELDS = [
  { key: 'data', label: 'Data', type: 'date', required: true },
  { key: 'titulo', label: 'Título', type: 'text', required: true },
  { key: 'versiculo_texto', label: 'Versículo (texto)', type: 'textarea', rows: 3, required: true },
  { key: 'referencia_biblica', label: 'Referência bíblica', type: 'text', required: true, hint: 'Ex.: João 3:16' },
  { key: 'reflexao', label: 'Reflexão', type: 'textarea', rows: 6, required: true },
  { key: 'oracao_sugerida', label: 'Oração sugerida', type: 'textarea', rows: 3 },
  { key: 'imagem_url', label: 'Imagem (URL)', type: 'text' },
];

function formatDate(iso) {
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return iso; }
}

export default function AdminDevocionais() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setRows(await listRows('devocionais', { col: 'data', asc: false })); }
    catch (e) { toast.error('Falha ao carregar'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (form) => {
    try {
      if (editing?.id) {
        await updateRow('devocionais', editing.id, form);
        toast.success('Devocional atualizado');
      } else {
        await createRow('devocionais', form);
        toast.success('Devocional criado');
      }
      setOpen(false);
      load();
    } catch (e) { toast.error(e.message || 'Falha ao salvar'); }
  };

  const remove = async (r) => {
    if (!window.confirm(`Excluir "${r.titulo}"?`)) return;
    try { await deleteRow('devocionais', r.id); toast.success('Excluído'); load(); }
    catch (e) { toast.error('Falha ao excluir'); }
  };

  return (
    <div className="space-y-4" data-testid="admin-devocionais">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-foreground">Devocionais</h2>
        <Button
          data-testid="admin-devocionais-novo"
          onClick={() => { setEditing(null); setOpen(true); }}
          className="bg-gold text-navy-dark hover:bg-gold-soft h-10"
        >
          <Plus size={16} className="mr-1" /> Novo
        </Button>
      </div>

      {loading ? <Skeleton className="h-20 w-full bg-navy-light/40" /> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} data-testid={`admin-devo-${r.id}`} className="rounded-xl border border-gold/15 bg-navy-light/30 p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.15em] text-gold/80 font-sans font-semibold">{formatDate(r.data)}</p>
                <p className="font-serif text-lg text-foreground truncate">{r.titulo}</p>
                <p className="text-xs font-sans text-foreground/60 line-clamp-1">{r.referencia_biblica}</p>
              </div>
              <button data-testid={`admin-devo-edit-${r.id}`} onClick={() => { setEditing(r); setOpen(true); }} className="p-2 text-gold/80 hover:text-gold"><Pencil size={16} /></button>
              <button data-testid={`admin-devo-delete-${r.id}`} onClick={() => remove(r)} className="p-2 text-foreground/50 hover:text-destructive"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      <AdminFormDrawer
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? 'Editar Devocional' : 'Novo Devocional'}
        fields={FIELDS}
        initial={editing || { data: new Date().toISOString().slice(0, 10) }}
        onSave={save}
      />
    </div>
  );
}
