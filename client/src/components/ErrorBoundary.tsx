import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    window.dispatchEvent(new CustomEvent("bob:runtime-error", { detail: { source: "react.boundary", message: error.message } }));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-page">
          <div className="error-boundary-card">
            <AlertTriangle
              size={48}
              className="error-boundary-icon"
            />

            <h2 className="error-boundary-title">An unexpected error occurred.</h2>

            <div className="error-boundary-details">The incident has been recorded for the operations team. Please reload and try again.</div>

            <button
              onClick={() => window.location.reload()}
              className="error-boundary-reload"
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
