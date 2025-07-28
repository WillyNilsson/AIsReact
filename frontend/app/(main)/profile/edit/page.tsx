"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
// import { FileUpload } from "@/components/ui/file-upload";
import { api, authApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface ProfileFormData {
  bio: string;
  website_url: string;
  twitter_username: string;
  github_username: string;
}

export default function EditProfilePage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Fetch current user profile
  const { data: profile, error: profileError } = useQuery({
    queryKey: ["auth-me"],
    queryFn: () => api.get("/api/auth/me/"),
    enabled: !!currentUser,
  });

  const [formData, setFormData] = useState<ProfileFormData>({
    bio: "",
    website_url: "",
    twitter_username: "",
    github_username: "",
  });

  // Update form when profile loads
  React.useEffect(() => {
    if (profile) {
      setFormData({
        bio: profile.bio || "",
        website_url: profile.website_url || "",
        twitter_username: profile.twitter_username || "",
        github_username: profile.github_username || "",
      });
    }
  }, [profile]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await authApi.updateMe(formData);
      setSuccess("Profile updated successfully!");

      // Update cached data
      queryClient.setQueryData(["auth-me"], response);

      // Redirect to profile after a short delay
      setTimeout(() => {
        router.push(`/profile/${currentUser?.username}`);
      }, 1500);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to update profile");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true);
    setError("");

    try {
      // Create FormData to send file
      const formData = new FormData();
      formData.append("avatar", file);

      // Upload directly to backend (which will process and upload to S3)
      const response = await api.postFormData(
        "/api/auth/upload-avatar/",
        formData,
      );

      // Update cached profile data
      if (profile && response.avatar_url) {
        queryClient.setQueryData(["auth-me"], {
          ...profile,
          avatar_url: response.avatar_url,
        });
      }

      setSuccess("Avatar updated successfully!");

      // Force refetch to ensure data is synced
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to upload avatar");
      }
    } finally {
      setAvatarUploading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-5xl mx-auto">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please log in to edit your profile.
          </p>
          <Link href="/auth/login">
            <Button>Log In</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="max-w-5xl mx-auto">
        <Alert variant="error">
          Failed to load profile. Please try again later.
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="max-w-3xl mx-auto">
        <div className="bg-gradient-to-br from-[#1a1b26]/90 to-[#2a2d3a]/90 rounded-2xl p-8 backdrop-blur-sm border border-[#2a2d3a]">
          <h1 className="text-3xl font-bold mb-8 text-[#c0caf5] flex items-center gap-3">
            <svg
              className="w-8 h-8 text-[#7aa2f7]"
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
          </h1>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" className="mb-4">
              {success}
            </Alert>
          )}

          {/* Avatar Upload */}
          <div className="mb-10">
            <div className="flex flex-col items-center">
              <div className="relative mb-4">
                <Avatar className="h-32 w-32 ring-4 ring-[#7aa2f7]/20 shadow-xl">
                  <AvatarImage
                    src={profile?.avatar_url || ""}
                    alt={profile?.username}
                  />
                  <AvatarFallback className="text-3xl bg-gradient-to-br from-[#7aa2f7] to-[#bb9af7] text-white">
                    {profile?.username?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <button
                  className="absolute bottom-0 right-0 bg-[#7aa2f7] text-white rounded-full p-2.5 shadow-lg hover:bg-[#89b4fa] transition-colors"
                  onClick={() =>
                    document.getElementById("avatar-upload")?.click()
                  }
                  disabled={avatarUploading}
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
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>
              </div>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && file.size <= 5 * 1024 * 1024) {
                    handleAvatarUpload(file);
                  } else if (file) {
                    setError("File size must be less than 5MB");
                  }
                }}
                disabled={avatarUploading}
              />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-[#c0caf5] mb-1">
                  {profile?.username}
                </h3>
                <p className="text-sm text-[#787c99]">
                  {avatarUploading
                    ? "Uploading..."
                    : "JPG, PNG, GIF or WebP. Max 5MB"}
                </p>
              </div>
            </div>
          </div>

          {/* Email Display (non-editable) */}
          {profile?.email && (
            <div className="bg-[#1e1f2e]/50 rounded-xl p-6 border border-[#2a2d3a] mb-6">
              <Label className="text-[#c0caf5] font-medium mb-2 block">
                Email Address
              </Label>
              <div className="flex items-center justify-between">
                <p className="text-[#9aa5ce]">{profile.email}</p>
                <span className="text-xs text-[#787c99] bg-[#1a1b26] px-3 py-1 rounded-full border border-[#2a2d3a]">
                  Cannot be changed
                </span>
              </div>
              <p className="text-xs text-[#787c99] mt-2">
                For security reasons, email addresses cannot be changed. Contact
                support if you need assistance.
              </p>
            </div>
          )}

          {/* Profile Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-[#1e1f2e]/50 rounded-xl p-6 border border-[#2a2d3a]">
              <Label
                htmlFor="bio"
                className="text-[#c0caf5] font-medium mb-2 block"
              >
                Bio
              </Label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 bg-[#1a1b26] border border-[#2a2d3a] rounded-lg text-[#c0caf5] placeholder-[#787c99] focus:outline-none focus:border-[#7aa2f7] focus:ring-1 focus:ring-[#7aa2f7] resize-none"
                placeholder="Tell us about yourself..."
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-[#787c99]">
                  Write a brief description about yourself
                </p>
                <p className="text-xs text-[#787c99]">
                  {formData.bio.length}/500
                </p>
              </div>
            </div>

            <div className="bg-[#1e1f2e]/50 rounded-xl p-6 border border-[#2a2d3a] space-y-6">
              <h3 className="text-xl font-semibold text-[#c0caf5] mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-[#7aa2f7]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                Links & Social
              </h3>

              <div>
                <Label
                  htmlFor="website_url"
                  className="text-[#c0caf5] font-medium mb-2 block"
                >
                  Website
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg
                      className="w-5 h-5 text-[#787c99]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                  </div>
                  <Input
                    id="website_url"
                    name="website_url"
                    type="url"
                    value={formData.website_url}
                    onChange={handleInputChange}
                    placeholder="https://example.com"
                    className="pl-10 bg-[#1a1b26] border-[#2a2d3a] text-[#c0caf5] placeholder-[#787c99] focus:border-[#7aa2f7] focus:ring-[#7aa2f7]"
                  />
                </div>
              </div>

              <div>
                <Label
                  htmlFor="twitter_username"
                  className="text-[#c0caf5] font-medium mb-2 block"
                >
                  Twitter/X Username
                </Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-[#2a2d3a] bg-[#1e1f2e] text-[#787c99]">
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    @
                  </span>
                  <Input
                    id="twitter_username"
                    name="twitter_username"
                    value={formData.twitter_username}
                    onChange={handleInputChange}
                    placeholder="username"
                    className="rounded-l-none bg-[#1a1b26] border-[#2a2d3a] text-[#c0caf5] placeholder-[#787c99] focus:border-[#7aa2f7] focus:ring-[#7aa2f7]"
                    pattern="[a-zA-Z0-9_]+"
                  />
                </div>
              </div>

              <div>
                <Label
                  htmlFor="github_username"
                  className="text-[#c0caf5] font-medium mb-2 block"
                >
                  GitHub Username
                </Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-[#2a2d3a] bg-[#1e1f2e] text-[#787c99]">
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                    /
                  </span>
                  <Input
                    id="github_username"
                    name="github_username"
                    value={formData.github_username}
                    onChange={handleInputChange}
                    placeholder="username"
                    className="rounded-l-none bg-[#1a1b26] border-[#2a2d3a] text-[#c0caf5] placeholder-[#787c99] focus:border-[#7aa2f7] focus:ring-[#7aa2f7]"
                    pattern="[a-zA-Z0-9\-]+"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-[#7aa2f7] hover:bg-[#89b4fa] text-white font-medium py-2.5"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  "Save Changes"
                )}
              </Button>
              <Link href={`/profile/${currentUser?.username}`}>
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#2a2d3a] hover:bg-[#1e1f2e] text-[#c0caf5]"
                >
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
