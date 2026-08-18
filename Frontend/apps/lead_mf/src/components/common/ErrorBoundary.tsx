import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error('[lead_mf] Uncaught error in micro-frontend:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '8px', margin: '24px', border: '1px solid #fee2e2' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '8px' }}>Lead Management Error</h2>
          <p style={{ color: '#64748b', marginBottom: '16px' }}>{this.state.error?.message || 'An error occurred while rendering the Lead Management micro-frontend.'}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
