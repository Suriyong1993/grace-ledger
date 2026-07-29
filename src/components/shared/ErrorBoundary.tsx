/**
 * Grace Ledger v2 — ErrorBoundary Component
 *
 * Catches React rendering errors and displays a professional fallback UI
 * with retry and navigation actions, preventing white screens.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = (): void => {
    window.location.href = "/";
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[400px] items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" strokeWidth={1.5} />
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground">เกิดข้อผิดพลาด</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ระบบพบข้อผิดพลาดที่ไม่คาดคิด กรุณาลองอีกครั้ง
            </p>
            {this.state.error && (
              <p className="mt-3 rounded border border-border bg-muted/50 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                {this.state.error.message}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
                ลองอีกครั้ง
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
              >
                <Home className="h-4 w-4" strokeWidth={1.5} />
                กลับหน้าหลัก
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
