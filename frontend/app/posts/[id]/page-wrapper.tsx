"use client";

import { PostErrorBoundary } from "@/components/error-boundary/post-error-boundary";
import PostDetailPage from "./page";

export default function PostDetailPageWrapper() {
  return (
    <PostErrorBoundary>
      <PostDetailPage />
    </PostErrorBoundary>
  );
}
