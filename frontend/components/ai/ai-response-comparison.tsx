"use client";

import { useState } from "react";
import { AIResponse } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  Zap,
  AlertCircle,
  Brain,
  History,
  TrendingUp,
  MessageSquare,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Copy,
  Check,
  BarChart3,
  GitCompare,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface AIResponseComparisonProps {
  responses: AIResponse[];
  aspect: "summary" | "historical" | "future" | "opinions";
}

// Model provider info
const providerLogos: Record<string, string> = {
  o3: "🟢",
  gpt: "🟢",
  gemini: "🔷",
  claude: "🟧",
  grok: "🟣",
  deepseek: "🔴",
};

const providerNames: Record<string, string> = {
  o3: "OpenAI o3",
  gpt: "OpenAI GPT",
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
  grok: "xAI Grok",
  deepseek: "DeepSeek",
};

const aspectIcons = {
  summary: Brain,
  historical: History,
  future: TrendingUp,
  opinions: MessageSquare,
};

export function AIResponseComparison({
  responses,
  aspect,
}: AIResponseComparisonProps) {
  const [viewMode, setViewMode] = useState<"grid" | "unified">("grid");
  const [copiedContent, setCopiedContent] = useState<string | null>(null);

  const successfulResponses = responses.filter((r) => r.is_successful);

  if (successfulResponses.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">
          No successful AI responses to compare
        </p>
      </div>
    );
  }

  const getProviderInfo = (modelName: string) => {
    const provider = Object.keys(providerLogos).find((key) =>
      modelName.toLowerCase().includes(key),
    );
    return {
      logo: provider ? providerLogos[provider] : "⚪",
      name: provider ? providerNames[provider] : modelName,
      color: provider ? modelColors[provider] : "bg-gray-500",
    };
  };

  const getAspectContent = (response: AIResponse) => {
    const data = response.response_data;
    if (!data) {
      return "";
    }

    switch (aspect) {
      case "summary":
        return data.summary;
      case "historical":
        return data.historical_context;
      case "future":
        return data.future_development;
      case "opinions":
        return data.opinions;
      default:
        return "";
    }
  };

  const aspectTitles = {
    summary: "Summary",
    historical: "Historical Context",
    future: "Future Development",
    opinions: "Opinions and Thoughts",
  };

  const modelColors: Record<string, string> = {
    o3: "bg-emerald-500",
    gpt: "bg-emerald-500",
    gemini: "bg-blue-500",
    claude: "bg-orange-500",
    grok: "bg-purple-500",
    deepseek: "bg-red-500",
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedContent(id);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedContent(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const Icon = aspectIcons[aspect];
  const analysis = analyzeResponses(successfulResponses, aspect);

  return (
    <div className="space-y-6">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Icon className="w-5 h-5" />
          {aspectTitles[aspect]} Comparison
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "primary" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Grid View
          </Button>
          <Button
            variant={viewMode === "unified" ? "primary" : "outline"}
            size="sm"
            onClick={() => setViewMode("unified")}
          >
            <GitCompare className="w-4 h-4 mr-2" />
            Unified View
          </Button>
        </div>
      </div>

      {/* Consensus Overview */}
      {successfulResponses.length > 1 && (
        <Card className="p-6 bg-muted/30 border-2">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Consensus Analysis
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Agreement Level
              </p>
              <div className="flex items-center gap-2">
                {analysis.agreementLevel === "High" && (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
                {analysis.agreementLevel === "Moderate" && (
                  <MinusCircle className="w-4 h-4 text-yellow-500" />
                )}
                {analysis.agreementLevel === "Low" && (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="font-semibold">{analysis.agreementLevel}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Key Themes
              </p>
              <div className="flex flex-wrap gap-1">
                {analysis.keyThemes.map((theme, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Sentiment
              </p>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                    style={{ width: `${analysis.sentiment}%` }}
                  />
                </div>
                <span className="text-xs font-medium">
                  {analysis.sentiment}%
                </span>
              </div>
            </div>
          </div>

          {/* Common points */}
          {analysis.commonPoints.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Points of Agreement:
              </p>
              <ul className="text-sm space-y-1">
                {analysis.commonPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {successfulResponses.map((response) => {
            const providerInfo = getProviderInfo(response.model_name);
            const content = getAspectContent(response);

            return (
              <Card
                key={response.id}
                className="relative overflow-hidden group"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${providerInfo.color}`}
                />

                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{providerInfo.logo}</span>
                      <div>
                        <h4 className="font-medium">{providerInfo.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {response.model_name}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(content || "", String(response.id))
                      }
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {copiedContent === String(response.id) ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>

                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed line-clamp-6">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    {response.response_time_ms && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{response.response_time_ms}ms</span>
                      </div>
                    )}
                    {response.token_count && (
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span>{response.token_count}</span>
                      </div>
                    )}
                  </div>

                  {response.response_data?._fallback && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      Fallback
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Unified View */}
      {viewMode === "unified" && (
        <Card className="p-6">
          <Tabs
            defaultValue={String(successfulResponses[0]?.id)}
            className="w-full"
          >
            <TabsList
              className="grid w-full"
              style={{
                gridTemplateColumns: `repeat(${successfulResponses.length}, 1fr)`,
              }}
            >
              {successfulResponses.map((response) => {
                const providerInfo = getProviderInfo(response.model_name);
                return (
                  <TabsTrigger
                    key={response.id}
                    value={String(response.id)}
                    className="flex items-center gap-2"
                  >
                    <span>{providerInfo.logo}</span>
                    <span className="hidden sm:inline">
                      {providerInfo.name}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {successfulResponses.map((response) => {
              const content = getAspectContent(response);
              const highlights = analysis.highlights[response.model_name] || [];

              return (
                <TabsContent
                  key={response.id}
                  value={String(response.id)}
                  className="mt-6"
                >
                  <div className="space-y-4">
                    {/* Unique insights for this model */}
                    {highlights.length > 0 && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium mb-2">
                          Unique insights from this model:
                        </p>
                        <ul className="text-sm space-y-1">
                          {highlights.map((point, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Brain className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Full content */}
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{content}</ReactMarkdown>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
                      {response.response_time_ms && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>
                            {response.response_time_ms}ms response time
                          </span>
                        </div>
                      )}
                      {response.token_count && (
                        <div className="flex items-center gap-1">
                          <Zap className="w-4 h-4" />
                          <span>{response.token_count} tokens used</span>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </Card>
      )}
    </div>
  );
}

// Enhanced analysis function
function analyzeResponses(responses: AIResponse[], aspect: string) {
  const contents = responses
    .map((r) => {
      const data = r.response_data;
      if (!data) {
        return "";
      }

      switch (aspect) {
        case "summary":
          return data.summary;
        case "historical":
          return data.historical_context;
        case "future":
          return data.future_development;
        case "opinions":
          return data.opinions;
        default:
          return "";
      }
    })
    .filter((content): content is string => content !== undefined);

  // Calculate agreement level
  const agreementLevel = calculateAgreementLevel(contents);

  // Extract key themes
  const keyThemes = extractKeyThemes(contents);

  // Calculate sentiment (simplified - in production use proper NLP)
  const sentiment = calculateSentiment(contents);

  // Find common points
  const commonPoints = findCommonPoints(contents);

  // Find unique highlights per model
  const highlights: Record<string, string[]> = {};
  responses.forEach((response, i) => {
    const uniquePoints = findUniquePoints(contents[i], contents);
    highlights[response.model_name] = uniquePoints;
  });

  return {
    agreementLevel,
    keyThemes,
    sentiment,
    commonPoints,
    highlights,
  };
}

function calculateAgreementLevel(
  contents: string[],
): "High" | "Moderate" | "Low" {
  // Simple similarity check - in production use cosine similarity or similar
  const allWords = contents.join(" ").toLowerCase().split(/\s+/);
  const uniqueWords = new Set(allWords);
  const commonality = allWords.length / (uniqueWords.size * contents.length);

  if (commonality > 1.5) {
    return "High";
  }
  if (commonality > 1.2) {
    return "Moderate";
  }
  return "Low";
}

function extractKeyThemes(contents: string[]): string[] {
  const text = contents.join(" ").toLowerCase();
  const words = text.split(/\s+/);
  const stopWords = new Set([
    "the",
    "is",
    "at",
    "which",
    "on",
    "and",
    "a",
    "an",
    "as",
    "are",
    "was",
    "were",
    "been",
    "be",
    "or",
    "of",
    "to",
    "in",
    "for",
    "with",
    "that",
    "this",
    "it",
    "from",
    "by",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "has",
    "have",
    "had",
    "do",
    "does",
    "did",
    "ai",
    "eu",
  ]);

  const phrases: Record<string, number> = {};

  // Extract 2-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    if (
      !stopWords.has(words[i]) &&
      !stopWords.has(words[i + 1]) &&
      words[i].length > 3 &&
      words[i + 1].length > 3
    ) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      phrases[phrase] = (phrases[phrase] || 0) + 1;
    }
  }

  // Get top phrases
  return Object.entries(phrases)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([phrase]) =>
      phrase
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    );
}

function calculateSentiment(contents: string[]): number {
  // Very simplified sentiment - in production use proper sentiment analysis
  const positive = [
    "positive",
    "good",
    "great",
    "excellent",
    "beneficial",
    "important",
    "necessary",
    "progress",
    "innovation",
    "success",
  ];
  const negative = [
    "negative",
    "bad",
    "poor",
    "harmful",
    "concern",
    "risk",
    "danger",
    "stifle",
    "hinder",
    "threat",
  ];

  const text = contents.join(" ").toLowerCase();
  let score = 50; // neutral

  positive.forEach((word) => {
    if (text.includes(word)) {
      score += 5;
    }
  });

  negative.forEach((word) => {
    if (text.includes(word)) {
      score -= 5;
    }
  });

  return Math.max(0, Math.min(100, score));
}

function findCommonPoints(contents: string[]): string[] {
  // Find sentences that appear in multiple responses
  const sentences = contents.flatMap((c) =>
    c
      .split(/[.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20),
  );

  const sentenceGroups: Record<string, number> = {};

  sentences.forEach((sentence) => {
    // Normalize and check for similar sentences
    const normalized = sentence.toLowerCase().replace(/[^\w\s]/g, "");
    const words = normalized.split(/\s+/);

    if (words.length > 5) {
      const key = words.slice(0, 5).join(" ");
      sentenceGroups[key] = (sentenceGroups[key] || 0) + 1;
    }
  });

  return Object.entries(sentenceGroups)
    .filter(([, count]) => count >= 2)
    .slice(0, 3)
    .map(([key]) => {
      const original = sentences.find((s) =>
        s
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .startsWith(key),
      );
      return original || key;
    });
}

function findUniquePoints(content: string, allContents: string[]): string[] {
  // Find points unique to this response
  const sentences = content
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);
  const otherContent = allContents
    .filter((c) => c !== content)
    .join(" ")
    .toLowerCase();

  const unique = sentences.filter((sentence) => {
    const words = sentence.toLowerCase().split(/\s+/).slice(0, 5);
    const phrase = words.join(" ");
    return !otherContent.includes(phrase);
  });

  return unique.slice(0, 2);
}
