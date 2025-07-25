"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIResponseComparison } from "@/components/ai/ai-response-comparison";
import { usePost } from "@/hooks/usePost";
import { AIResponse } from "@/lib/types";
import { ArrowLeft, Grid3x3, FileText } from "lucide-react";

export default function CompareAIResponsesPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params?.id ? Number(params.id) : null;
  type TabValue = "summary" | "historical" | "future" | "opinions";
  const [activeTab, setActiveTab] = useState<TabValue>("summary");

  const { data: post, isLoading, error } = usePost(postId);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="h-96 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="error">
          <p>Failed to load post for comparison.</p>
        </Alert>
        <Button onClick={() => router.push("/dashboard")} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const successfulResponses =
    post.ai_responses?.filter((r: AIResponse) => r.is_successful) || [];

  if (successfulResponses.length < 2) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <p>
            Not enough AI responses available for comparison. At least 2
            successful responses are required.
          </p>
        </Alert>
        <Link href={`/posts/${postId}`}>
          <Button className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Post
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/posts/${postId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Post
          </Button>
        </Link>

        <h1 className="text-2xl font-bold">AI Response Comparison</h1>
      </div>

      {/* Post Summary */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          {!post.image_url ? (
            <FileText className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Grid3x3 className="w-5 h-5 text-muted-foreground" />
          )}
          <h2 className="text-lg font-semibold">Post Summary</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-2">
          {post.content.substring(0, 200) + "..."}
        </p>

        <a
          href={post.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          {post.source_url}
        </a>

        <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
          <span>{successfulResponses.length} AI models analyzed</span>
          <span>•</span>
          <span>Posted {new Date(post.created_at).toLocaleDateString()}</span>
        </div>
      </Card>

      {/* Comparison Tabs */}
      <Card className="p-6">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabValue)}
        >
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-6">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="historical">Historical</TabsTrigger>
            <TabsTrigger value="future">Future</TabsTrigger>
            <TabsTrigger value="opinions">Opinions</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <AIResponseComparison
              responses={post.ai_responses || []}
              aspect="summary"
            />
          </TabsContent>

          <TabsContent value="historical">
            <AIResponseComparison
              responses={post.ai_responses || []}
              aspect="historical"
            />
          </TabsContent>

          <TabsContent value="future">
            <AIResponseComparison
              responses={post.ai_responses || []}
              aspect="future"
            />
          </TabsContent>

          <TabsContent value="opinions">
            <AIResponseComparison
              responses={post.ai_responses || []}
              aspect="opinions"
            />
          </TabsContent>
        </Tabs>
      </Card>

      {/* Model Performance Stats */}
      <Card className="p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Model Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {successfulResponses.map((response: AIResponse) => (
            <div key={response.id} className="text-center">
              <p className="font-medium text-sm">{response.model_name}</p>
              <p className="text-2xl font-bold mt-1">
                {response.response_time_ms
                  ? `${response.response_time_ms}ms`
                  : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">Response Time</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
