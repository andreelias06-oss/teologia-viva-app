// Bíblia: suporta múltiplas traduções via diferentes provedores públicos.
// - bible-api.com (Almeida em português)
// - bible.helloao.org (várias traduções em português, sem auth)

export const BOOKS = [
  { id: 'genesis', nome: 'Gênesis', ot: true, chapters: 50, usfm: 'GEN' },
  { id: 'exodo', nome: 'Êxodo', ot: true, chapters: 40, usfm: 'EXO' },
  { id: 'levitico', nome: 'Levítico', ot: true, chapters: 27, usfm: 'LEV' },
  { id: 'numeros', nome: 'Números', ot: true, chapters: 36, usfm: 'NUM' },
  { id: 'deuteronomio', nome: 'Deuteronômio', ot: true, chapters: 34, usfm: 'DEU' },
  { id: 'josue', nome: 'Josué', ot: true, chapters: 24, usfm: 'JOS' },
  { id: 'juizes', nome: 'Juízes', ot: true, chapters: 21, usfm: 'JDG' },
  { id: 'rute', nome: 'Rute', ot: true, chapters: 4, usfm: 'RUT' },
  { id: '1samuel', nome: '1 Samuel', ot: true, chapters: 31, usfm: '1SA' },
  { id: '2samuel', nome: '2 Samuel', ot: true, chapters: 24, usfm: '2SA' },
  { id: '1reis', nome: '1 Reis', ot: true, chapters: 22, usfm: '1KI' },
  { id: '2reis', nome: '2 Reis', ot: true, chapters: 25, usfm: '2KI' },
  { id: 'salmos', nome: 'Salmos', ot: true, chapters: 150, usfm: 'PSA' },
  { id: 'proverbios', nome: 'Provérbios', ot: true, chapters: 31, usfm: 'PRO' },
  { id: 'eclesiastes', nome: 'Eclesiastes', ot: true, chapters: 12, usfm: 'ECC' },
  { id: 'cantares', nome: 'Cânticos', ot: true, chapters: 8, usfm: 'SNG' },
  { id: 'isaias', nome: 'Isaías', ot: true, chapters: 66, usfm: 'ISA' },
  { id: 'jeremias', nome: 'Jeremias', ot: true, chapters: 52, usfm: 'JER' },
  { id: 'ezequiel', nome: 'Ezequiel', ot: true, chapters: 48, usfm: 'EZK' },
  { id: 'daniel', nome: 'Daniel', ot: true, chapters: 12, usfm: 'DAN' },
  { id: 'mateus', nome: 'Mateus', ot: false, chapters: 28, usfm: 'MAT' },
  { id: 'marcos', nome: 'Marcos', ot: false, chapters: 16, usfm: 'MRK' },
  { id: 'lucas', nome: 'Lucas', ot: false, chapters: 24, usfm: 'LUK' },
  { id: 'joao', nome: 'João', ot: false, chapters: 21, usfm: 'JHN' },
  { id: 'atos', nome: 'Atos', ot: false, chapters: 28, usfm: 'ACT' },
  { id: 'romanos', nome: 'Romanos', ot: false, chapters: 16, usfm: 'ROM' },
  { id: '1corintios', nome: '1 Coríntios', ot: false, chapters: 16, usfm: '1CO' },
  { id: '2corintios', nome: '2 Coríntios', ot: false, chapters: 13, usfm: '2CO' },
  { id: 'galatas', nome: 'Gálatas', ot: false, chapters: 6, usfm: 'GAL' },
  { id: 'efesios', nome: 'Efésios', ot: false, chapters: 6, usfm: 'EPH' },
  { id: 'filipenses', nome: 'Filipenses', ot: false, chapters: 4, usfm: 'PHP' },
  { id: 'colossenses', nome: 'Colossenses', ot: false, chapters: 4, usfm: 'COL' },
  { id: '1tessalonicenses', nome: '1 Tessalonicenses', ot: false, chapters: 5, usfm: '1TH' },
  { id: '2tessalonicenses', nome: '2 Tessalonicenses', ot: false, chapters: 3, usfm: '2TH' },
  { id: 'tiago', nome: 'Tiago', ot: false, chapters: 5, usfm: 'JAS' },
  { id: '1pedro', nome: '1 Pedro', ot: false, chapters: 5, usfm: '1PE' },
  { id: '1joao', nome: '1 João', ot: false, chapters: 5, usfm: '1JN' },
  { id: 'apocalipse', nome: 'Apocalipse', ot: false, chapters: 22, usfm: 'REV' },
];

