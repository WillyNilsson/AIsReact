"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Shield, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface AdminApproveButtonProps {
  postId: number;
  className?: string;
  onSuccess?: () => void;
}

export function AdminApproveButton({
  postId,
  className,
  onSuccess,
}: AdminApproveButtonProps) {
  const [isApproving, setIsApproving] = useState(false);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const handleApprove = async () => {
    setIsApproving(true);

    try {
      await api.post(`/api/admin/posts/${postId}/approve/`);

      addToast({
        type: "success",
        title: "Post approved",
        description: "Post has been directly approved for AI analysis",
      });

      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["post", postId] });
      await queryClient.invalidateQueries({
        queryKey: ["verification", "queue"],
      });
      await queryClient.invalidateQueries({ queryKey: ["feed"] });

      onSuccess?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      addToast({
        type: "error",
        title: "Failed to approve post",
        description: errorMessage,
      });
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <Button
      onClick={handleApprove}
      disabled={isApproving}
      variant="primary"
      className={cn(
        "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700",
        className,
      )}
    >
      <Shield className="w-4 h-4 mr-2" />
      {isApproving ? "Approving..." : "Admin Approve"}
    </Button>
  );
}

interface BulkAdminApproveButtonProps {
  postIds: number[];
  className?: string;
  onSuccess?: () => void;
}

export function BulkAdminApproveButton({
  postIds,
  className,
  onSuccess,
}: BulkAdminApproveButtonProps) {
  const [isApproving, setIsApproving] = useState(false);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const handleBulkApprove = async () => {
    if (postIds.length === 0) {
      addToast({
        type: "error",
        title: "No posts selected",
        description: "Please select posts to approve",
      });
      return;
    }

    setIsApproving(true);

    try {
      const response = await api.post("/api/admin/posts/bulk-approve/", {
        post_ids: postIds,
      });

      const { results } = response.data;

      addToast({
        type: "success",
        title: "Bulk approval complete",
        description: `Approved ${results.total_approved} posts`,
      });

      // Invalidate relevant queries
      await queryClient.invalidateQueries({
        queryKey: ["verification", "queue"],
      });
      await queryClient.invalidateQueries({ queryKey: ["moderation"] });
      await queryClient.invalidateQueries({ queryKey: ["feed"] });

      onSuccess?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      addToast({
        type: "error",
        title: "Failed to approve posts",
        description: errorMessage,
      });
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <Button
      onClick={handleBulkApprove}
      disabled={isApproving || postIds.length === 0}
      variant="primary"
      className={cn(
        "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700",
        className,
      )}
    >
      <CheckCircle className="w-4 h-4 mr-2" />
      {isApproving ? "Approving..." : `Admin Approve (${postIds.length})`}
    </Button>
  );
}
