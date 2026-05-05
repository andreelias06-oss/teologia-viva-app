// Helper para compartilhar versículos como imagem (Web Share API + fallback download).
import { toPng } from 'html-to-image';

async function generatePng(cardEl) {
  if (!cardEl) throw new Error('Card não encontrado');
  return await toPng(cardEl, {
    cacheBust: true,
    pixelRatio: 1,
    backgroundColor: '#061226',
  });
}

function buildFileName(reference) {
  const slug = (reference || 'versiculo').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `teologia-viva-${slug}.png`;
}

/**
 * Compartilha via Web Share API (mobile) OU baixa o PNG (fallback desktop).
 */
export async function shareVerseCard(cardEl, opts = {}) {
  const dataUrl = await generatePng(cardEl);
  const blob = await (await fetch(dataUrl)).blob();
  const fileName = buildFileName(opts.reference);
  const file = new File([blob], fileName, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: opts.title || 'Teologia Viva',
        text: opts.text || (opts.reference ? `${opts.reference} — Teologia Viva` : 'Compartilhado por Teologia Viva'),
      });
      return { method: 'share' };
    } catch (e) {
      if (e?.name === 'AbortError') return { method: 'cancelled' };
    }
  }

  // Fallback: download.
  triggerDownload(dataUrl, fileName);
  return { method: 'download' };
}

/**
 * Salva a imagem direto na galeria/Downloads do dispositivo.
 */
export async function saveVerseCard(cardEl, opts = {}) {
  const dataUrl = await generatePng(cardEl);
  const fileName = buildFileName(opts.reference);
  triggerDownload(dataUrl, fileName);
  return { method: 'download' };
}

function triggerDownload(dataUrl, fileName) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

