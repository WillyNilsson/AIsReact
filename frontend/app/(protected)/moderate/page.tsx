"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Shield, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * MODERATION PAGE - TEMPORARILY DISABLED
 *
 * This page has been disabled because:
 * 1. OpenAI moderation API already handles content screening automatically
 * 2. Current implementation just duplicates the automatic moderation flow
 * 3. Without significant user volume, manual moderation isn't needed
 *
 * See FUTURE_IMPLEMENTATION.md for detailed plans on what this page
 * should become when re-enabled (appeals system, edge case handling, etc.)
 *
 * For now, admins can use Django admin panel for any manual moderation needs.
 */

export default function ModerationDashboard() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Card className="p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-yellow-500/10 rounded-full">
              <Shield className="h-12 w-12 text-yellow-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-4">
            Moderation System Under Development
          </h1>

          <div className="space-y-4 mb-8">
            <p className="text-center text-muted-foreground">
              The moderation interface is temporarily disabled while we develop
              a more sophisticated system.
            </p>

            <Alert className="bg-blue-500/10 border-blue-500/20">
              <div className="text-sm">
                <strong>Current Moderation Flow:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>
                    Posts are automatically screened by OpenAI's moderation API
                  </li>
                  <li>Approved posts go to community verification</li>
                  <li>Rejected posts are shown in the "Rejected" section</li>
                </ol>
              </div>
            </Alert>

            <Alert className="bg-yellow-500/10 border-yellow-500/20">
              <div className="text-sm">
                <strong>For Administrators:</strong>
                <p className="mt-1">
                  Use the Django admin panel to manually review posts, handle
                  edge cases, or override automatic decisions.
                </p>
              </div>
            </Alert>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-3">
                Future Moderation Features
              </h2>
              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-green-500/10 rounded">
                    <FileText className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <strong>Appeals System:</strong> Allow users to appeal
                    rejected posts with additional context
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-blue-500/10 rounded">
                    <FileText className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <strong>Edge Case Queue:</strong> Review posts with low AI
                    confidence or split community votes
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-purple-500/10 rounded">
                    <FileText className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <strong>Pattern Detection:</strong> Identify trends in
                    rejected content and potential AI bias
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-center text-muted-foreground mb-4">
                See{" "}
                <code className="px-1 py-0.5 bg-muted rounded">
                  FUTURE_IMPLEMENTATION.md
                </code>{" "}
                for detailed technical plans
              </p>

              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
                <Link href="/admin" target="_blank" rel="noopener noreferrer">
                  <Button variant="primary">Open Django Admin</Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
