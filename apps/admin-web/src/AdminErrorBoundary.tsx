import { Component, type ErrorInfo, type ReactNode } from "react";

interface AdminErrorBoundaryProps {
  readonly children: ReactNode;
}

interface AdminErrorBoundaryState {
  readonly error: Error | null;
}

export class AdminErrorBoundary extends Component<
  AdminErrorBoundaryProps,
  AdminErrorBoundaryState
> {
  override state: AdminErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AdminErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Falha no Terrativa Admin", error, info);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="admin-fatal-error">
        <span>WORLD STUDIO</span>
        <h1>Não foi possível iniciar o editor 3D</h1>
        <p>{this.state.error.message}</p>
        <button onClick={() => window.location.reload()} type="button">
          Recarregar o Admin
        </button>
      </main>
    );
  }
}
