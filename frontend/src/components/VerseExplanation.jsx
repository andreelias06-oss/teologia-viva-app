import { Skeleton } from './ui/skeleton';

/**
 * Bloco isolado para exibir a explicação do versículo pela IA.
 * Renderizado em uma subárvore própria (com key externo) para evitar
 * conflitos de reconciliação do React no Drawer (insertBefore crash).
 */
export default function VerseExplanation({ loading, text }) {
  if (loading) {
    return (
      <div
        className="rounded-xl border border-gold/15 bg-navy-light/40 p-4 space-y-2"
        data-testid="verse-explanation-loading"
      >
        <Skeleton className="h-3 w-3/4 bg-navy-dark/60" />
        <Skeleton className="h-3 w-full bg-navy-dark/60" />
        <Skeleton className="h-3 w-5/6 bg-navy-dark/60" />
        <Skeleton className="h-3 w-2/3 bg-navy-dark/60" />
      </div>
    );
  }
  if (text) {
    return (
      <div className="rounded-xl border border-gold/15 bg-navy-light/40 p-4">
        <p
          className="text-foreground/90 font-sans whitespace-pre-wrap leading-relaxed text-sm"
          data-testid="verse-explanation"
        >
          {text}
        </p>
      </div>
    );
  }
  return null;
}
