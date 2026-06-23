/**
 * ErrorBoundary — catches React render errors so one broken page
 * doesn't take down the entire dashboard.
 *
 * Must be a class component (React requirement for componentDidCatch).
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomePage />
 *   </ErrorBoundary>
 */

import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // in production you'd send this to Sentry/Datadog
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            This section encountered an unexpected error. Your other dashboard tabs are unaffected.
          </p>
          {this.state.error?.message && (
            <p className="mt-2 text-xs font-mono text-muted-foreground/60 bg-muted/30 px-3 py-1.5 rounded-lg max-w-sm">
              {this.state.error.message}
            </p>
          )}
        </div>
        <button
          onClick={this.handleReset}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          id="error-boundary-retry"
        >
          <RefreshCw className="size-3.5" />
          Try again
        </button>
      </div>
    );
  }
}
