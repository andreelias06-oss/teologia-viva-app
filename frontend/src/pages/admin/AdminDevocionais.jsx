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
    <div className="space-y-6" data-testid="admin-devocionais">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl lg:text-3xl text-foreground">Devocionais</h2>
          <p className="text-xs lg:text-sm font-sans text-foreground/60 mt-0.5">
            Histórico por data — cada geração da IA cria um novo registro.
          </p>
        </div>
      </div>

      {/* Layout DESKTOP: 2 colunas (Criação 380px à esquerda + Histórico expandido à direita).
          MOBILE: empilhado em coluna única. */}
      <div className="lg:grid lg:grid-cols-[400px_1fr] lg:gap-8 lg:items-start space-y-6 lg:space-y-0">
        {/* ── COLUNA ESQUERDA: Criação com IA (sticky no desktop) ── */}
        <aside className="space-y-4">
          <div className="lg:sticky lg:top-32 space-y-4">
            {/* Banner principal — fluxo PRIMÁRIO via IA */}
            <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-navy-light/10 p-5 lg:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center shrink-0">
                  <Sparkles size={18} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-lg lg:text-xl text-foreground">Curadoria com IA</p>
                  <p className="text-xs lg:text-sm font-sans text-foreground/70 mt-1 leading-relaxed">
                    Escolha uma data, e a IA escreve um devocional cristocêntrico (versículo, reflexão, aplicação e oração) — salvo automaticamente no histórico.
                  </p>
                </div>
              </div>
              <Button
                data-testid="admin-devocionais-wizard"
                onClick={() => setWizardOpen(true)}
                className="w-full h-12 lg:h-14 bg-gold text-navy-dark hover:bg-gold-soft active:scale-[0.98] text-base"
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

            {/* Stats card (desktop only) — preenche o espaço lateral. */}
            <div className="hidden lg:block rounded-2xl border border-gold/15 bg-navy-light/20 p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gold/80 font-sans font-semibold mb-3">Resumo</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-serif text-3xl text-gold">{rows.length}</p>
                  <p className="text-xs font-sans text-foreground/60 mt-0.5">No histórico</p>
                </div>
                <div>
                  <p className="font-serif text-3xl text-gold">{rows.filter((r) => r.data >= new Date().toISOString().slice(0, 10)).length}</p>
                  <p className="text-xs font-sans text-foreground/60 mt-0.5">Agendados</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── COLUNA DIREITA: Histórico em GRID (3 colunas no desktop) ── */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold mb-3">
            Histórico ({rows.length})
          </p>
          {loading ? (
            <Skeleton className="h-32 w-full bg-navy-light/40" />
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-gold/15 bg-navy-light/20 p-8 lg:p-12 text-center">
              <p className="text-sm lg:text-base font-sans text-foreground/65">
                Nenhum devocional ainda. Comece criando o de hoje com a IA.
              </p>
            </div>
          ) : (
            <ul
              data-testid="devo-grid"
              className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            >
              {rows.map((r) => (
                <li
                  key={r.id}
                  data-testid={`admin-devo-${r.id}`}
                  className="rounded-xl border border-gold/15 bg-navy-light/30 p-4 hover:border-gold/35 transition flex flex-col gap-2 min-h-[120px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-gold/80 font-sans font-semibold">
                      {formatLongDate(r.data)}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        data-testid={`admin-devo-edit-${r.id}`}
                        onClick={() => { setEditing(r); setFormOpen(true); }}
                        className="p-1.5 text-gold/80 hover:text-gold rounded-md hover:bg-gold/10 transition"
                        aria-label="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        data-testid={`admin-devo-delete-${r.id}`}
                        onClick={() => remove(r)}
                        className="p-1.5 text-foreground/45 hover:text-destructive rounded-md hover:bg-destructive/10 transition"
                        aria-label="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="font-serif text-base text-foreground line-clamp-2 leading-snug flex-1">
                    {r.titulo}
                  </p>
                  <p className="text-xs font-sans text-gold/70 line-clamp-1 italic">
                    {r.referencia_biblica}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
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
