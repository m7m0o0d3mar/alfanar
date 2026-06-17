import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
          <div className="p-3 rounded-full mb-4" style={{background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)'}}>
            <AlertTriangle size={32} style={{color: 'var(--color-danger)'}} />
          </div>
          <h2 className="text-lg font-semibold mb-1">Something went wrong</h2>
          <p className="text-sm mb-4" style={{color: 'var(--color-text-secondary)'}}>
            {this.state.error.message || 'An unexpected error occurred'}
          </p>
          <button className="btn-primary btn-sm" onClick={() => this.setState({ error: null })}>
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
