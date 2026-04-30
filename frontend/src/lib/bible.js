// Bible data: uses bible-api.com (free, no API key) with the Almeida (Portuguese) translation.
// Books are Portuguese names and indices follow Bible Gateway conventions.

export const BOOKS = [
  { id: 'genesis', nome: 'Gênesis', ot: true, chapters: 50 },
  { id: 'exodo', nome: 'Êxodo', ot: true, chapters: 40 },
  { id: 'levitico', nome: 'Levítico', ot: true, chapters: 27 },
  { id: 'numeros', nome: 'Números', ot: true, chapters: 36 },
  { id: 'deuteronomio', nome: 'Deuteronômio', ot: true, chapters: 34 },
  { id: 'josue', nome: 'Josué', ot: true, chapters: 24 },
  { id: 'juizes', nome: 'Juízes', ot: true, chapters: 21 },
  { id: 'rute', nome: 'Rute', ot: true, chapters: 4 },
  { id: '1samuel', nome: '1 Samuel', ot: true, chapters: 31 },
  { id: '2samuel', nome: '2 Samuel', ot: true, chapters: 24 },
  { id: '1reis', nome: '1 Reis', ot: true, chapters: 22 },
  { id: '2reis', nome: '2 Reis', ot: true, chapters: 25 },
  { id: 'salmos', nome: 'Salmos', ot: true, chapters: 150 },
  { id: 'proverbios', nome: 'Provérbios', ot: true, chapters: 31 },
  { id: 'eclesiastes', nome: 'Eclesiastes', ot: true, chapters: 12 },
  { id: 'cantares', nome: 'Cânticos', ot: true, chapters: 8 },
  { id: 'isaias', nome: 'Isaías', ot: true, chapters: 66 },
  { id: 'jeremias', nome: 'Jeremias', ot: true, chapters: 52 },
  { id: 'ezequiel', nome: 'Ezequiel', ot: true, chapters: 48 },
  { id: 'daniel', nome: 'Daniel', ot: true, chapters: 12 },
  { id: 'mateus', nome: 'Mateus', ot: false, chapters: 28 },
  { id: 'marcos', nome: 'Marcos', ot: false, chapters: 16 },
  { id: 'lucas', nome: 'Lucas', ot: false, chapters: 24 },
  { id: 'joao', nome: 'João', ot: false, chapters: 21 },
  { id: 'atos', nome: 'Atos', ot: false, chapters: 28 },
  { id: 'romanos', nome: 'Romanos', ot: false, chapters: 16 },
  { id: '1corintios', nome: '1 Coríntios', ot: false, chapters: 16 },
  { id: '2corintios', nome: '2 Coríntios', ot: false, chapters: 13 },
  { id: 'galatas', nome: 'Gálatas', ot: false, chapters: 6 },
  { id: 'efesios', nome: 'Efésios', ot: false, chapters: 6 },
  { id: 'filipenses', nome: 'Filipenses', ot: false, chapters: 4 },
  { id: 'colossenses', nome: 'Colossenses', ot: false, chapters: 4 },
  { id: '1tessalonicenses', nome: '1 Tessalonicenses', ot: false, chapters: 5 },
  { id: '2tessalonicenses', nome: '2 Tessalonicenses', ot: false, chapters: 3 },
  { id: 'tiago', nome: 'Tiago', ot: false, chapters: 5 },
  { id: '1pedro', nome: '1 Pedro', ot: false, chapters: 5 },
  { id: '1joao', nome: '1 João', ot: false, chapters: 5 },
  { id: 'apocalipse', nome: 'Apocalipse', ot: false, chapters: 22 },
];

export async function fetchChapter(bookId, chapter) {
  const book = BOOKS.find((b) => b.id === bookId);
  if (!book) throw new Error('Livro não encontrado');
  const ref = encodeURIComponent(`${book.nome} ${chapter}`);
  const res = await fetch(`https://bible-api.com/${ref}?translation=almeida`);
  if (!res.ok) throw new Error('Falha ao carregar capítulo');
  const data = await res.json();
  return {
    reference: data.reference,
    verses: (data.verses || []).map((v) => ({
      number: v.verse,
      text: (v.text || '').replace(/\n/g, ' ').trim(),
    })),
    translation: data.translation_name || 'Almeida',
    book,
    chapter,
  };
}
