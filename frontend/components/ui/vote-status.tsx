import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoteStatusProps {
  userVote: boolean | null;
  className?: string;
  showText?: boolean;
}

export function VoteStatus({
  userVote,
  className,
  showText = true,
}: VoteStatusProps) {
  if (userVote === null) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
        userVote
          ? "bg-green-100 text-green-700 border border-green-200"
          : "bg-red-100 text-red-700 border border-red-200",
        className,
      )}
    >
      {userVote ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <XCircle className="w-4 h-4" />
      )}
      {showText && (
        <span>{userVote ? "Voted Accurate" : "Voted Inaccurate"}</span>
      )}
    </div>
  );
}
