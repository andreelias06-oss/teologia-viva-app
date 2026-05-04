import { supabase } from './supabase';

export function isAdmin(profile) {
  return profile?.role === 'admin';
}

// Limpa strings vazias → null para evitar erros de tipo no PostgREST
function clean(payload) {
  const out = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (typeof v === 'string') {
      const t = v.trim();
      out[k] = t === '' ? null : t;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// CRUD genérico para o painel de administração.
export async function listRows(table, orderBy = { col: 'id', asc: true }) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(orderBy.col, { ascending: orderBy.asc });
  if (error) throw error;
  return data || [];
}

// IMPORTANTE: NÃO encadear `.select().single()` após `.insert()` / `.update()`.
// Esse padrão pode disparar "body stream already read" no Safari/Chrome quando o
// PostgREST devolve representação parcial ou erro intermediário. Em vez disso,
// usamos `.select()` (sem `.single()`) e devolvemos o primeiro registro.
export async function createRow(table, payload) {
  const { data, error } = await supabase
    .from(table)
    .insert(clean(payload))
    .select();
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

export async function updateRow(table, id, payload) {
  const { data, error } = await supabase
    .from(table)
    .update(clean(payload))
    .eq('id', id)
    .select();
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}
