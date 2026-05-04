// Bíblia consumida exclusivamente da tabela `biblia` no Supabase.
// Estrutura por linha: { versao, abbrev, name, ordem, testamento, chapters: jsonb [[v1, v2, ...], ...] }
//
// Versões pré-carregadas:
//   - 'nvi' → Nova Versão Internacional (Biblica)
//   - 'acf' → Almeida Corrigida e Fiel
//   - 'aa'  → Almeida Atualizada (domínio público)

import { supabase } from './supabase';

export const TRANSLATIONS = [
  { id: 'nvi', label: 'NVI', short: 'NVI' },
  { id: 'acf', label: 'Almeida Corrigida Fiel', short: 'ACF' },
  { id: 'aa', label: 'Almeida Atualizada', short: 'AA' },
];

export const DEFAULT_TRANSLATION = 'nvi';

// Cache em memória: { versao: [book, ...] }
const _booksCache = {};

// Busca a lista de livros (sem `chapters`) ordenados.
export async function listBooks(versao = DEFAULT_TRANSLATION) {
  if (_booksCache[versao]) return _booksCache[versao];
  const { data, error } = await supabase
    .from('biblia')
    .select('versao, abbrev, name, ordem, testamento')
    .eq('versao', versao)
    .order('ordem', { ascending: true });
  if (error) throw error;
  _booksCache[versao] = (data || []).map((b) => ({
    id: b.abbrev,            // mantém compatibilidade: "id" é o abbrev
    abbrev: b.abbrev,
    nome: b.name,
    ot: b.testamento === 'AT',
    ordem: b.ordem,
  }));
  return _booksCache[versao];
}

// Busca o número de capítulos de um livro (consulta apenas o jsonb_array_length sem trazer o conteúdo).
export async function getChaptersCount(abbrev, versao = DEFAULT_TRANSLATION) {
  const { data, error } = await supabase
    .from('biblia')
    .select('chapters')
    .eq('versao', versao)
    .eq('abbrev', abbrev)
    .maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.chapters) ? data.chapters.length : 0;
}

// Busca o capítulo: retorna { reference, verses: [{number, text}], translation, book, chapter }.
export async function fetchChapter(abbrev, chapter, versao = DEFAULT_TRANSLATION) {
  const { data, error } = await supabase
    .from('biblia')
    .select('versao, abbrev, name, chapters')
    .eq('versao', versao)
    .eq('abbrev', abbrev)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Livro não encontrado');

  const allChapters = Array.isArray(data.chapters) ? data.chapters : [];
  if (chapter < 1 || chapter > allChapters.length) {
    throw new Error(`Capítulo ${chapter} indisponível`);
  }
  const verses = (allChapters[chapter - 1] || []).map((text, i) => ({
    number: i + 1,
    text: String(text || '').replace(/\s+/g, ' ').trim(),
  }));
  const tlabel = TRANSLATIONS.find((t) => t.id === versao)?.label || versao;

  return {
    reference: `${data.name} ${chapter}`,
    verses,
    translation: tlabel,
    book: { id: data.abbrev, abbrev: data.abbrev, nome: data.name },
    chapter,
  };
}

// Compatibilidade: alguns componentes antigos importavam BOOKS como array constante.
// Como agora a lista vem do banco e depende da versão, exportamos um getter.
export async function getBooksFor(versao = DEFAULT_TRANSLATION) {
  return listBooks(versao);
}
