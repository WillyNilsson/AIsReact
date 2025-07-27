"use client";

import { useState } from "react";
import { AIResponse } from "@/lib/types";
import { AIResponseCard } from "./ai-response-card";
import { AIResponseErrorBoundary } from "@/components/error-boundary/ai-response-error-boundary";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, GitCompare } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface AIResponsesViewProps {
  responses: AIResponse[];
  isLoading?: boolean;
  postId?: number;
}

export function AIResponsesView({
  responses,
  isLoading,
}: AIResponsesViewProps) {
  const [expandedCards] = useState<Set<number>>(new Set());
  const [showComparison, setShowComparison] = useState(true);

  // Ensure responses is always an array and filter out null/undefined entries
  const safeResponses = (responses || []).filter(
    (r) => r !== null && r !== undefined,
  );

  const successfulResponses = safeResponses.filter(
    (r) =>
      r &&
      r.is_successful &&
      r.response_data !== null &&
      r.response_data !== undefined,
  );

  // Define the desired order of AI models
  const modelOrder = ["gpt", "gemini", "grok", "deepseek", "claude"];

  // Sort responses according to the defined order
  const sortedSuccessfulResponses = [...successfulResponses].sort((a, b) => {
    const aModelName = (a.model_name || "").toLowerCase();
    const bModelName = (b.model_name || "").toLowerCase();

    // Find the position of each model in the order array
    const aIndex = modelOrder.findIndex((model) => aModelName.includes(model));
    const bIndex = modelOrder.findIndex((model) => bModelName.includes(model));

    // If both models are found in the order array, sort by their positions
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // If only one is found, prioritize the one in the order array
    if (aIndex !== -1) {
      return -1;
    }
    if (bIndex !== -1) {
      return 1;
    }
    // If neither is found, maintain original order
    return 0;
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  // Empty state
  if (safeResponses.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No AI analysis has been performed yet.</p>
      </div>
    );
  }

  // Main render
  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">AI Analysis</h2>
          {sortedSuccessfulResponses.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {sortedSuccessfulResponses.length} response
              {sortedSuccessfulResponses.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {sortedSuccessfulResponses.length >= 2 && (
            <Button
              variant={showComparison ? "primary" : "outline"}
              size="sm"
              onClick={() => setShowComparison(!showComparison)}
            >
              <GitCompare className="w-4 h-4 mr-2" />
              {showComparison ? "Hide" : "Show"} Comparison
            </Button>
          )}

          {/* Grid/List view toggle and Expand/Collapse buttons removed */}

          {/* Compare All button removed */}
        </div>
      </div>

      {/* Response display */}
      {sortedSuccessfulResponses.length > 0 && (
        <>
          {/* Comparison view - shown when enabled and multiple responses exist */}
          {showComparison && sortedSuccessfulResponses.length > 1 && (
            <div className="space-y-4">
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="historical">Historical</TabsTrigger>
                  <TabsTrigger value="future">Future</TabsTrigger>
                  <TabsTrigger value="opinions">Opinions</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4">
                  <h4 className="text-lg font-medium mb-3">Summaries</h4>
                  {sortedSuccessfulResponses.map((response) => {
                    if (!response || !response.id) {
                      return null;
                    }
                    const modelName = response.model_name?.toLowerCase() || "";
                    const borderColor =
                      modelName.includes("o3") || modelName.includes("gpt")
                        ? "#10b981"
                        : modelName.includes("gemini")
                          ? "#3b82f6"
                          : modelName.includes("claude")
                            ? "#f97316"
                            : modelName.includes("grok")
                              ? "#a855f7"
                              : modelName.includes("deepseek")
                                ? "#ef4444"
                                : "#6b7280";

                    return (
                      <div
                        key={response.id}
                        className="border-l-4 pl-4 py-3 hover:bg-gray-800/30 rounded-r-lg transition-colors"
                        style={{ borderColor }}
                      >
                        <h5 className="font-medium text-sm mb-2 text-gray-300">
                          {response.model_name}
                        </h5>
                        <div className="text-sm text-gray-300 leading-relaxed prose prose-sm prose-invert max-w-none prose-p:text-gray-300 prose-li:text-gray-300 prose-headings:text-gray-200">
                          <ReactMarkdown>
                            {response?.response_data?.summary ||
                              "No summary available"}
                          </ReactMarkdown>
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>

                <TabsContent value="historical" className="space-y-4">
                  <h4 className="text-lg font-medium mb-3">
                    Historical Context
                  </h4>
                  {sortedSuccessfulResponses.map((response) => {
                    if (!response || !response.id) {
                      return null;
                    }
                    const modelName = response.model_name?.toLowerCase() || "";
                    const borderColor =
                      modelName.includes("o3") || modelName.includes("gpt")
                        ? "#10b981"
                        : modelName.includes("gemini")
                          ? "#3b82f6"
                          : modelName.includes("claude")
                            ? "#f97316"
                            : modelName.includes("grok")
                              ? "#a855f7"
                              : modelName.includes("deepseek")
                                ? "#ef4444"
                                : "#6b7280";

                    return (
                      <div
                        key={response.id}
                        className="border-l-4 pl-4 py-3 hover:bg-gray-800/30 rounded-r-lg transition-colors"
                        style={{ borderColor }}
                      >
                        <h5 className="font-medium text-sm mb-2 text-gray-300">
                          {response.model_name}
                        </h5>
                        <div className="text-sm text-gray-300 leading-relaxed prose prose-sm prose-invert max-w-none prose-p:text-gray-300 prose-li:text-gray-300 prose-headings:text-gray-200">
                          <ReactMarkdown>
                            {response?.response_data?.historical_context ||
                              response?.response_data?.impact_assessment ||
                              "No historical context available"}
                          </ReactMarkdown>
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>

                <TabsContent value="future" className="space-y-4">
                  <h4 className="text-lg font-medium mb-3">
                    Future Development
                  </h4>
                  {sortedSuccessfulResponses.map((response) => {
                    if (!response || !response.id) {
                      return null;
                    }
                    const modelName = response.model_name?.toLowerCase() || "";
                    const borderColor =
                      modelName.includes("o3") || modelName.includes("gpt")
                        ? "#10b981"
                        : modelName.includes("gemini")
                          ? "#3b82f6"
                          : modelName.includes("claude")
                            ? "#f97316"
                            : modelName.includes("grok")
                              ? "#a855f7"
                              : modelName.includes("deepseek")
                                ? "#ef4444"
                                : "#6b7280";

                    return (
                      <div
                        key={response.id}
                        className="border-l-4 pl-4 py-3 hover:bg-gray-800/30 rounded-r-lg transition-colors"
                        style={{ borderColor }}
                      >
                        <h5 className="font-medium text-sm mb-2 text-gray-300">
                          {response.model_name}
                        </h5>
                        <div className="text-sm text-gray-300 leading-relaxed prose prose-sm prose-invert max-w-none prose-p:text-gray-300 prose-li:text-gray-300 prose-headings:text-gray-200">
                          <ReactMarkdown>
                            {response?.response_data?.future_development ||
                              response?.response_data?.objectivity_analysis ||
                              "No future development analysis available"}
                          </ReactMarkdown>
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>

                <TabsContent value="opinions" className="space-y-4">
                  <h4 className="text-lg font-medium mb-3">
                    Opinions & Thoughts
                  </h4>
                  {sortedSuccessfulResponses.map((response) => {
                    if (!response || !response.id) {
                      return null;
                    }
                    const modelName = response.model_name?.toLowerCase() || "";
                    const borderColor =
                      modelName.includes("o3") || modelName.includes("gpt")
                        ? "#10b981"
                        : modelName.includes("gemini")
                          ? "#3b82f6"
                          : modelName.includes("claude")
                            ? "#f97316"
                            : modelName.includes("grok")
                              ? "#a855f7"
                              : modelName.includes("deepseek")
                                ? "#ef4444"
                                : "#6b7280";

                    return (
                      <div
                        key={response.id}
                        className="border-l-4 pl-4 py-3 hover:bg-gray-800/30 rounded-r-lg transition-colors"
                        style={{ borderColor }}
                      >
                        <h5 className="font-medium text-sm mb-2 text-gray-300">
                          {response.model_name}
                        </h5>
                        <div className="text-sm text-gray-300 leading-relaxed prose prose-sm prose-invert max-w-none prose-p:text-gray-300 prose-li:text-gray-300 prose-headings:text-gray-200">
                          <ReactMarkdown>
                            {response?.response_data?.opinions ||
                              (Array.isArray(
                                response?.response_data?.key_quotes,
                              )
                                ? response.response_data.key_quotes.join("\n\n")
                                : response?.response_data?.key_quotes) ||
                              "No opinions available"}
                          </ReactMarkdown>
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Individual Response cards - always shown */}
          <div className="space-y-4">
            {sortedSuccessfulResponses.map((response) => {
              if (!response || !response.id) {
                return null;
              }
              return (
                <AIResponseErrorBoundary
                  key={response.id}
                  modelName={response.model_name || "Unknown"}
                >
                  <AIResponseCard
                    response={response}
                    isExpanded={expandedCards.has(response.id)}
                  />
                </AIResponseErrorBoundary>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
