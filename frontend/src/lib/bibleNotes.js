import { supabase } from './supabase';

// Load all notes/highlights/bookmarks for a given book+chapter for the current user.
export async function loadChapterNotes({ userId, bookId, chapter }) {
  if (!userId) return {};
  const { data, error } = await supabase
    .from('anotacoes_biblia')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .eq('chapter', chapter);
  if (error) return {};
  const map = {};
  (data || []).forEach((row) => { map[row.verse] = row; });
  return map; // key = verse number → row
}

// Upsert only the fields passed in `patch`. Keeps other fields intact by read-then-write.
export async function upsertVerseNote({ userId, bookId, bookNome, chapter, verse, verseText, patch }) {
  if (!userId) throw new Error('not authenticated');
  const base = {
    user_id: userId,
    book_id: bookId,
    book_nome: bookNome,
    chapter,
    verse,
    verse_text: verseText,
  };
  // Read existing to merge with patch
  const { data: existingArr } = await supabase
    .from('anotacoes_biblia')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .eq('chapter', chapter)
    .eq('verse', verse)
    .limit(1);
  const existing = (existingArr && existingArr[0]) || null;
  const merged = { ...(existing || {}), ...base, ...patch };

  // If everything is empty, delete the row
  if (!merged.color && !merged.observacao && !merged.favorito_lista) {
    if (existing) {
      await supabase.from('anotacoes_biblia').delete().eq('id', existing.id);
    }
    return null;
  }

  const { data, error } = await supabase
    .from('anotacoes_biblia')
    .upsert(merged, { onConflict: 'user_id,book_id,chapter,verse' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listFavoritos(userId, lista) {
  if (!userId) return [];
  let q = supabase.from('anotacoes_biblia').select('*').eq('user_id', userId);
  if (lista) q = q.eq('favorito_lista', lista);
  else q = q.not('favorito_lista', 'is', null);
  const { data } = await q.order('created_at', { ascending: false });
  return data || [];
}

export const COLOR_MAP = {
  yellow: { bg: 'rgba(234, 179, 8, 0.30)', ring: 'rgba(234, 179, 8, 0.75)', label: 'Amarelo' },
  green:  { bg: 'rgba(34, 197, 94, 0.28)', ring: 'rgba(34, 197, 94, 0.75)', label: 'Verde' },
  blue:   { bg: 'rgba(59, 130, 246, 0.30)', ring: 'rgba(59, 130, 246, 0.75)', label: 'Azul' },
  pink:   { bg: 'rgba(236, 72, 153, 0.28)', ring: 'rgba(236, 72, 153, 0.75)', label: 'Rosa' },
};
