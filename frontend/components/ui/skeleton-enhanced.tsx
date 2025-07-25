import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function SkeletonEnhanced({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "pulse" | "wave" | "shimmer";
}) {
  const variants = {
    default: "bg-gray-800/50",
    pulse: "bg-gray-800/50 animate-pulse",
    wave: "bg-gradient-to-r from-gray-800/50 via-gray-700/50 to-gray-800/50 bg-[length:200%_100%] animate-wave",
    shimmer:
      "bg-gradient-to-r from-gray-800/50 via-gray-700/30 to-gray-800/50 bg-[length:200%_100%] animate-shimmer",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("rounded-xl", variants[variant], className)}
    />
  );
}
