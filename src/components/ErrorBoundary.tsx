import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "@/i18n";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
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
    console.error(i18n.t("errorBoundary.caught"), error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <svg
                className="h-8 w-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
              <h1 className="text-lg font-semibold text-gray-900">
                {i18n.t("errorBoundary.somethingWentWrong")}
              </h1>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              {i18n.t("errorBoundary.unexpectedError")}
            </p>
            {this.state.error && (
              <pre className="mb-4 max-h-32 overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-700">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white hover:bg-dfrntBlue-700"
              >
                {i18n.t("errorBoundary.reloadPage")}
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                {i18n.t("errorBoundary.tryAgain")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
