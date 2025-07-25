"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FeedCardWithImage } from "@/components/feed/feed-card-with-image";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Post } from "@/lib/types";
import { NavigationErrorBoundary } from "@/components/error-boundary/navigation-error-boundary";
// Using emoji icons instead of importing icon components

interface UserProfile {
  id: number;
  username: string;
  role: string;
  created_at: string;
  is_verified: boolean;
  bio: string;
  avatar_url: string | null;
  website_url: string | null;
  twitter_username: string | null;
  github_username: string | null;
  post_count: number;
  live_post_count: number;
  verification_count: number;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
  }>;
}

interface UserStats {
  total_posts: number;
  live_posts: number;
  pending_posts: number;
  rejected_posts: number;
  total_verifications: number;
  accurate_verifications: number;
  verification_accuracy: number;
  joined_days_ago: number;
  last_active: string;
}

function ProfileContent() {
  const params = useParams();
  const username = params.username as string;
  const { user: currentUser } = useAuth();

  // Fetch user profile
  const {
    data: profile,
    error: profileError,
    isLoading: isProfileLoading,
    isError,
  } = useQuery<UserProfile>({
    queryKey: ["user-profile", username],
    queryFn: () => api.get(`/api/users/${username}/`),
    retry: 1, // Retry once on failure
  });

  // Fetch user stats
  const { data: stats } = useQuery<UserStats>({
    queryKey: ["user-stats", username],
    queryFn: () => api.get(`/api/users/${username}/stats/`),
  });

  // Fetch user posts
  const { data: postsData } = useQuery<{ results: Post[] }>({
    queryKey: ["user-posts", username],
    queryFn: () => api.get(`/api/users/${username}/posts/`),
  });

  const isOwnProfile =
    currentUser?.username && username && currentUser.username === username;

  if (isError && profileError) {
    // Check if it's actually a 404 error
    const is404 =
      profileError instanceof Error &&
      (profileError.message.includes("404") ||
        profileError.message.toLowerCase().includes("not found"));

    return (
      <div className="max-w-5xl mx-auto">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">
            {is404 ? "User Not Found" : "Error Loading Profile"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {is404
              ? `The user "${username}" could not be found.`
              : "There was an error loading this profile. Please try again."}
          </p>
          {!is404 && (
            <p className="text-sm text-gray-500 mb-4">
              Error: {profileError.message}
            </p>
          )}
          <Link href="/">
            <Button className="mt-4">Return Home</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isProfileLoading || !profile) {
    return (
      <div className="max-w-5xl mx-auto">
        <ProfileSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-[#1a1b26]/90 to-[#2a2d3a]/90 rounded-2xl p-8 mb-8 backdrop-blur-sm border border-[#2a2d3a]">
        <div className="flex flex-col md:flex-row items-start gap-8">
          {/* Avatar */}
          <div className="relative">
            <Avatar className="h-32 w-32 ring-4 ring-[#7aa2f7]/20 shadow-xl">
              <AvatarImage
                src={profile.avatar_url || ""}
                alt={profile.username}
              />
              <AvatarFallback className="text-3xl bg-gradient-to-br from-[#7aa2f7] to-[#bb9af7] text-white">
                {profile.username?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            {profile.is_verified && (
              <div
                className="absolute -bottom-2 -right-2 bg-[#9ece6a] text-white rounded-full p-2 shadow-lg"
                title="Verified"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h1 className="text-4xl font-bold text-[#c0caf5]">
                {profile.username}
              </h1>
              {profile.role !== "user" && (
                <Badge
                  className={`px-3 py-1 ${
                    profile.role === "admin"
                      ? "bg-[#f7768e]/20 text-[#f7768e] border-[#f7768e]/30"
                      : "bg-[#e0af68]/20 text-[#e0af68] border-[#e0af68]/30"
                  }`}
                >
                  {profile.role === "admin" ? "Admin" : "Moderator"}
                </Badge>
              )}
              {isOwnProfile && (
                <Link href="/profile/edit">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#7aa2f7]/30 hover:bg-[#7aa2f7]/10 hover:text-[#7aa2f7]"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Profile
                  </Button>
                </Link>
              )}
            </div>

            {profile.bio && (
              <p className="text-[#9aa5ce] mb-6 text-lg leading-relaxed max-w-3xl">
                {profile.bio}
              </p>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#1e1f2e]/50 rounded-xl p-4 text-center backdrop-blur-sm border border-[#2a2d3a] hover:border-[#7aa2f7]/30 transition-colors">
                <div className="text-3xl font-bold text-[#7aa2f7] mb-1">
                  {profile.post_count}
                </div>
                <div className="text-sm text-[#787c99]">Posts</div>
              </div>
              <div className="bg-[#1e1f2e]/50 rounded-xl p-4 text-center backdrop-blur-sm border border-[#2a2d3a] hover:border-[#9ece6a]/30 transition-colors">
                <div className="text-3xl font-bold text-[#9ece6a] mb-1">
                  {profile.live_post_count}
                </div>
                <div className="text-sm text-[#787c99]">Verified</div>
              </div>
              <div className="bg-[#1e1f2e]/50 rounded-xl p-4 text-center backdrop-blur-sm border border-[#2a2d3a] hover:border-[#bb9af7]/30 transition-colors">
                <div className="text-3xl font-bold text-[#bb9af7] mb-1">
                  {profile.verification_count}
                </div>
                <div className="text-sm text-[#787c99]">Verifications</div>
              </div>
              {stats && (
                <div className="bg-[#1e1f2e]/50 rounded-xl p-4 text-center backdrop-blur-sm border border-[#2a2d3a] hover:border-[#e0af68]/30 transition-colors">
                  <div className="text-3xl font-bold text-[#e0af68] mb-1">
                    {stats.verification_accuracy.toFixed(0)}%
                  </div>
                  <div className="text-sm text-[#787c99]">Accuracy</div>
                </div>
              )}
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-3">
              {profile.website_url && (
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#1e1f2e]/50 rounded-lg border border-[#2a2d3a] hover:border-[#7aa2f7]/30 transition-all hover:bg-[#7aa2f7]/10 text-[#7aa2f7]"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  Website
                </a>
              )}
              {profile.twitter_username && (
                <a
                  href={`https://x.com/${profile.twitter_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#1e1f2e]/50 rounded-lg border border-[#2a2d3a] hover:border-[#7dcfff]/30 transition-all hover:bg-[#7dcfff]/10 text-[#7dcfff]"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  @{profile.twitter_username}
                </a>
              )}
              {profile.github_username && (
                <a
                  href={`https://github.com/${profile.github_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#1e1f2e]/50 rounded-lg border border-[#2a2d3a] hover:border-[#c0caf5]/30 transition-all hover:bg-[#c0caf5]/10 text-[#c0caf5]"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  {profile.github_username}
                </a>
              )}
            </div>
          </div>

          {/* Additional Info */}
          <div className="text-right">
            <div className="text-sm text-[#787c99] space-y-2">
              <div className="flex items-center gap-1 justify-end">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Joined{" "}
                {profile.created_at
                  ? new Date(profile.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Unknown"}
              </div>
              {stats && stats.last_active && (
                <div className="flex items-center gap-1 justify-end">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Active{" "}
                  {new Date(stats.last_active).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      {profile.achievements && profile.achievements.length > 0 && (
        <div className="bg-[#1a1b26] rounded-2xl p-6 mb-8 border border-[#2a2d3a]">
          <h2 className="text-2xl font-bold mb-6 text-[#c0caf5] flex items-center gap-2">
            <svg
              className="w-6 h-6 text-[#e0af68]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
            Achievements
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {profile.achievements.map((achievement) => (
              <div
                key={achievement.id}
                className="relative group bg-gradient-to-br from-[#1e1f2e] to-[#2a2d3a] rounded-xl p-6 text-center hover:from-[#7aa2f7]/10 hover:to-[#bb9af7]/10 transition-all duration-300 border border-[#2a2d3a] hover:border-[#7aa2f7]/30"
              >
                <div className="text-4xl mb-3 transform group-hover:scale-110 transition-transform">
                  {getAchievementIcon(achievement.icon)}
                </div>
                <div className="font-semibold text-[#c0caf5] mb-1">
                  {achievement.name}
                </div>
                <div className="text-xs text-[#787c99]">
                  {achievement.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs for Posts/Activity */}
      <div className="bg-[#1a1b26] rounded-2xl p-6 border border-[#2a2d3a]">
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="bg-[#1e1f2e] border-[#2a2d3a] mb-6">
            <TabsTrigger
              value="posts"
              className="data-[state=active]:bg-[#7aa2f7]/20 data-[state=active]:text-[#7aa2f7]"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                />
              </svg>
              Posts ({profile.post_count})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-6">
            {postsData?.results && postsData.results.length > 0 ? (
              <div className="flex flex-col gap-4">
                {postsData.results.map((post) => (
                  <FeedCardWithImage key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-[#1e1f2e]/50 rounded-xl border border-[#2a2d3a]">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-[#787c99]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-[#787c99] text-lg">No posts yet</p>
                <p className="text-[#565a6e] text-sm mt-2">
                  Posts will appear here once submitted
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-gradient-to-br from-[#1a1b26]/90 to-[#2a2d3a]/90 rounded-2xl p-8 mb-8 backdrop-blur-sm border border-[#2a2d3a]">
        <div className="flex gap-8">
          <Skeleton className="h-32 w-32 rounded-full bg-[#1e1f2e]" />
          <div className="flex-1">
            <Skeleton className="h-10 w-64 mb-4 bg-[#1e1f2e]" />
            <Skeleton className="h-6 w-full max-w-2xl mb-6 bg-[#1e1f2e]" />
            <div className="grid grid-cols-4 gap-4 mb-6">
              <Skeleton className="h-20 bg-[#1e1f2e] rounded-xl" />
              <Skeleton className="h-20 bg-[#1e1f2e] rounded-xl" />
              <Skeleton className="h-20 bg-[#1e1f2e] rounded-xl" />
              <Skeleton className="h-20 bg-[#1e1f2e] rounded-xl" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-32 bg-[#1e1f2e] rounded-lg" />
              <Skeleton className="h-10 w-32 bg-[#1e1f2e] rounded-lg" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-[#1a1b26] rounded-2xl p-6 border border-[#2a2d3a]">
        <Skeleton className="h-64 w-full bg-[#1e1f2e] rounded-xl" />
      </div>
    </div>
  );
}

function getAchievementIcon(iconName: string) {
  const icons: { [key: string]: string } = {
    "shield-check": "🛡️",
    rocket: "🚀",
    star: "⭐",
    "check-circle": "✅",
    gavel: "🔨",
    crown: "👑",
  };
  return icons[iconName] || "🏆";
}

export default function ProfilePage() {
  return (
    <NavigationErrorBoundary>
      <ProfileContent />
    </NavigationErrorBoundary>
  );
}
