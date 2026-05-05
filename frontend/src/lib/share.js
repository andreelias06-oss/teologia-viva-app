// Helper para compartilhar versículos como imagem (Web Share API + fallback download).
import { toPng } from 'html-to-image';

/**
 * Gera o PNG do card e tenta compartilhar via navigator.share.
 * Fallback: faz download do PNG.
 *
 * @param {HTMLElement} cardEl  elemento raiz do <ShareVerseCard /> renderizado off-screen
 * @param {Object} opts
 *   @param {string} opts.reference  ex: "João 3:16"
 *   @param {string} opts.title      ex: "Teologia Viva"
 *   @param {string} opts.text       texto adicional para o share sheet
 */
export async function shareVerseCard(cardEl, opts = {}) {
  if (!cardEl) throw new Error('Card não encontrado');
  const dataUrl = await toPng(cardEl, {
    cacheBust: true,
    pixelRatio: 1,  // o card já é 1080×1920
    backgroundColor: '#061226',
  });

  // Converte dataUrl → File para Web Share API.
  const blob = await (await fetch(dataUrl)).blob();
  const fileName = `teologia-viva-${(opts.reference || 'versiculo').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  // Tenta navigator.share com arquivo (Android/iOS modernos).
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: opts.title || 'Teologia Viva',
        text: opts.text || (opts.reference ? `${opts.reference} — Teologia Viva` : 'Compartilhado por Teologia Viva'),
      });
      return { method: 'share' };
    } catch (e) {
      // Usuário cancelou ou navegador rejeitou — segue para fallback.
      if (e?.name === 'AbortError') return { method: 'cancelled' };
    }
  }

  // Fallback: download do PNG.
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return { method: 'download' };
}
