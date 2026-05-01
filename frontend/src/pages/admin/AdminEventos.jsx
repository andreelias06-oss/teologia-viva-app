import { useState, useEffect } from 'react';
import { listRows, createRow, updateRow, deleteRow } from '../../lib/admin';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import AdminFormDrawer from '../../components/AdminFormDrawer';
import { toast } from 'sonner';

const FIELDS = [
  { key: 'titulo', label: 'Título', type: 'text', required: true },
  { key: 'descricao', label: 'Descrição', type: 'textarea', rows: 3 },
  { key: 'tipo_evento', label: 'Tipo', type: 'select', options: [
    { value: 'culto', label: 'Culto' },
    { value: 'oracao', label: 'Oração' },
    { value: 'estudo', label: 'Estudo bíblico' },
    { value: 'retiro', label: 'Retiro' },
    { value: 'outro', label: 'Outro' },
  ]},
  { key: 'data_evento', label: 'Data e hora', type: 'datetime', required: true },
  { key: 'endereco', label: 'Endereço', type: 'text', required: true },
  { key: 'latitude', label: 'Latitude', type: 'number', required: true, hint: 'Ex.: -23.5505' },
  { key: 'longitude', label: 'Longitude', type: 'number', required: true, hint: 'Ex.: -46.6333' },
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'approved', label: 'Aprovado (visível)' },
    { value: 'pending', label: 'Pendente' },
    { value: 'rejected', label: 'Rejeitado' },
  ]},
];

function parseLatLon(localizacao) {
  if (typeof localizacao !== 'string') return { latitude: '', longitude: '' };
  const m = localizacao.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/i);
  if (!m) return { latitude: '', longitude: '' };
  return { longitude: Number(m[1]), latitude: Number(m[2]) };
}

function formatDate(iso) {
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
}

export default function AdminEventos() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setRows(await listRows('eventos_comunidade', { col: 'data_evento', asc: false })); } catch { toast.error('Falha ao carregar'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (form) => {
    try {
      const { latitude, longitude, ...rest } = form;
      const payload = {
        ...rest,
        admin_id: user?.id,
        localizacao: `POINT(${Number(longitude)} ${Number(latitude)})`,
        status: form.status || 'approved',
      };
      if (editing?.id) await updateRow('eventos_comunidade', editing.id, payload);
      else await createRow('eventos_comunidade', payload);
      toast.success('Salvo'); setOpen(false); load();
    } catch (e) { toast.error(e.message || 'Falha'); }
  };

  const remove = async (r) => {
    if (!window.confirm(`Excluir "${r.titulo}"?`)) return;
    try { await deleteRow('eventos_comunidade', r.id); toast.success('Excluído'); load(); }
    catch { toast.error('Falha'); }
  };

  const openEdit = (r) => {
    const { latitude, longitude } = parseLatLon(r.localizacao);
    const dt = r.data_evento ? new Date(r.data_evento).toISOString().slice(0, 16) : '';
    setEditing({ ...r, latitude, longitude, data_evento: dt });
    setOpen(true);
  };

  return (
    <div className="space-y-4" data-testid="admin-eventos">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-foreground">Eventos</h2>
        <Button data-testid="admin-eventos-novo" onClick={() => { setEditing(null); setOpen(true); }} className="bg-gold text-navy-dark hover:bg-gold-soft h-10">
          <Plus size={16} className="mr-1" /> Novo
        </Button>
      </div>

      {loading ? <Skeleton className="h-20 w-full bg-navy-light/40" /> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} data-testid={`admin-evento-${r.id}`} className="rounded-xl border border-gold/15 bg-navy-light/30 p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-serif text-lg text-foreground truncate">{r.titulo}</p>
                  <span className={`text-[9px] uppercase tracking-[0.15em] rounded-full px-1.5 py-0.5 ${
                    r.status === 'approved' ? 'text-gold border border-gold/40' : 'text-foreground/60 border border-foreground/20'
                  }`}>{r.status}</span>
                </div>
                <p className="text-[11px] font-sans text-foreground/55 mt-0.5 flex items-center gap-1">
                  <MapPin size={10} className="text-gold" /> {r.endereco} · {formatDate(r.data_evento)}
                </p>
              </div>
              <button data-testid={`admin-evento-edit-${r.id}`} onClick={() => openEdit(r)} className="p-2 text-gold/80 hover:text-gold"><Pencil size={16} /></button>
              <button data-testid={`admin-evento-delete-${r.id}`} onClick={() => remove(r)} className="p-2 text-foreground/50 hover:text-destructive"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      <AdminFormDrawer
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? 'Editar Evento' : 'Novo Evento'}
        fields={FIELDS}
        initial={editing || { status: 'approved', tipo_evento: 'culto' }}
        onSave={save}
      />
    </div>
  );
}
