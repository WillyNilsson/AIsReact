"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";

interface VoteButtonsProps {
  postId: number;
  userVote: "positive" | "negative" | null | undefined;
  isVoting: boolean;
  onVote: (vote: boolean) => Promise<void>;
  className?: string;
}

export function VoteButtons({
  userVote,
  isVoting,
  onVote,
  className,
}: VoteButtonsProps) {
  return (
    <div className={cn("flex gap-3", className)}>
      <Button
        variant={userVote === "positive" ? "primary" : "outline"}
        className={cn(
          "flex-1 transition-all",
          userVote === "positive" &&
            "!bg-green-600 hover:!bg-green-700 !text-white !shadow-green-600/25",
        )}
        disabled={isVoting}
        onClick={() => onVote(true)}
      >
        {userVote === "positive" ? (
          <>
            <CheckCircle2 className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
            Accurate
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
            Accurate
          </>
        )}
      </Button>
      <Button
        variant={userVote === "negative" ? "danger" : "outline"}
        className={cn(
          "flex-1 transition-all",
          userVote === "negative" && "!shadow-red-600/25",
        )}
        disabled={isVoting}
        onClick={() => onVote(false)}
      >
        {userVote === "negative" ? (
          <>
            <XCircle className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
            Inaccurate
          </>
        ) : (
          <>
            <XCircle className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
            Inaccurate
          </>
        )}
      </Button>
    </div>
  );
}
