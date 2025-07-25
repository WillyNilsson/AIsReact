"use client";

import { useState, useEffect } from "react";
import { AIResponse } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Zap,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Share2,
  Brain,
  History,
  TrendingUp,
  MessageSquare,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface AIResponseCardProps {
  response: AIResponse;
  isExpanded?: boolean;
}

// Model provider logos using emojis (can be replaced with actual logos)
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

export function AIResponseCard({
  response,
  isExpanded: defaultExpanded = false,
}: AIResponseCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const data = response.response_data || {
    summary: "",
    historical_context: "",
    future_development: "",
    opinions: "",
    _fallback: false,
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle expand/collapse with Space when card is focused
      if (
        e.key === " " &&
        e.target instanceof HTMLElement &&
        e.target.closest("[data-response-card]")
      ) {
        e.preventDefault();
        setIsExpanded(!isExpanded);
      }
      // Copy summary with Ctrl/Cmd+C when card is focused
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "c" &&
        e.target instanceof HTMLElement &&
        e.target.closest("[data-response-card]")
      ) {
        if (!window.getSelection()?.toString()) {
          copyToClipboard(data.summary || "", "summary");
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, data?.summary]);

  const getProviderInfo = (modelName: string | undefined) => {
    if (!modelName) {
      return {
        logo: "⚪",
        name: "Unknown Model",
        color: "from-gray-500 to-gray-600",
      };
    }
    const provider = Object.keys(providerLogos).find((key) =>
      modelName.toLowerCase().includes(key),
    );
    return {
      logo: provider ? providerLogos[provider] : "⚪",
      name: provider ? providerNames[provider] : modelName,
      color:
        provider && providerColors[provider]
          ? providerColors[provider]
          : "from-gray-500 to-gray-600",
    };
  };

  const providerColors: Record<string, string> = {
    o3: "from-emerald-500 to-teal-600",
    gpt: "from-emerald-500 to-teal-600",
    gemini: "from-blue-500 to-indigo-600",
    claude: "from-orange-500 to-amber-600",
    grok: "from-purple-500 to-pink-600",
    deepseek: "from-red-500 to-rose-600",
  };

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedSection(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const exportAsMarkdown = () => {
    const markdown = `# AI Analysis by ${
      getProviderInfo(response.model_name).name
    }

## Summary
${data?.summary || "No summary available"}

## Historical Context
${data?.historical_context || "No historical context available"}

## Future Development
${data?.future_development || "No future development available"}

## Opinions and Thoughts
${data?.opinions || "No opinions available"}

---
*Generated in ${response.response_time_ms}ms with ${
      response.token_count || "unknown"
    } tokens*`;

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-analysis-${response.model_name}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Markdown!");
  };

  const shareResponse = async () => {
    const text = `AI Analysis by ${
      getProviderInfo(response.model_name).name
    }: ${(data?.summary || "").substring(0, 100)}...`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "AI Analysis",
          text: text,
          url: window.location.href,
        });
      } catch {
        // Share cancelled by user
      }
    } else {
      copyToClipboard(window.location.href, "url");
    }
  };

  if (response.error_message) {
    return (
      <Card className="p-6 bg-red-950/20 border-red-900">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {getProviderInfo(response.model_name).logo}
            </span>
            <h3 className="text-lg font-semibold text-red-400">
              {getProviderInfo(response.model_name).name}
            </h3>
          </div>
          <AlertCircle className="w-5 h-5 text-red-500" />
        </div>
        <p className="text-sm text-red-300">
          Analysis failed: {response.error_message}
        </p>
      </Card>
    );
  }

  const isFallback = data._fallback;
  const providerInfo = getProviderInfo(response.model_name);

  // Section configuration with icons
  const sections = [
    { key: "summary", title: "Summary", icon: Brain },
    { key: "historical_context", title: "Historical Context", icon: History },
    {
      key: "future_development",
      title: "Future Development",
      icon: TrendingUp,
    },
    { key: "opinions", title: "Opinions and Thoughts", icon: MessageSquare },
  ];

  return (
    <Card
      className={`overflow-hidden transition-all duration-200 ${
        isFallback ? "opacity-60" : ""
      }`}
      data-response-card
      tabIndex={0}
      role="article"
      aria-label={`AI analysis by ${providerInfo.name}`}
    >
      <div className={`h-2 bg-gradient-to-r ${providerInfo.color}`} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span
              className="text-2xl"
              role="img"
              aria-label={providerInfo.name}
            >
              {providerInfo.logo}
            </span>
            <div>
              <h3 className="text-xl font-semibold">{providerInfo.name}</h3>
              <p className="text-xs text-muted-foreground">
                {response.model_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {response.response_time_ms && (
                <div className="hidden sm:flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{response.response_time_ms}ms</span>
                </div>
              )}
              {response.token_count && (
                <div className="flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  <span>{response.token_count} tokens</span>
                </div>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={exportAsMarkdown}
                className="h-8 w-8"
                title="Download as Markdown"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={shareResponse}
                className="h-8 w-8"
                title="Share"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content sections */}
        <div className="space-y-6">
          {/* Summary - Always visible */}
          <section className="relative group">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Brain className="w-4 h-4 text-muted-foreground" />
                Summary
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(data.summary || "", "summary")}
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                {copiedSection === "summary" ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed prose-p:text-gray-300 prose-li:text-gray-300 prose-headings:text-gray-200">
              <ReactMarkdown>
                {typeof data.summary === "string" && data.summary
                  ? data.summary
                  : "No summary available"}
              </ReactMarkdown>
            </div>
          </section>

          {/* Preview when collapsed */}
          {!isExpanded && (
            <div className="space-y-2 text-xs text-muted-foreground border-t pt-4">
              <p className="line-clamp-2">
                <span className="font-medium">Historical:</span>{" "}
                {typeof data.historical_context === "string" &&
                data.historical_context
                  ? data.historical_context
                  : "No historical context available"}
              </p>
              <p className="line-clamp-2">
                <span className="font-medium">Future:</span>{" "}
                {typeof data.future_development === "string" &&
                data.future_development
                  ? data.future_development
                  : "No future development available"}
              </p>
              <p className="line-clamp-2">
                <span className="font-medium">Opinion:</span>{" "}
                {typeof data.opinions === "string" && data.opinions
                  ? data.opinions
                  : "No opinions available"}
              </p>
            </div>
          )}

          {/* Expanded content */}
          {isExpanded && (
            <>
              <div className="border-t pt-6 space-y-6">
                {sections.slice(1).map((section) => {
                  const Icon = section.icon;
                  const content = data[section.key as keyof typeof data];
                  // Handle various types of content safely
                  let contentString = "";
                  if (typeof content === "string") {
                    contentString = content;
                  } else if (content === null || content === undefined) {
                    contentString = "";
                  } else if (typeof content === "object") {
                    // Don't render objects directly
                    contentString = "";
                  } else {
                    // Convert primitives to string
                    contentString = String(content);
                  }

                  return (
                    <section key={section.key} className="relative group">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          {section.title}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(contentString, section.key)
                          }
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Copy to clipboard"
                        >
                          {copiedSection === section.key ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed prose-p:text-gray-300 prose-li:text-gray-300 prose-headings:text-gray-200">
                        <ReactMarkdown>{contentString}</ReactMarkdown>
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Expand/Collapse button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-6 text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              Show full analysis
            </>
          )}
        </Button>

        {/* Fallback indicator */}
        {isFallback && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-950/20 border border-yellow-900/20">
            <p className="text-xs text-yellow-400">
              This is a fallback response due to service unavailability
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
