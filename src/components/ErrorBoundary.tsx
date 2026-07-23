import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = {
  children: ReactNode;
  /** Change this value (e.g. pathname) to auto-reset the boundary on route change. */
  resetKey?: string | number;
  /** Optional custom fallback renderer. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
  /** Label logged with the error (Sentry-style boundary tag). */
  boundary?: string;
};

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    reportLovableError(error, { boundary: this.props.boundary ?? "component_error_boundary" });
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback({ error, reset: this.reset });

    return <DefaultFallback error={error} reset={this.reset} />;
  }
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="font-display text-lg tracking-wider">ESTA TELA NÃO CARREGOU</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tivemos um problema ao mostrar esta parte do painel. Você pode tentar novamente sem sair
          do app.
        </p>
        {error.message && (
          <p className="mt-3 text-[11px] font-mono text-muted-foreground/80 break-words">
            {error.message}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={reset} className="gap-2">
            <RotateCw className="h-4 w-4" /> Tentar novamente
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Recarregar página
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small inline fallback used by TanStack route-level `errorComponent`. */
export function RouteErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return <DefaultFallback error={error} reset={reset} />;
}
