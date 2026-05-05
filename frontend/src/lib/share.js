// Helper para compartilhar versículos como imagem (Web Share API + fallback download).
// Blindagem anti-crash Chrome Mobile: delay 200ms antes de html-to-image e toBlob
// direto (evita fetch do dataURL + passos a mais de reconciliação do React).
import { toBlob } from 'html-to-image';

// "Respiro técnico" — dá ao Chrome Android tempo para finalizar reflows do teclado
// e da atualização de estado antes de rodar html-to-image (operação pesada).
const BREATHING_MS = 200;

async function generateBlob(cardEl) {
  if (!cardEl) throw new Error('Card não encontrado');
  // Respiro antes da captura para evitar "corrida de processamento" do Chrome Android.
  await new Promise((r) => setTimeout(r, BREATHING_MS));
  const blob = await toBlob(cardEl, {
    cacheBust: true,
    pixelRatio: 1,
    backgroundColor: '#061226',
  });
  if (!blob) throw new Error('Falha ao gerar imagem');
  return blob;
}

function buildFileName(reference) {
  const slug = (reference || 'versiculo').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `teologia-viva-${slug}.png`;
}

/**
 * Compartilha via Web Share API (mobile) OU baixa o PNG (fallback desktop).
 */
export async function shareVerseCard(cardEl, opts = {}) {
  const blob = await generateBlob(cardEl);
  const fileName = buildFileName(opts.reference);
  const file = new File([blob], fileName, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      // Respiro extra antes de abrir o sheet nativo de compartilhamento.
      await new Promise((r) => setTimeout(r, BREATHING_MS));
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

  // Fallback: download via blob URL.
  triggerDownloadFromBlob(blob, fileName);
  return { method: 'download' };
}

/**
 * Salva a imagem direto na galeria/Downloads do dispositivo.
 */
export async function saveVerseCard(cardEl, opts = {}) {
  const blob = await generateBlob(cardEl);
  const fileName = buildFileName(opts.reference);
  triggerDownloadFromBlob(blob, fileName);
  return { method: 'download' };
}

// Usa appendChild no body (NUNCA insertBefore) + revogação de URL para evitar
// o "insertBefore crash" do Chrome mobile durante reconciliação.
function triggerDownloadFromBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  // appendChild explícito no body — evita qualquer insertBefore em árvores React.
  document.body.appendChild(a);
  a.click();
  // Remove de forma assíncrona pra deixar o navegador processar o click.
  setTimeout(() => {
    try { document.body.removeChild(a); } catch { /* ignore */ }
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }, 1000);
}

