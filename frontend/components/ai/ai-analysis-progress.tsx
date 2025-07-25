"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useWebSocketEvent } from "@/lib/hooks/useWebSocket"; // Commented out - using simpler solution
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AIProviderStatus {
  provider: string;
  status: "pending" | "processing" | "completed" | "failed" | "timeout";
  startTime?: number;
  endTime?: number;
  error?: string;
  responseTime?: number;
}

interface AIAnalysisProgressProps {
  postId: number;
  onComplete?: () => void;
  onRefresh?: () => void;
  initialProviders?: string[];
}

const AI_PROVIDERS = [
  { key: "gpt-4", name: "OpenAI GPT-4", color: "from-emerald-500 to-teal-600" },
  {
    key: "claude-3",
    name: "Anthropic Claude",
    color: "from-orange-500 to-amber-600",
  },
  {
    key: "gemini-pro",
    name: "Google Gemini",
    color: "from-blue-500 to-indigo-600",
  },
  { key: "grok-2", name: "xAI Grok", color: "from-purple-500 to-pink-600" },
  { key: "deepseek-v2", name: "DeepSeek", color: "from-red-500 to-rose-600" },
];

const PROVIDER_TIMEOUT = 30000; // 30 seconds per provider
const OVERALL_TIMEOUT = 120000; // 2 minutes overall

