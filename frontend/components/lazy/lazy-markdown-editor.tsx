"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownEditorBoundary } from "@/components/error-boundary/markdown-editor-boundary";
import type { MarkdownEditorProps } from "@/components/ui/markdown-editor-rich";

// Loading component for better UX
const MarkdownEditorLoader = () => (
  <div className="space-y-2">
    <Skeleton className="h-10 w-full bg-[#2f3549]" />
    <Skeleton className="h-64 w-full bg-[#2f3549]" />
  </div>
);

// Dynamically import the Markdown Editor with error handling
const DynamicMarkdownEditor = dynamic(
  () =>
    import("@/components/ui/markdown-editor-rich").catch(() => {
      // If import fails, return simple editor as fallback
      return import("@/components/ui/markdown-editor-simple");
    }),
  {
    ssr: false,
    loading: () => <MarkdownEditorLoader />,
  },
);

// Wrapper component with error boundary
export const LazyMarkdownEditor: React.FC<MarkdownEditorProps> = (props) => {
  return (
    <MarkdownEditorBoundary {...props}>
      <DynamicMarkdownEditor {...props} />
    </MarkdownEditorBoundary>
  );
};

// Re-export the props type for type safety
export type { MarkdownEditorProps };
