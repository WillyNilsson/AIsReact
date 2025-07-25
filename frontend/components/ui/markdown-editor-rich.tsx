"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { cn } from "@/lib/utils";

// Dynamic import to avoid SSR issues
const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default || mod),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse bg-surface-100 rounded-lg h-64" />
    ),
  },
);

export interface MarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
}

const MarkdownEditor = ({
  value = "",
  onChange,
  placeholder = "Write your content here...",
  disabled = false,
  minHeight = 200,
  maxHeight = 500,
  className,
}: MarkdownEditorProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn("animate-pulse bg-surface-100 rounded-lg", className)}
        style={{ minHeight }}
      />
    );
  }

  return (
    <div
      className={cn(
        "markdown-editor-wrapper rounded-lg overflow-hidden",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
      data-color-mode="dark"
    >
      <style jsx global>{`
        /* CSS Variables */
        .markdown-editor-wrapper {
          --color-surface: #24283b;
          --color-surface-100: #2f3549;
          --color-surface-200: #414868;
          --color-border: #414868;
          --color-text-primary: #c0caf5;
          --color-text-secondary: #9aa5ce;
          --color-accent: #7aa2f7;
          --color-accent-hover: #89b4fa;
          --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Consolas,
            "Liberation Mono", Menlo, monospace;
        }

        /* Edit-only mode layout */
        .markdown-editor-wrapper .w-md-editor {
          display: flex !important;
          flex-direction: column !important;
        }

        .markdown-editor-wrapper .w-md-editor-content {
          flex: 1 !important;
          min-height: 0 !important;
        }

        .markdown-editor-wrapper .w-md-editor-text-pre,
        .markdown-editor-wrapper .w-md-editor-text-input,
        .markdown-editor-wrapper .w-md-editor-text {
          width: 100% !important;
          overflow: auto !important;
          line-height: 1.6 !important;
          font-size: 14px !important;
          color: var(--color-text-primary) !important;
        }

        .markdown-editor-wrapper .w-md-editor-text-input,
        .markdown-editor-wrapper .w-md-editor-text textarea {
          color: var(--color-text-primary) !important;
          caret-color: var(--color-text-primary) !important;
        }

        .markdown-editor-wrapper .w-md-editor {
          background-color: var(--color-surface);
          color: var(--color-text-primary);
        }

        .markdown-editor-wrapper .w-md-editor-toolbar {
          background-color: var(--color-surface-100);
          border-bottom: 1px solid var(--color-border);
        }

        .markdown-editor-wrapper .w-md-editor-toolbar button {
          color: var(--color-text-secondary);
        }

        .markdown-editor-wrapper .w-md-editor-toolbar button:hover {
          color: var(--color-text-primary);
          background-color: var(--color-surface-200);
        }

        .markdown-editor-wrapper .w-md-editor-toolbar button.active {
          color: var(--color-accent);
          background-color: var(--color-surface-200);
        }

        .markdown-editor-wrapper .w-md-editor-text-pre,
        .markdown-editor-wrapper .w-md-editor-text-input,
        .markdown-editor-wrapper .w-md-editor-text {
          color: var(--color-text-primary) !important;
          background-color: transparent !important;
          font-family: var(--font-mono);
        }

        .markdown-editor-wrapper .w-md-editor-text-pre .token.title {
          color: var(--color-text-primary) !important;
        }

        .markdown-editor-wrapper .w-md-editor-text-pre .token {
          color: var(--color-text-primary) !important;
        }

        .markdown-editor-wrapper .wmde-markdown {
          background-color: var(--color-surface) !important;
          color: var(--color-text-primary) !important;
          word-wrap: break-word !important;
          word-break: normal !important;
          overflow-wrap: break-word !important;
          white-space: pre-wrap !important;
          padding: 1rem !important;
        }

        .markdown-editor-wrapper .wmde-markdown p {
          word-wrap: break-word !important;
          word-break: normal !important;
          overflow-wrap: break-word !important;
          white-space: pre-wrap !important;
          margin-bottom: 1rem !important;
        }

        .markdown-editor-wrapper .wmde-markdown pre {
          white-space: pre !important;
          overflow-x: auto !important;
        }

        .markdown-editor-wrapper .wmde-markdown code {
          white-space: pre !important;
          word-break: normal !important;
        }

        .markdown-editor-wrapper .wmde-markdown h1,
        .markdown-editor-wrapper .wmde-markdown h2,
        .markdown-editor-wrapper .wmde-markdown h3,
        .markdown-editor-wrapper .wmde-markdown h4,
        .markdown-editor-wrapper .wmde-markdown h5,
        .markdown-editor-wrapper .wmde-markdown h6 {
          color: var(--color-text-primary);
          border-color: var(--color-border);
        }

        .markdown-editor-wrapper .wmde-markdown code {
          background-color: var(--color-surface-100);
          color: var(--color-accent);
        }

        .markdown-editor-wrapper .wmde-markdown pre {
          background-color: var(--color-surface-100);
          border-color: var(--color-border);
        }

        .markdown-editor-wrapper .wmde-markdown blockquote {
          border-left-color: var(--color-accent);
          color: var(--color-text-secondary);
        }

        .markdown-editor-wrapper .wmde-markdown a {
          color: var(--color-accent);
        }

        .markdown-editor-wrapper .wmde-markdown a:hover {
          color: var(--color-accent-hover);
        }

        .markdown-editor-wrapper .wmde-markdown table {
          border-color: var(--color-border);
        }

        .markdown-editor-wrapper .wmde-markdown table th,
        .markdown-editor-wrapper .wmde-markdown table td {
          border-color: var(--color-border);
        }

        .markdown-editor-wrapper .wmde-markdown table th {
          background-color: var(--color-surface-100);
        }

        /* Responsive styles */
        @media (max-width: 768px) {
          .markdown-editor-wrapper .w-md-editor-content {
            flex-direction: column !important;
          }

          .markdown-editor-wrapper .w-md-editor-input,
          .markdown-editor-wrapper .w-md-editor-preview {
            flex: 1 1 auto !important;
            min-height: 200px !important;
          }
        }

        /* Fix toolbar wrapping */
        .markdown-editor-wrapper .w-md-editor-toolbar {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: wrap !important;
          gap: 2px !important;
          align-items: center !important;
        }

        /* Ensure toolbar items stay horizontal */
        .markdown-editor-wrapper .w-md-editor-toolbar ul {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: wrap !important;
          list-style: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .markdown-editor-wrapper .w-md-editor-toolbar li {
          display: inline-flex !important;
          margin: 0 !important;
        }

        /* Ensure text visibility in edit mode */
        .markdown-editor-wrapper
          .w-md-editor.w-md-editor-focus
          .w-md-editor-text-pre,
        .markdown-editor-wrapper .w-md-editor .w-md-editor-text-pre {
          color: var(--color-text-primary) !important;
        }

        .markdown-editor-wrapper
          .w-md-editor.w-md-editor-focus
          .w-md-editor-text-input,
        .markdown-editor-wrapper .w-md-editor .w-md-editor-text-input,
        .markdown-editor-wrapper .w-md-editor textarea {
          color: var(--color-text-primary) !important;
          -webkit-text-fill-color: var(--color-text-primary) !important;
        }
      `}</style>

      <MDEditor
        value={value}
        onChange={(val) => onChange?.(val || "")}
        preview="edit"
        height={minHeight}
        maxHeight={maxHeight}
        textareaProps={{
          placeholder,
          disabled,
        }}
        previewOptions={{
          disallowedElements: ["script", "iframe", "object", "embed"],
        }}
        hideToolbar={false}
        enableScroll={true}
      />
    </div>
  );
};

export default MarkdownEditor;
