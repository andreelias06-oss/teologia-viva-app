// Helper para compartilhar/salvar versículos como imagem.
//
// CRASH-FREE Chrome Android (S24 Ultra):
//  • Renderização 100% via Canvas (`canvasShareCard.js`) — SEM html-to-image,
//    SEM clonagem de DOM, SEM `insertBefore` em nenhum lugar do pipeline.
//  • Filename forçado para `compartilhar.png` + MIME estrito `image/png`.
//    Chrome só lista WhatsApp/Insta/Stories no share sheet quando o arquivo
//    tem extensão `.png` clara e MIME exatamente `image/png`.
//  • Web Share API chamado dentro da MESMA cadeia de promises do clique
//    (sem setTimeout entre `canShare` e `share`) para preservar o user-gesture.
//  • Try/catch global: qualquer falha não-Abort (incluindo "node not found"
//    causado por re-render concorrente) cai silenciosamente no download.

import { paintShareCardBlob } from './canvasShareCard';

const FILE_NAME = 'compartilhar.png';
const FILE_TYPE = 'image/png';

// Cria um File real de tipo image/png — Chrome Android EXIGE isso pra
// listar apps de imagem (WhatsApp/Instagram/etc.) no share sheet.
function blobToImageFile(blob) {
  return new File([blob], FILE_NAME, { type: FILE_TYPE });
}

// Tenta `navigator.share` com payloads progressivamente mais conservadores.
// WhatsApp no Chrome Android às vezes some quando o payload tem `text+files`.
async function tryShareSequential(file, opts) {
  const attempts = [
    { files: [file], title: opts?.title || 'Teologia Viva', text: opts?.text || '' },
    { files: [file], title: opts?.title || 'Teologia Viva' },
    { files: [file] },
  ];
  let lastErr = null;
  for (const payload of attempts) {
    if (!navigator.canShare?.(payload)) continue;
    try {
      // Chamada DIRETA — sem setTimeout, preserva user-gesture.
      await navigator.share(payload);
      return { method: 'share' };
    } catch (e) {
      if (e?.name === 'AbortError') return { method: 'cancelled' };
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

/**
 * Compartilha o card como imagem via Web Share API.
 * Fallback automático e silencioso: download do PNG.
 *
 * Recebe os DADOS do versículo (não um nó DOM) — pinta o card via Canvas API,
 * eliminando qualquer dependência do React render tree.
 *
 * Retorna { method: 'share' | 'download' | 'cancelled' }. NUNCA lança erro
 * de "insertBefore" ou "node not found" (try/catch global protege).
 *
 * IMPORTANTE: chamar SEMPRE em cima de um clique direto do usuário (onClick).
 */
export async function shareVerseCard(payload, opts = {}) {
  try {
    const blob = await paintShareCardBlob(payload);
    const file = blobToImageFile(blob);

    // Web Share API só funciona com File real + canShare({files}).
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        const res = await tryShareSequential(file, opts);
        if (res?.method === 'share') return res;
        if (res?.method === 'cancelled') return res;
      } catch {
        // Cai no fallback de download abaixo.
      }
    }

    // Fallback seguro: sempre baixa a imagem se o share não rolou.
    triggerDownloadFromBlob(blob);
    return { method: 'download' };
  } catch {
    // Última linha de defesa: tenta gerar de novo só pra download.
    try {
      const blob = await paintShareCardBlob(payload);
      triggerDownloadFromBlob(blob);
      return { method: 'download' };
    } catch {
      return { method: 'failed' };
    }
  }
}

/**
 * Salva a imagem direto na galeria/Downloads do dispositivo.
 */
export async function saveVerseCard(payload, _opts = {}) {
  try {
    const blob = await paintShareCardBlob(payload);
    triggerDownloadFromBlob(blob);
    return { method: 'download' };
  } catch {
    return { method: 'failed' };
  }
}

// Usa appendChild no body (NUNCA insertBefore) + revogação de URL.
// O `<a>` é anexado ao body diretamente e removido só depois de 1s,
// garantindo que o navegador termine de processar o click.
function triggerDownloadFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = FILE_NAME;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try { if (a.parentNode === document.body) document.body.removeChild(a); } catch { /* ignore */ }
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }, 1000);
}
