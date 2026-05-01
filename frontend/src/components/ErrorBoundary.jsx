import React from 'react';

/**
 * Blindagem contra crashes de reconciliação do React dentro do Drawer da Bíblia.
 * Se qualquer filho lançar, mostra um fallback estável em vez de quebrar a árvore.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.warn('[ErrorBoundary] caught render error:', error?.message || error, info?.componentStack);
  }
  componentDidUpdate(prevProps) {
    // Reset when the content identity changes (e.g., new selection)
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground/80"
          data-testid="error-boundary-fallback"
        >
          Algo deu errado ao exibir o conteúdo. Toque novamente no botão para tentar de novo.
        </div>
      );
    }
    return this.props.children;
  }
}
