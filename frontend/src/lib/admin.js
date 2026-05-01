import { supabase } from './supabase';

export function isAdmin(profile) {
  return profile?.role === 'admin';
}

// Generic CRUD helpers for the admin panel.
export async function listRows(table, orderBy = { col: 'id', asc: true }) {
  const { data, error } = await supabase.from(table).select('*').order(orderBy.col, { ascending: orderBy.asc });
  if (error) throw error;
  return data || [];
}

export async function createRow(table, payload) {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateRow(table, id, payload) {
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}
