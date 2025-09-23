import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackComponent?: React.ComponentType<{
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    resetError: () => void;
  }>;
}

/**
 * Error boundary component to catch React errors and provide fallback UI
 * Prevents crashes from leaving users stranded without navigation options
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error('[ErrorBoundary] React error caught:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      const { fallbackComponent: FallbackComponent } = this.props;

      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            resetError={this.resetError}
          />
        );
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component with navigation options
 */
const DefaultErrorFallback: React.FC<{
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  resetError: () => void;
}> = ({ error, errorInfo, resetError }) => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    resetError();
    navigate('/');
  };

  const handleGoBack = () => {
    resetError();
    navigate(-1);
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Oops! Something went wrong
          </h1>
          <p className="text-gray-600">
            The page encountered an unexpected error and couldn't continue.
          </p>
        </div>

        {/* Error details */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-red-800 mb-2">Error Details:</h3>
          <p className="text-red-700 text-sm font-mono mb-2">
            {error?.message || 'Unknown error occurred'}
          </p>
          {error?.stack && (
            <details className="text-xs text-red-600">
              <summary className="cursor-pointer hover:text-red-800">
                Show technical details
              </summary>
              <pre className="mt-2 whitespace-pre-wrap overflow-auto max-h-40 bg-red-100 p-2 rounded">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleGoBack}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            ← Go Back
          </button>

          <button
            onClick={handleGoHome}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
          >
            🏠 Go Home
          </button>

          <button
            onClick={resetError}
            className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center justify-center"
          >
            🔄 Try Again
          </button>

          <button
            onClick={handleReload}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
          >
            ⟳ Reload Page
          </button>
        </div>

        {/* Help text */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            If this problem persists, try refreshing the page or contact support.
          </p>
        </div>
      </div>
    </div>
  );
};