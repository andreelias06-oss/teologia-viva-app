import { useState, useEffect } from 'react';
import { listRows, createRow, updateRow, deleteRow } from '../../lib/admin';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Plus, Pencil, Trash2, Sparkles, Pen } from 'lucide-react';
import AdminFormDrawer from '../../components/AdminFormDrawer';
import DevocionalAIWizard from '../../components/DevocionalAIWizard';
import { toast } from 'sonner';

const FIELDS = [
  { key: 'data', label: 'Data', type: 'date', required: true },
  { key: 'titulo', label: 'Título', type: 'text', required: true },
  { key: 'versiculo_texto', label: 'Versículo (texto)', type: 'textarea', rows: 3, required: true },
  { key: 'referencia_biblica', label: 'Referência bíblica', type: 'text', required: true, hint: 'Ex.: João 3:16' },
  { key: 'reflexao', label: 'Reflexão & Aplicação', type: 'textarea', rows: 6, required: true },
  { key: 'oracao_sugerida', label: 'Oração sugerida', type: 'textarea', rows: 3 },
  { key: 'imagem_url', label: 'Imagem (URL)', type: 'text' },
];

function formatDate(iso) {
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR'); } catch { return iso; }
}

function formatLongDate(iso) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  } catch { return iso; }
}

export default function AdminDevocionais() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setRows(await listRows('devocionais', { col: 'data', asc: false })); }
    catch { toast.error('Falha ao carregar'); }
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
      setFormOpen(false);
      load();
    } catch (e) { toast.error(e.message || 'Falha ao salvar'); }
  };

  const remove = async (r) => {
    if (!window.confirm(`Excluir devocional de ${formatDate(r.data)}?`)) return;
    try { await deleteRow('devocionais', r.id); toast.success('Excluído'); load(); }
    catch { toast.error('Falha ao excluir'); }
  };

  // Wizard "Editar manualmente" → abre o form com os dados que a IA acabou de gerar.
  const handleWizardEdit = (devocional) => {
    setEditing(devocional);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4" data-testid="admin-devocionais">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Devocionais</h2>
          <p className="text-xs font-sans text-foreground/60 mt-0.5">Histórico por data — cada geração da IA cria um novo registro.</p>
        </div>
      </div>

      {/* Banner principal — fluxo PRIMÁRIO via IA */}
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-navy-light/10 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif text-lg text-foreground">Curadoria com IA</p>
            <p className="text-xs font-sans text-foreground/70 mt-0.5">
              Escolha uma data, e a IA escreve um devocional cristocêntrico (versículo, reflexão, aplicação e oração) — salvo automaticamente no histórico.
            </p>
          </div>
        </div>
        <Button
          data-testid="admin-devocionais-wizard"
          onClick={() => setWizardOpen(true)}
          className="w-full h-12 bg-gold text-navy-dark hover:bg-gold-soft active:scale-[0.98]"
        >
          <Sparkles size={16} className="mr-2" /> Criar com IA
        </Button>
        <button
          type="button"
          data-testid="toggle-manual"
          onClick={() => setShowManual((v) => !v)}
          className="w-full text-[11px] font-sans tracking-[0.12em] uppercase text-foreground/55 hover:text-gold/80 transition flex items-center justify-center gap-1 py-1"
        >
          <Pen size={11} /> {showManual ? 'Ocultar edição manual' : 'Editar manualmente'}
        </button>
        {showManual && (
          <Button
            data-testid="admin-devocionais-novo"
            onClick={() => { setEditing(null); setFormOpen(true); }}
            variant="outline"
            className="w-full h-10 border-gold/30 text-foreground hover:bg-gold/10"
          >
            <Plus size={14} className="mr-1" /> Novo devocional manual
          </Button>
        )}
      </div>

      {/* Histórico */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-2">
          Histórico ({rows.length})
        </p>
        {loading ? (
          <Skeleton className="h-20 w-full bg-navy-light/40" />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-gold/15 bg-navy-light/20 p-6 text-center">
            <p className="text-sm font-sans text-foreground/65">Nenhum devocional ainda. Comece criando o de hoje com a IA.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                data-testid={`admin-devo-${r.id}`}
                className="rounded-xl border border-gold/15 bg-navy-light/30 p-4 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-gold/80 font-sans font-semibold">
                    {formatLongDate(r.data)}
                  </p>
                  <p className="font-serif text-lg text-foreground truncate">{r.titulo}</p>
                  <p className="text-xs font-sans text-foreground/60 line-clamp-1">{r.referencia_biblica}</p>
                </div>
                <button
                  data-testid={`admin-devo-edit-${r.id}`}
                  onClick={() => { setEditing(r); setFormOpen(true); }}
                  className="p-2 text-gold/80 hover:text-gold"
                  aria-label="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  data-testid={`admin-devo-delete-${r.id}`}
                  onClick={() => remove(r)}
                  className="p-2 text-foreground/50 hover:text-destructive"
                  aria-label="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Wizard fullscreen */}
      <DevocionalAIWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSaved={load}
        onEdit={handleWizardEdit}
      />

      {/* Editor manual */}
      <AdminFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing?.id ? 'Editar Devocional' : 'Novo Devocional'}
        fields={FIELDS}
        initial={editing || { data: new Date().toISOString().slice(0, 10) }}
        onSave={save}
      />
    </div>
  );
}