export function AIAnalysisProgress({
  postId,
  onComplete,
  onRefresh,
  initialProviders = AI_PROVIDERS.map((p) => p.key),
}: AIAnalysisProgressProps) {
  const [providerStatuses, setProviderStatuses] = useState<
    Map<string, AIProviderStatus>
  >(
    new Map(
      initialProviders.map((provider) => [
        provider,
        { provider, status: "pending" },
      ]),
    ),
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const overallTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Define callbacks before using them
  const checkIfAllComplete = useCallback(() => {
    setProviderStatuses((prev) => {
      const allStatuses = Array.from(prev.values());
      const pending = allStatuses.filter(
        (s) => s.status === "pending" || s.status === "processing",
      );

      if (pending.length === 0) {
        setIsAnalyzing(false);

        // Clear overall timeout
        if (overallTimeoutRef.current) {
          clearTimeout(overallTimeoutRef.current);
          overallTimeoutRef.current = null;
        }

        // Clear all provider timeouts
        timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
        timeoutRefs.current.clear();

        if (onComplete) {
          onComplete();
        }
      }

      // Update overall progress
      const completed = allStatuses.filter(
        (s) =>
          s.status === "completed" ||
          s.status === "failed" ||
          s.status === "timeout",
      ).length;
      setOverallProgress((completed / allStatuses.length) * 100);

      return prev;
    });
  }, [onComplete]);

  const handleProviderTimeout = useCallback(
    (provider: string) => {
      setProviderStatuses((prev) => {
        const updated = new Map(prev);
        const status = updated.get(provider) || { provider, status: "pending" };
        updated.set(provider, {
          ...status,
          status: "timeout",
          endTime: Date.now(),
          error: "Analysis timed out",
        });
        return updated;
      });

      checkIfAllComplete();
    },
    [checkIfAllComplete],
  );

  // Handle analysis started event - commented out for simpler solution
  useWebSocketEvent(
    "ai:analysisStarted",
    useCallback(
      (data: unknown) => {
        const eventData = data as { postId: number; aiModel: string };
        if (eventData.postId !== postId) {
          return;
        }

        setIsAnalyzing(true);
        if (!startTimeRef.current) {
          startTimeRef.current = Date.now();
        }

        setProviderStatuses((prev) => {
          const updated = new Map(prev);
          const status = updated.get(eventData.aiModel) || {
            provider: eventData.aiModel,
            status: "pending",
          };
          updated.set(eventData.aiModel, {
            ...status,
            status: "processing",
            startTime: Date.now(),
          });
          return updated;
        });

        // Set provider-specific timeout
        const timeout = setTimeout(() => {
          handleProviderTimeout(eventData.aiModel);
        }, PROVIDER_TIMEOUT);

        timeoutRefs.current.set(eventData.aiModel, timeout);
      },
      [postId, handleProviderTimeout],
    ),
  );

  // Handle analysis completed event - commented out for simpler solution
  useWebSocketEvent(
    "ai:analysisCompleted",
    useCallback(
      (data: unknown) => {
        const eventData = data as {
          postId: number;
          response?: { model_name?: string; response_time_ms?: number };
        };
        if (eventData.postId !== postId) {
          return;
        }

        const provider = eventData.response?.model_name || "unknown";

        // Clear provider timeout
        const timeout = timeoutRefs.current.get(provider);
        if (timeout) {
          clearTimeout(timeout);
          timeoutRefs.current.delete(provider);
        }

        setProviderStatuses((prev) => {
          const updated = new Map(prev);
          const status = updated.get(provider) || {
            provider,
            status: "pending",
          };
          updated.set(provider, {
            ...status,
            status: "completed",
            endTime: Date.now(),
            responseTime: eventData.response?.response_time_ms,
          });
          return updated;
        });

        checkIfAllComplete();
      },
      [postId, checkIfAllComplete],
    ),
  );

  // Handle analysis error event - commented out for simpler solution
  useWebSocketEvent(
    "ai:analysisError",
    useCallback(
      (data: unknown) => {
        const eventData = data as {
          postId: number;
          aiModel: string;
          error?: string;
        };
        if (eventData.postId !== postId) {
          return;
        }

        // Clear provider timeout
        const timeout = timeoutRefs.current.get(eventData.aiModel);
        if (timeout) {
          clearTimeout(timeout);
          timeoutRefs.current.delete(eventData.aiModel);
        }

        setProviderStatuses((prev) => {
          const updated = new Map(prev);
          const status = updated.get(eventData.aiModel) || {
            provider: eventData.aiModel,
            status: "pending",
          };
          updated.set(eventData.aiModel, {
            ...status,
            status: "failed",
            endTime: Date.now(),
            error: eventData.error,
          });
          return updated;
        });

        checkIfAllComplete();
      },
      [postId, checkIfAllComplete],
    ),
  );

  // Set overall timeout when analysis starts
  useEffect(() => {
    if (isAnalyzing && !overallTimeoutRef.current) {
      overallTimeoutRef.current = setTimeout(() => {
        // Timeout any remaining providers
        setProviderStatuses((prev) => {
          const updated = new Map(prev);
          updated.forEach((status, provider) => {
            if (status.status === "pending" || status.status === "processing") {
              updated.set(provider, {
                ...status,
                status: "timeout",
                endTime: Date.now(),
                error: "Overall analysis timeout",
              });
            }
          });
          return updated;
        });

        setIsAnalyzing(false);
        if (onComplete) {
          onComplete();
        }
      }, OVERALL_TIMEOUT);
    }

    return () => {
      if (overallTimeoutRef.current) {
        clearTimeout(overallTimeoutRef.current);
        overallTimeoutRef.current = null;
      }
    };
  }, [isAnalyzing, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    // Copy refs inside the effect to avoid stale closure issues
    const currentTimeouts = timeoutRefs.current;
    const currentOverallTimeout = overallTimeoutRef.current;

    return () => {
      currentTimeouts.forEach((timeout) => clearTimeout(timeout));
      currentTimeouts.clear();
      if (currentOverallTimeout) {
        clearTimeout(currentOverallTimeout);
      }
    };
  }, []);

  const getStatusIcon = (status: AIProviderStatus["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-gray-400" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "timeout":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusText = (status: AIProviderStatus) => {
    switch (status.status) {
      case "pending":
        return "Waiting...";
      case "processing":
        return "Analyzing...";
      case "completed":
        return status.responseTime ? `${status.responseTime}ms` : "Complete";
      case "failed":
        return status.error || "Failed";
      case "timeout":
        return "Timed out";
    }
  };

  const completedCount = Array.from(providerStatuses.values()).filter(
    (s) => s.status === "completed",
  ).length;

  const failedCount = Array.from(providerStatuses.values()).filter(
    (s) => s.status === "failed" || s.status === "timeout",
  ).length;

  if (!isAnalyzing && providerStatuses.size === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">AI Analysis Progress</h3>
            {isAnalyzing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="w-4 h-4" />
                <span>Analyzing with {providerStatuses.size} AI models</span>
              </div>
            )}
          </div>
          {onRefresh && !isAnalyzing && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Failed
            </Button>
          )}
        </div>

        {/* Overall progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {completedCount} completed, {failedCount} failed
            </span>
            <span className="text-muted-foreground">
              {Math.round(overallProgress)}%
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Individual provider statuses */}
        <div className="space-y-3">
          {AI_PROVIDERS.map((provider) => {
            const status = providerStatuses.get(provider.key);
            if (!status) {
              return null;
            }

            return (
              <div
                key={provider.key}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  status.status === "processing" &&
                    "border-blue-500/20 bg-blue-500/5",
                  status.status === "completed" &&
                    "border-green-500/20 bg-green-500/5",
                  status.status === "failed" &&
                    "border-red-500/20 bg-red-500/5",
                  status.status === "timeout" &&
                    "border-yellow-500/20 bg-yellow-500/5",
                )}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(status.status)}
                  <div>
                    <p className="font-medium">{provider.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {getStatusText(status)}
                    </p>
                  </div>
                </div>
                {status.status === "processing" && status.startTime && (
                  <div className="text-sm text-muted-foreground">
                    {Math.round((Date.now() - status.startTime) / 1000)}s
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Elapsed time */}
        {startTimeRef.current && (
          <div className="text-center text-sm text-muted-foreground">
            Total time: {Math.round((Date.now() - startTimeRef.current) / 1000)}
            s
          </div>
        )}
      </div>
    </Card>
  );
}
