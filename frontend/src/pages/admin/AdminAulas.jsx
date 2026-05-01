import { useState, useEffect, useMemo } from 'react';
import { listRows, createRow, updateRow, deleteRow } from '../../lib/admin';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import AdminFormDrawer from '../../components/AdminFormDrawer';
import { toast } from 'sonner';

export default function AdminAulas() {
  const [rows, setRows] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [filtroCurso, setFiltroCurso] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([
        listRows('aulas', { col: 'id', asc: true }),
        listRows('cursos', { col: 'id', asc: true }),
      ]);
      setRows(a); setCursos(c);
    } catch { toast.error('Falha ao carregar'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const fields = useMemo(() => [
    { key: 'titulo', label: 'Título', type: 'text', required: true },
    { key: 'curso_id', label: 'Curso', type: 'select', options: cursos.map((c) => ({ value: c.id, label: c.titulo })), required: true },
    { key: 'ordem', label: 'Ordem', type: 'number', required: true, hint: 'Posição na lista de aulas do curso (1, 2, 3…)' },
    { key: 'leitura_biblica', label: 'Leitura bíblica', type: 'text', hint: 'Ex.: João 3:16-21' },
    { key: 'url_video', label: 'URL do vídeo (YouTube)', type: 'text' },
    { key: 'conteudo_texto', label: 'Texto de apoio', type: 'textarea', rows: 7 },
    { key: 'descricao', label: 'Descrição curta', type: 'textarea', rows: 2 },
    { key: 'categoria', label: 'Categoria', type: 'text' },
    { key: 'is_premium', label: 'Premium?', type: 'boolean' },
  ], [cursos]);

  const nameOfCurso = (id) => cursos.find((c) => String(c.id) === String(id))?.titulo || '—';
  const filtered = filtroCurso ? rows.filter((r) => String(r.curso_id) === String(filtroCurso)) : rows;

  const save = async (form) => {
    try {
      const payload = {
        ...form,
        curso_id: form.curso_id ? Number(form.curso_id) : null,
        ordem: form.ordem ? Number(form.ordem) : null,
      };
      if (editing?.id) await updateRow('aulas', editing.id, payload);
      else await createRow('aulas', payload);
      toast.success('Salvo'); setOpen(false); load();
    } catch (e) { toast.error(e.message || 'Falha'); }
  };

  const remove = async (r) => {
    if (!window.confirm(`Excluir "${r.titulo}"?`)) return;
    try { await deleteRow('aulas', r.id); toast.success('Excluída'); load(); }
    catch { toast.error('Falha'); }
  };

  return (
    <div className="space-y-4" data-testid="admin-aulas">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-2xl text-foreground">Aulas</h2>
        <Button data-testid="admin-aulas-nova" onClick={() => { setEditing(null); setOpen(true); }} className="bg-gold text-navy-dark hover:bg-gold-soft h-10">
          <Plus size={16} className="mr-1" /> Nova
        </Button>
      </div>

      <select
        data-testid="admin-aulas-filtro-curso"
        value={filtroCurso}
        onChange={(e) => setFiltroCurso(e.target.value)}
        className="w-full h-10 rounded-md bg-navy-light/40 border border-gold/20 text-foreground px-3 text-sm"
      >
        <option value="">Todos os cursos</option>
        {cursos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
      </select>

      {loading ? <Skeleton className="h-20 w-full bg-navy-light/40" /> : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id} data-testid={`admin-aula-${r.id}`} className="rounded-xl border border-gold/15 bg-navy-light/30 p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-gold/70">#{r.ordem ?? '—'}</span>
                  <p className="font-serif text-lg text-foreground truncate">{r.titulo}</p>
                  {r.is_premium && <span className="text-[9px] uppercase tracking-[0.15em] text-gold border border-gold/40 rounded-full px-1.5 py-0.5">Premium</span>}
                </div>
                <p className="text-[11px] font-sans text-foreground/55 mt-0.5">{nameOfCurso(r.curso_id)}</p>
              </div>
              <button data-testid={`admin-aula-edit-${r.id}`} onClick={() => { setEditing(r); setOpen(true); }} className="p-2 text-gold/80 hover:text-gold"><Pencil size={16} /></button>
              <button data-testid={`admin-aula-delete-${r.id}`} onClick={() => remove(r)} className="p-2 text-foreground/50 hover:text-destructive"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      <AdminFormDrawer
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? 'Editar Aula' : 'Nova Aula'}
        fields={fields}
        initial={editing || { is_premium: false, ordem: 1 }}
        onSave={save}
      />
    </div>
  );
}
