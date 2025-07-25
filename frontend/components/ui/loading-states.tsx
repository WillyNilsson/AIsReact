"use client";

import {
  Loader2,
  RefreshCw,
  CloudUpload,
  Search,
  Shield,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface LoadingStateProps {
  message?: string;
  submessage?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  type?: "spinner" | "dots" | "progress" | "pulse";
  icon?: React.ReactNode;
}

// Default loading spinner
export function LoadingSpinner({
  message = "Loading...",
  className,
  size = "md",
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center space-y-2",
        className,
      )}
    >
      <Loader2
        className={cn(
          sizeClasses[size],
          "animate-spin text-blue-600 dark:text-blue-400",
        )}
      />
      {message && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
      )}
    </div>
  );
}

// Three dots loading animation
export function LoadingDots({ message, className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center space-y-3",
        className,
      )}
    >
      <div className="flex space-x-1">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"
            animate={{
              y: [0, -10, 0],
              opacity: [1, 0.5, 1],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: index * 0.15,
            }}
          />
        ))}
      </div>
      {message && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
      )}
    </div>
  );
}

// Progress bar loading
export function LoadingProgress({
  message,
  submessage,
  className,
  progress = 0,
}: LoadingStateProps & { progress?: number }) {
  return (
    <div className={cn("w-full space-y-2", className)}>
      {message && (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {message}
        </p>
      )}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-blue-600 dark:bg-blue-400 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      {submessage && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{submessage}</p>
      )}
    </div>
  );
}

// Pulse loading for cards
export function LoadingPulse({ className }: LoadingStateProps) {
  return (
    <div className={cn("animate-pulse space-y-3", className)}>
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
    </div>
  );
}

// Specific loading states for different actions
export function SubmittingState({
  message = "Submitting your post...",
}: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center space-x-3 p-4">
      <CloudUpload className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-bounce" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

export function VerifyingState({
  message = "Verifying content...",
}: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center space-x-3 p-4">
      <Shield className="w-5 h-5 text-green-600 dark:text-green-400 animate-pulse" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

export function SearchingState({
  message = "Searching...",
}: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center space-x-3 p-4">
      <Search className="w-5 h-5 text-gray-600 dark:text-gray-400 animate-pulse" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

export function RefreshingState({
  message = "Refreshing...",
}: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center space-x-3 p-4">
      <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400 animate-spin" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

// Loading overlay for full-page or section loading
export function LoadingOverlay({
  message,
  submessage,
  type = "spinner",
}: LoadingStateProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-xl space-y-4 max-w-sm w-full mx-4">
        {type === "spinner" && <LoadingSpinner message={message} size="lg" />}
        {type === "dots" && <LoadingDots message={message} />}
        {type === "progress" && (
          <LoadingProgress message={message} submessage={submessage} />
        )}
      </div>
    </div>
  );
}

// Button loading state
export function ButtonLoading({
  children,
  loading,
  loadingText = "Loading...",
  className,
}: {
  children: React.ReactNode;
  loading: boolean;
  loadingText?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className={cn(loading && "invisible")}>{children}</span>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm">{loadingText}</span>
        </div>
      )}
    </div>
  );
}

// Inline loading for text
export function InlineLoading({ text = "Loading" }: { text?: string }) {
  return (
    <span className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400">
      {text}
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="ml-1"
      >
        ...
      </motion.span>
    </span>
  );
}

// Success state after loading
export function LoadingSuccess({ message = "Success!" }: LoadingStateProps) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center justify-center space-x-2 text-green-600 dark:text-green-400"
    >
      <CheckCircle className="w-5 h-5" />
      <span className="font-medium">{message}</span>
    </motion.div>
  );
}
