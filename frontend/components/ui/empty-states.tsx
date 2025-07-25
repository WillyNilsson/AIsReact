"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  FileX,
  Search,
  Inbox,
  Bell,
  MessageSquare,
  Shield,
  ShieldCheck,
  Newspaper,
  TrendingUp,
  Users,
  Filter,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  className?: string;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

// Base empty state component
export function EmptyState({
  className,
  title = "No content yet",
  description = "Get started by creating something new.",
  icon = <Inbox className="w-12 h-12" />,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <Card className={cn("p-12 text-center", className)}>
      <div className="flex flex-col items-center space-y-4 max-w-sm mx-auto">
        <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {action &&
              (action.href ? (
                <Link href={action.href}>
                  <Button>{action.label}</Button>
                </Link>
              ) : (
                <Button onClick={action.onClick}>{action.label}</Button>
              ))}
            {secondaryAction &&
              (secondaryAction.href ? (
                <Link href={secondaryAction.href}>
                  <Button variant="outline">{secondaryAction.label}</Button>
                </Link>
              ) : (
                <Button variant="outline" onClick={secondaryAction.onClick}>
                  {secondaryAction.label}
                </Button>
              ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// Empty feed state
export function EmptyFeed() {
  return (
    <EmptyState
      icon={<Newspaper className="w-12 h-12" />}
      title="No posts to display"
      description="No posts yet. Be the first!"
      action={{
        label: "Submit a post",
        href: "/submit",
      }}
      secondaryAction={{
        label: "View rejected posts",
        href: "/rejected",
      }}
    />
  );
}

// No search results
export function EmptySearchResults({ query }: { query?: string }) {
  return (
    <EmptyState
      icon={<Search className="w-12 h-12" />}
      title="No results found"
      description={query ? `No results for "${query}".` : "No results found."}
      action={{
        label: "Clear search",
        onClick: () => (window.location.href = "/"),
      }}
    />
  );
}

// Empty user posts
export function EmptyUserPosts({
  isOwnProfile = false,
}: {
  isOwnProfile?: boolean;
}) {
  return (
    <EmptyState
      icon={<FileX className="w-12 h-12" />}
      title={
        isOwnProfile ? "You haven't submitted any posts yet" : "No posts yet"
      }
      description={
        isOwnProfile ? "Submit your first post." : "No posts from this user."
      }
      action={
        isOwnProfile
          ? {
              label: "Submit your first post",
              href: "/submit",
            }
          : undefined
      }
    />
  );
}

// Empty notifications
export function EmptyNotifications() {
  return (
    <EmptyState
      icon={<Bell className="w-12 h-12" />}
      title="No notifications"
      description="All caught up!"
      action={{
        label: "Browse posts",
        href: "/",
      }}
    />
  );
}

// Empty verification queue
export function EmptyVerificationQueue() {
  return (
    <EmptyState
      icon={<ShieldCheck className="w-12 h-12" />}
      title="No posts to verify"
      description="All posts verified."
      action={{
        label: "View live posts",
        href: "/",
      }}
      secondaryAction={{
        label: "Submit a post",
        href: "/submit",
      }}
    />
  );
}

// Empty moderation queue
export function EmptyModerationQueue() {
  return (
    <EmptyState
      icon={<Shield className="w-12 h-12" />}
      title="Moderation queue is empty"
      description="No posts need moderation."
      action={{
        label: "View moderation history",
        href: "/moderate/history",
      }}
    />
  );
}

// Empty AI responses
export function EmptyAIResponses() {
  return (
    <EmptyState
      icon={<MessageSquare className="w-12 h-12" />}
      title="No AI responses yet"
      description="Analysis in progress. Check back soon."
    />
  );
}

// Empty comments
export function EmptyComments() {
  return (
    <div className="py-8 text-center text-gray-500 dark:text-gray-400">
      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">No comments yet.</p>
    </div>
  );
}

// Empty dashboard stats
export function EmptyDashboardStats() {
  return (
    <EmptyState
      icon={<TrendingUp className="w-12 h-12" />}
      title="No activity yet"
      description="Start posting to see your stats."
      action={{
        label: "Submit your first post",
        href: "/submit",
      }}
      secondaryAction={{
        label: "Start verifying",
        href: "/verify",
      }}
    />
  );
}

// Empty followers/following
export function EmptyFollowers({
  type = "followers",
}: {
  type?: "followers" | "following";
}) {
  return (
    <EmptyState
      icon={<Users className="w-12 h-12" />}
      title={type === "followers" ? "No followers yet" : "Not following anyone"}
      description={
        type === "followers"
          ? "Share great content to build your following."
          : "Follow other users to see their posts in your feed."
      }
      action={{
        label: "Discover users",
        href: "/users",
      }}
    />
  );
}

// Empty bookmarks
export function EmptyBookmarks() {
  return (
    <EmptyState
      icon={<BookOpen className="w-12 h-12" />}
      title="No bookmarks yet"
      description="Save posts you want to read later or reference again."
      action={{
        label: "Browse posts",
        href: "/",
      }}
    />
  );
}

// Empty filter results
export function EmptyFilterResults() {
  return (
    <EmptyState
      icon={<Filter className="w-12 h-12" />}
      title="No posts match your filters"
      description="Try adjusting your filters to see more results."
      action={{
        label: "Clear filters",
        onClick: () => (window.location.href = "/"),
      }}
    />
  );
}

// Loading failed state
export function LoadingFailed({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<FileX className="w-12 h-12" />}
      title="Failed to load content"
      description="Loading error. Please try again."
      action={{
        label: "Retry",
        onClick: onRetry,
      }}
      secondaryAction={{
        label: "Go back",
        onClick: () => window.history.back(),
      }}
    />
  );
}
