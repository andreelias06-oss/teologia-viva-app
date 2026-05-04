import React from 'react';

/**
 * Blindagem contra crashes de reconciliação do React dentro do Drawer da Bíblia.
 * Se qualquer filho lançar, mostra um fallback estável com botão "Tentar novamente".
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || String(error) };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.warn('[ErrorBoundary] caught render error:', error?.message || error, info?.componentStack);
  }
  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMsg: null });
    }
  }
  reset = () => {
    this.setState({ hasError: false, errorMsg: null });
    if (typeof this.props.onRetry === 'function') {
      try { this.props.onRetry(); } catch { /* ignore */ }
    }
  };
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 space-y-3"
          data-testid="error-boundary-fallback"
        >
          <p className="text-sm text-foreground/85 font-sans">
            Algo deu errado ao exibir a explicação.
          </p>
          {this.state.errorMsg ? (
            <p className="text-[11px] text-foreground/50 font-sans break-words">
              {this.state.errorMsg}
            </p>
          ) : null}
          <button
            type="button"
            onClick={this.reset}
            data-testid="error-boundary-retry"
            className="px-3 py-2 rounded-md bg-gold text-navy-dark text-sm font-sans font-semibold hover:bg-gold-soft active:scale-95"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
