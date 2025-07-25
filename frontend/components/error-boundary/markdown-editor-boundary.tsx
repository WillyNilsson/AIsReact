"use client";

import React from "react";
import SimpleMarkdownEditor from "@/components/ui/markdown-editor-simple";
import type { MarkdownEditorProps } from "@/components/ui/markdown-editor-rich";
import logger from "@/lib/logger";

interface Props extends MarkdownEditorProps {
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class MarkdownEditorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("Markdown editor error:", error, { errorInfo });
  }

  override render() {
    if (this.state.hasError) {
      // Fallback to simple editor
      const { children: _, ...editorProps } = this.props;
      return <SimpleMarkdownEditor {...editorProps} />;
    }

    return this.props.children;
  }
}
