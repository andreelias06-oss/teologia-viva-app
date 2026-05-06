// Helper para compartilhar/salvar versículos como imagem.
//
// Compatibilidade Chrome Android (S24 Ultra) — pontos críticos:
//  • `navigator.share` precisa ser chamado dentro da MESMA cadeia de promises
//    iniciada por um gesto do usuário; portanto fazemos o "respiro técnico"
//    (200ms) ANTES de `html-to-image`, e NUNCA entre o canShare e o share.
//  • O Web Share API rejeita objetos que não sejam `File` reais — usamos
//    `new File([blob], fileName, { type: 'image/png' })`.
//  • Validamos com `navigator.canShare({ files: [file] })` antes do share.
//  • Quando o sheet do Chrome esconde apps (ex.: WhatsApp filtra payloads
//    com texto+arquivo), tentamos novamente sem o campo `text`.
//  • Fallback final: download da imagem (usa `appendChild` no body — nunca
//    `insertBefore` — para não disparar o crash insertBefore do Chrome).

import { toBlob } from 'html-to-image';

// "Respiro técnico" — dá ao Chrome Android tempo para finalizar reflows do teclado
// e da atualização de estado antes de rodar html-to-image (operação pesada).
const BREATHING_MS = 200;

async function generateBlob(cardEl) {
  if (!cardEl) throw new Error('Card não encontrado');
  // Respiro antes da captura — feito ANTES da captura, NUNCA entre canShare e share.
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
  // Filename curto + extensão `.png` consistente com `type: image/png`.
  return `teologia-viva-${slug.slice(0, 60)}.png`;
}

// Cria um File real de tipo image/png — Chrome Android EXIGE isso pra
// listar apps de imagem (WhatsApp/Instagram/etc.) no share sheet.
function blobToImageFile(blob, fileName) {
  return new File([blob], fileName, { type: 'image/png' });
}

// Tenta `navigator.share` com payloads progressivamente mais conservadores.
// Alguns apps (ex.: WhatsApp no Chrome Android) só aparecem no sheet quando
// o payload é apenas { files }, sem `text`. Tentamos:
//   1) { files, title, text }
//   2) { files, title }       (remove text)
//   3) { files }              (apenas o arquivo)
async function tryShareSequential(file, opts) {
  const attempts = [
    { files: [file], title: opts.title || 'Teologia Viva', text: opts.text || '' },
    { files: [file], title: opts.title || 'Teologia Viva' },
    { files: [file] },
  ];
  let lastErr = null;
  for (const payload of attempts) {
    if (!navigator.canShare?.(payload)) continue;
    try {
      // Chamada DIRETA — sem `setTimeout` aqui, para preservar o user-gesture.
      await navigator.share(payload);
      return { method: 'share' };
    } catch (e) {
      if (e?.name === 'AbortError') return { method: 'cancelled' };
      lastErr = e;
      // Continua tentando o próximo payload mais conservador.
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

/**
 * Compartilha o card como imagem via Web Share API (Chrome/Edge/Safari mobile).
 * Fallback automático: download do PNG.
 *
 * IMPORTANTE: chamar SEMPRE em cima de um clique direto do usuário (onClick).
 * Não envolver em setTimeout/setInterval ou em handlers diferidos — o Chrome
 * Android invalida o user-gesture e bloqueia o share sheet.
 */
export async function shareVerseCard(cardEl, opts = {}) {
  const blob = await generateBlob(cardEl);
  const fileName = buildFileName(opts.reference);
  const file = blobToImageFile(blob, fileName);

  // Web Share API só funciona com File real + canShare({files}).
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      const res = await tryShareSequential(file, opts);
      if (res) return res;
    } catch {
      // Cai no fallback de download abaixo.
    }
  }

  // Fallback seguro: download da imagem (sempre garante "alguma coisa pro usuário").
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
