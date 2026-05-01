import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from './ui/drawer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// fields: [{ key, label, type: 'text'|'textarea'|'number'|'boolean'|'date'|'select', options?, required? }]
export default function AdminFormDrawer({ open, onOpenChange, title, fields, initial, onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial || {});
  }, [open, initial]);

  const submit = async () => {
    for (const f of fields) {
      if (f.required && !form[f.key] && form[f.key] !== 0 && form[f.key] !== false) {
        toast.error(`Campo "${f.label}" é obrigatório`);
        return;
      }
    }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-navy-dark border-gold/20 max-w-md mx-auto max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="font-serif text-2xl text-gold">{title}</DrawerTitle>
        </DrawerHeader>
        <div className="px-5 space-y-4 overflow-y-auto pb-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-foreground/80 text-xs uppercase tracking-[0.15em] flex items-center gap-1">
                {f.label}{f.required && <span className="text-gold">*</span>}
              </Label>
              {f.type === 'textarea' ? (
                <Textarea
                  data-testid={`admin-field-${f.key}`}
                  value={form[f.key] || ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  rows={f.rows || 4}
                  className="bg-navy-light/40 border-gold/20 text-foreground resize-none"
                />
              ) : f.type === 'boolean' ? (
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    data-testid={`admin-field-${f.key}`}
                    checked={!!form[f.key]}
                    onCheckedChange={(v) => setForm({ ...form, [f.key]: v })}
                  />
                  <span className="text-sm text-foreground/70">{form[f.key] ? 'Sim' : 'Não'}</span>
                </div>
              ) : f.type === 'select' ? (
                <select
                  data-testid={`admin-field-${f.key}`}
                  value={form[f.key] || ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full h-10 rounded-md bg-navy-light/40 border border-gold/20 text-foreground px-3 text-sm"
                >
                  <option value="">— selecione —</option>
                  {(f.options || []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <Input
                  data-testid={`admin-field-${f.key}`}
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : 'text'}
                  value={form[f.key] ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, [f.key]: f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })
                  }
                  className="bg-navy-light/40 border-gold/20 text-foreground"
                />
              )}
              {f.hint && <p className="text-[11px] text-foreground/50 font-sans">{f.hint}</p>}
            </div>
          ))}
        </div>
        <DrawerFooter>
          <Button
            data-testid="admin-form-save"
            onClick={submit}
            disabled={saving}
            className="bg-gold text-navy-dark hover:bg-gold-soft active:scale-[0.98]"
          >
            {saving && <Loader2 size={16} className="animate-spin mr-2" />} Salvar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
