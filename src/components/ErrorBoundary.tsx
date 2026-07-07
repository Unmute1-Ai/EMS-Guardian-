/**
 * Error Boundary Component for React
 */
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { errorHandler } from '../lib/errorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    errorHandler.error('React Error Boundary caught error', {
      componentStack: errorInfo.componentStack
    }, error.stack);

    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        this.props.fallback || (
          <div className="min-h-screen bg-cad-bg text-cad-text flex items-center justify-center p-4">
            <div className="max-w-md border border-cad-red bg-cad-surface p-6 text-center">
              <AlertCircle className="w-12 h-12 text-cad-red mx-auto mb-4" />
              <h2 className="text-lg font-bold uppercase text-cad-red mb-2">SYSTEM ERROR</h2>
              <p className="text-[12px] text-cad-muted mb-4 font-mono break-words">
                {this.state.error.message}
              </p>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-cad-green text-black font-bold uppercase text-[11px] hover:bg-white transition-colors w-full"
              >
                RECOVER SYSTEM
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
