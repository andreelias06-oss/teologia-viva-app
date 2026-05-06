// Renderizador 100% via Canvas — SEM html-to-image, SEM clonagem de DOM, SEM `insertBefore`.
// Esse é o caminho à prova de crash do Chrome Android (S24 Ultra).
//
// O card visual original (`<ShareVerseCard>` JSX) é replicado pixel a pixel aqui:
// gradiente navy, ornamentos dourados nos cantos, branding "TEOLOGIA VIVA",
// versículos em itálico serif e referência em caixa-alta dourada.
//
// Dimensões 1080×1920 (Stories friendly). Saída: Blob image/png.

const W = 1080;
const H = 1920;
const GOLD = '#D4AF37';
const GOLD_FAINT = 'rgba(212, 175, 55, 0.6)';
const FG = '#F5F1E6';

async function ensureFonts() {
  try {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch { /* ignore */ }
}

function drawCornerOrnaments(ctx) {
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  // top-left
  ctx.beginPath(); ctx.moveTo(60, 140); ctx.lineTo(60, 60); ctx.lineTo(140, 60); ctx.stroke();
  // top-right
  ctx.beginPath(); ctx.moveTo(940, 60); ctx.lineTo(1020, 60); ctx.lineTo(1020, 140); ctx.stroke();
  // bottom-left
  ctx.beginPath(); ctx.moveTo(60, 1780); ctx.lineTo(60, 1860); ctx.lineTo(140, 1860); ctx.stroke();
  // bottom-right
  ctx.beginPath(); ctx.moveTo(940, 1860); ctx.lineTo(1020, 1860); ctx.lineTo(1020, 1780); ctx.stroke();
}

// Estrela 4 pontas dourada — substitui o ícone Sparkles do lucide-react.
function drawSparkle(ctx, cx, cy, size) {
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size * 0.22, cy - size * 0.22);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx + size * 0.22, cy + size * 0.22);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size * 0.22, cy + size * 0.22);
  ctx.lineTo(cx - size, cy);
  ctx.lineTo(cx - size * 0.22, cy - size * 0.22);
  ctx.closePath();
  ctx.fill();
}

function wrapLines(ctx, text, maxWidth) {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(trial).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Pinta o card e devolve um Blob image/png.
 * NÃO depende de nenhum nó DOM externo — totalmente isolado de React reconciliation.
 */
export async function paintShareCardBlob({ verses, reference, translation }) {
  await ensureFonts();

  // OffscreenCanvas quando suportado; senão um <canvas> em memória (não anexado ao DOM).
  let canvas;
  let ctx;
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      canvas = new OffscreenCanvas(W, H);
      ctx = canvas.getContext('2d');
    } catch { /* fall through */ }
  }
  if (!ctx) {
    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');
  }
  if (!ctx) throw new Error('Canvas 2D não suportado neste navegador');

  // 1) Background gradient navy
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#061226');
  grad.addColorStop(0.5, '#0B1A2C');
  grad.addColorStop(1, '#061226');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 2) Cantos dourados
  drawCornerOrnaments(ctx);

  // 3) Branding row
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.font = '600 36px "Cormorant Garamond", Georgia, serif';
  // Sparkle à esquerda do texto + letterspacing aproximado via espaços extras.
  const brandText = 'T E O L O G I A   V I V A';
  const brandY = 250;
  const brandW = ctx.measureText(brandText).width;
  drawSparkle(ctx, W / 2 - brandW / 2 - 40, brandY, 14);
  ctx.fillText(brandText, W / 2 + 16, brandY);

  // 4) Divider dourado
  ctx.fillStyle = GOLD;
  ctx.fillRect(W / 2 - 60, 320, 120, 2);

  // 5) Versículos — itálico serif 64px, wrap 900px
  ctx.fillStyle = FG;
  ctx.font = 'italic 64px "Cormorant Garamond", Georgia, serif';
  ctx.textBaseline = 'top';
  const ordered = (verses || []).slice().sort((a, b) => a.number - b.number);
  const allLines = [];
  for (let i = 0; i < ordered.length; i++) {
    const v = ordered[i];
    const lines = wrapLines(ctx, `${v.number} ${v.text}`, 900);
    allLines.push(...lines);
    if (i < ordered.length - 1) allLines.push('');  // blank line entre versículos
  }
  const lineHeight = 92;
  const blockTop = 420;
  const blockBottom = 1560;
  const totalH = allLines.length * lineHeight;
  let y = blockTop + Math.max(0, (blockBottom - blockTop - totalH) / 2);
  for (const line of allLines) {
    if (line) ctx.fillText(line, W / 2, y);
    y += lineHeight;
  }

  // 6) Referência (uppercase dourado) + translation
  ctx.fillStyle = GOLD;
  ctx.fillRect(W / 2 - 30, 1660, 60, 1);
  ctx.font = '600 44px "Cormorant Garamond", Georgia, serif';
  ctx.textBaseline = 'middle';
  ctx.fillText((reference || '').toUpperCase(), W / 2, 1720);
  if (translation) {
    ctx.fillStyle = GOLD_FAINT;
    ctx.font = '24px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(translation, W / 2, 1770);
  }

  // 7) Exporta como Blob image/png estrito
  if (typeof canvas.convertToBlob === 'function') {
    // OffscreenCanvas
    return await canvas.convertToBlob({ type: 'image/png' });
  }
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Falha ao gerar PNG'));
      else resolve(blob);
    }, 'image/png');
  });
}
