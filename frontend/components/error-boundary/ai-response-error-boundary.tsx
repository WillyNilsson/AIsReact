import { Component, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import logger from "@/lib/logger";

interface Props {
  children: ReactNode;
  modelName?: string;
}

interface State {
  hasError: boolean;
}

export class AIResponseErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      logger.error("AI Response Error Boundary caught:", error, { errorInfo });
    }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900">
                {this.props.modelName
                  ? `${this.props.modelName} Response Error`
                  : "AI Response Error"}
              </h4>
              <p className="text-sm text-red-700 mt-1">
                Failed to display this AI response. The response data may be
                malformed.
              </p>
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}
