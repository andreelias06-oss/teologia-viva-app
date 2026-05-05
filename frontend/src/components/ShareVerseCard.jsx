import { Sparkles } from 'lucide-react';

/**
 * Card visual de compartilhamento de versículo. Renderizado off-screen para virar imagem PNG.
 * Aspect ratio 9:16 (Stories friendly). Tamanho fixo 1080×1920 para alta resolução.
 */
export default function ShareVerseCard({ verses, reference, translation }) {
  // Texto unificado (suporta múltiplos versículos)
  const ordered = (verses || []).slice().sort((a, b) => a.number - b.number);

  return (
    <div
      style={{
        width: '1080px',
        height: '1920px',
        background: 'linear-gradient(180deg, #061226 0%, #0B1A2C 50%, #061226 100%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        color: '#F5F1E6',
        display: 'flex',
        flexDirection: 'column',
        padding: '120px 100px',
      }}
    >
      {/* Ornamento de cantos */}
      <div style={{ position: 'absolute', top: 60, left: 60, width: 80, height: 80, borderTop: '3px solid #D4AF37', borderLeft: '3px solid #D4AF37' }} />
      <div style={{ position: 'absolute', top: 60, right: 60, width: 80, height: 80, borderTop: '3px solid #D4AF37', borderRight: '3px solid #D4AF37' }} />
      <div style={{ position: 'absolute', bottom: 60, left: 60, width: 80, height: 80, borderBottom: '3px solid #D4AF37', borderLeft: '3px solid #D4AF37' }} />
      <div style={{ position: 'absolute', bottom: 60, right: 60, width: 80, height: 80, borderBottom: '3px solid #D4AF37', borderRight: '3px solid #D4AF37' }} />

      {/* Branding */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '40px' }}>
        <Sparkles size={28} color="#D4AF37" />
        <span style={{ fontSize: '28px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#D4AF37', fontWeight: 600 }}>
          Teologia <span style={{ fontStyle: 'italic' }}>Viva</span>
        </span>
      </div>

      {/* Divider dourado */}
      <div style={{ width: '120px', height: '2px', background: '#D4AF37', margin: '0 auto 80px' }} />

      {/* Versículo(s) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ fontSize: '64px', lineHeight: 1.4, fontStyle: 'italic', textAlign: 'center', maxWidth: '900px' }}>
          {ordered.map((v, i) => (
            <span key={v.number} style={{ display: 'block', marginBottom: i < ordered.length - 1 ? '20px' : 0 }}>
              <span style={{ fontSize: '32px', verticalAlign: 'super', color: '#D4AF37', marginRight: '8px', fontStyle: 'normal' }}>
                {v.number}
              </span>
              {v.text}
            </span>
          ))}
        </div>
      </div>

      {/* Referência */}
      <div style={{ textAlign: 'center', marginTop: '60px' }}>
        <div style={{ width: '60px', height: '1px', background: '#D4AF37', margin: '0 auto 32px' }} />
        <p style={{ fontSize: '40px', color: '#D4AF37', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, margin: 0 }}>
          {reference}
        </p>
        {translation ? (
          <p style={{ fontSize: '22px', color: 'rgba(212, 175, 55, 0.6)', marginTop: '12px', letterSpacing: '0.2em' }}>
            {translation}
          </p>
        ) : null}
      </div>
    </div>
  );
}