// Traduções disponíveis. `provider` define como buscar.
// 'bible-api' → bible-api.com (translation=ID)
// 'helloao'   → bible.helloao.org/api/{id}/{USFM}/{chapter}.json
// 'unavailable' → mostra dropdown mas avisa que ainda não está disponível (NVI tem licenciamento restrito)
export const TRANSLATIONS = [
  { id: 'almeida', label: 'Almeida (ARC)', short: 'ARC', provider: 'bible-api', providerId: 'almeida' },
  { id: 'por_blj', label: 'Bíblia Livre', short: 'BLJ', provider: 'helloao', providerId: 'por_blj' },
  { id: 'por_onbv', label: 'Open Nova Bíblia Viva', short: 'ONBV', provider: 'helloao', providerId: 'por_onbv' },
  { id: 'por_blt', label: 'Bíblia Livre p/ Todos', short: 'BLT', provider: 'helloao', providerId: 'por_blt' },
  { id: 'nvi', label: 'NVI (em breve)', short: 'NVI', provider: 'unavailable' },
];

export const DEFAULT_TRANSLATION = 'almeida';

function findTranslation(id) {
  return TRANSLATIONS.find((t) => t.id === id) || TRANSLATIONS[0];
}

async function fetchFromBibleApi(book, chapter, translation) {
  const ref = encodeURIComponent(`${book.nome} ${chapter}`);
  const res = await fetch(`https://bible-api.com/${ref}?translation=${translation.providerId}`);
  if (!res.ok) throw new Error('Falha ao carregar capítulo');
  const data = await res.json();
  return {
    reference: data.reference,
    verses: (data.verses || []).map((v) => ({
      number: v.verse,
      text: (v.text || '').replace(/\n/g, ' ').trim(),
    })),
    translation: data.translation_name || translation.label,
  };
}

async function fetchFromHelloAO(book, chapter, translation) {
  const url = `https://bible.helloao.org/api/${translation.providerId}/${book.usfm}/${chapter}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Falha ao carregar capítulo');
  const data = await res.json();
  const content = data?.chapter?.content || [];
  const verses = [];
  for (const item of content) {
    if (item?.type === 'verse' && Array.isArray(item.content)) {
      const text = item.content
        .map((c) => (typeof c === 'string' ? c : (c && typeof c === 'object' && c.text) ? c.text : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      verses.push({ number: item.number, text });
    }
  }
  return {
    reference: `${book.nome} ${chapter}`,
    verses,
    translation: data?.translation?.name || translation.label,
  };
}

export async function fetchChapter(bookId, chapter, translationId = DEFAULT_TRANSLATION) {
  const book = BOOKS.find((b) => b.id === bookId);
  if (!book) throw new Error('Livro não encontrado');
  let translation = findTranslation(translationId);

  if (translation.provider === 'unavailable') {
    // Fallback automático para Almeida
    translation = findTranslation(DEFAULT_TRANSLATION);
  }

  let result;
  if (translation.provider === 'bible-api') {
    result = await fetchFromBibleApi(book, chapter, translation);
  } else if (translation.provider === 'helloao') {
    result = await fetchFromHelloAO(book, chapter, translation);
  } else {
    throw new Error('Provedor de tradução desconhecido');
  }

  return { ...result, book, chapter };
}
