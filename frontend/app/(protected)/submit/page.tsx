"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LazyMarkdownEditor as MarkdownEditor } from "@/components/lazy/lazy-markdown-editor";
import { useCreatePost } from "@/hooks/useCreatePost";
import { useDraftPost } from "@/lib/hooks/useDraftPost";
import {
  // Upload, // TEMPORARILY DISABLED
  Link,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Clipboard,
  Save,
  Trash2,
} from "lucide-react";
// import { useAuthStore } from '@/store/authStore';
// TEMPORARILY DISABLED FOR V1: Email verification
// import EmailVerificationGuard from '@/components/auth/email-verification-guard';
import { logError } from "@/lib/logger";
import { ErrorWithResponse } from "@/lib/types/errors";
import { getErrorMessage } from "@/lib/errors/messages";
// import { api } from "@/lib/api"; // TEMPORARILY DISABLED - only needed for image upload

// Form validation schema
const formSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be less than 200 characters"),
  content: z
    .string()
    .min(10, "Content must be at least 10 characters")
    .max(70000, "Content must be less than 70,000 characters"),
  source_url: z.string().url("Please enter a valid URL"),
  // image_file: z.instanceof(File).optional().or(z.undefined()), // TEMPORARILY DISABLED
});

type FormData = z.infer<typeof formSchema>;

export default function SubmitPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // const [selectedFile, setSelectedFile] = useState<File | null>(null); // TEMPORARILY DISABLED
  // const [previewUrl, setPreviewUrl] = useState<string | null>(null); // TEMPORARILY DISABLED
  const [showDraftNotice, setShowDraftNotice] = useState(false);
  // const [isDragging, setIsDragging] = useState(false); // TEMPORARILY DISABLED

  const { createPost } = useCreatePost();
  const {
    draft,
    saveDraft,
    clearDraft,
    lastSaved,
    isLoading: isDraftLoading,
    error: draftError,
  } = useDraftPost();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      source_url: "",
    },
  });

  // Load draft on mount
  useEffect(() => {
    if (draft && !isDraftLoading) {
      reset({
        title: draft.title || "",
        content: draft.content || "",
        source_url: draft.source_url || "",
      });
      setShowDraftNotice(true);
      // Hide draft notice after 3 seconds
      const timer = setTimeout(() => setShowDraftNotice(false), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [draft, isDraftLoading, reset]);

  // Auto-save draft when form values change
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.title || values.content || values.source_url) {
        saveDraft({
          title: values.title || "",
          content: values.content || "",
          source_url: values.source_url || "",
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, saveDraft]);

  // Handle file selection - TEMPORARILY DISABLED
  /* const handleFileSelect = (file: File | null) => {
    // Clear any previous errors
    setSubmitError(null);

    if (file) {
      // Validate file size
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        const errorMsg = getErrorMessage(
          `File size ${sizeInMB}MB exceeds size limit`,
          { action: "upload" },
        );
        setSubmitError(errorMsg);
        return;
      }

      // Validate file type
      const validTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!validTypes.includes(file.type)) {
        const errorMsg = getErrorMessage("invalid file type", {
          action: "upload",
        });
        setSubmitError(errorMsg);
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      // setSelectedFile(null);
      // setPreviewUrl(null);
    }
  }; */

  // Handle drag and drop events - TEMPORARILY DISABLED
  /* const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set dragging to false if leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (
      x <= rect.left ||
      x >= rect.right ||
      y <= rect.top ||
      y >= rect.bottom
    ) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Only handle the first file
      handleFileSelect(files[0]);
    }
  }; */

  // Handle paste for easy content input
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // Try to detect if it's a URL
        const urlPattern = /^https?:\/\//i;
        if (urlPattern.test(text.trim()) && !watch("source_url")) {
          setValue("source_url", text.trim());
        } else {
          // Otherwise add to content
          const currentContent = watch("content");
          setValue(
            "content",
            currentContent ? `${currentContent}\n\n${text}` : text,
          );
        }
      }
    } catch (error) {
      logError("Failed to read clipboard:", error);
    }
  };

  // Submit handler
  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      let imageUrl: string | undefined;

      // Handle image upload if file is selected - TEMPORARILY DISABLED
      /* if (selectedFile) {
        try {
          // Upload through backend for EXIF stripping and processing
          const formData = new FormData();
          formData.append("image", selectedFile);

          const response = await api.postFormData("/api/posts/upload-image/", formData);
          imageUrl = response.image_url;

        } catch (uploadError) {
          const errorMsg = getErrorMessage(uploadError, { action: "upload" });
          throw new Error(errorMsg);
        }
      } */

      // Create post data matching Django's expectations
      const postData = {
        title: data.title,
        content: data.content,
        source_url: data.source_url,
        image_url: imageUrl,
      };

      // Create post
      const post = await createPost(postData);

      // Clear draft and form on successful submission
      clearDraft();
      reset({ title: "", content: "", source_url: "" });
      // setSelectedFile(null);
      // setPreviewUrl(null);

      // Redirect to post
      router.push(`/posts/${post.id}`);
    } catch (error) {
      const err = error as ErrorWithResponse;
      let errorMsg = "submission failed";

      if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      } else if (err.response?.data?.error) {
        errorMsg =
          typeof err.response.data.error === "string"
            ? err.response.data.error
            : err.response.data.error.message;
      } else if (err.response?.data) {
        // Handle validation errors
        const data = err.response.data;
        if (typeof data === "object") {
          const firstError = Object.entries(data)[0];
          if (firstError) {
            errorMsg = `${firstError[0]}: ${firstError[1]}`;
          }
        }
      } else if (err.message) {
        errorMsg = err.message;
      }

      errorMsg = getErrorMessage(errorMsg, { action: "submit" });
      setSubmitError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // TEMPORARILY DISABLED FOR V1: EmailVerificationGuard wrapper
    // <EmailVerificationGuard>
    <>
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-[#7aa2f7] to-[#bb9af7] bg-clip-text text-transparent">
            <span className="sm:hidden">Submit</span>
            <span className="hidden sm:inline">Submit for AI Analysis</span>
          </h1>
          <p className="text-[#9aa5ce] text-base sm:text-lg">
            <span className="sm:hidden">Share articles or current events</span>
            <span className="hidden sm:inline">
              Share articles or current events for multi-AI perspective analysis
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <Card className="p-8 bg-[#24283b]/80 backdrop-blur-xl border-[#414868] shadow-xl">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Title */}
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium mb-2 text-[#c0caf5]"
                  >
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    {...register("title")}
                    id="title"
                    placeholder="Enter the news article headline or event title"
                    className={`bg-[#2f3549] border-[#414868] focus:border-[#7aa2f7] text-[#c0caf5] placeholder-[#787c99] ${
                      errors.title ? "border-[#f7768e]" : ""
                    }`}
                  />
                  {errors.title && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                {/* Content */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label
                      htmlFor="content"
                      className="block text-sm font-medium text-[#c0caf5]"
                    >
                      Content <span className="text-red-500">*</span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handlePaste}
                      className="flex items-center gap-1 text-[#7aa2f7] hover:text-[#89b4fa]"
                    >
                      <Clipboard className="w-4 h-4" />
                      Paste from clipboard
                    </Button>
                  </div>
                  <MarkdownEditor
                    key={draft?.content || "default"}
                    value={watch("content") || ""}
                    onChange={(value) => setValue("content", value)}
                    placeholder="Paste the news article content or describe the event in detail. Include key facts, quotes, and context for AI analysis..."
                    minHeight={200}
                    maxHeight={400}
                    className="bg-[#2f3549]"
                  />
                  {errors.content && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.content.message}
                    </p>
                  )}
                  <p className="text-sm text-[#787c99] mt-1">
                    {watch("content")?.length || 0} / 70,000 characters
                  </p>
                </div>

                {/* Image Upload - TEMPORARILY DISABLED FOR COPYRIGHT REASONS */}
                {/* <div>
                  <label className="block text-sm font-medium mb-2 text-[#c0caf5]">
                    Attach Image (Optional)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleFileSelect(e.target.files?.[0] || null)
                      }
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className={`flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed rounded-lg cursor-pointer transition-all bg-[#2f3549]/50 ${isDragging
                        ? "border-[#7aa2f7] bg-[#7aa2f7]/10 scale-[1.02]"
                        : "border-[#414868] hover:border-[#7aa2f7]"
                        }`}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      {previewUrl ? (
                        <div className="relative w-full max-w-md">
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className={`w-full h-auto rounded-lg ${isDragging ? "opacity-50" : ""
                              }`}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              handleFileSelect(null);
                            }}
                            className="absolute top-2 right-2"
                          >
                            Remove
                          </Button>
                          {isDragging && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#7aa2f7]/20 rounded-lg">
                              <span className="text-[#7aa2f7] font-medium">
                                Drop to replace image
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <Upload
                            className={`w-6 h-6 ${isDragging ? "text-[#7aa2f7]" : "text-[#787c99]"
                              }`}
                          />
                          <span
                            className={
                              isDragging ? "text-[#7aa2f7]" : "text-[#9aa5ce]"
                            }
                          >
                            {isDragging
                              ? "Drop image here..."
                              : "Click to upload or drag and drop"}
                          </span>
                        </>
                      )}
                    </label>
                    <p className="text-xs text-[#787c99]">
                      PNG, JPG, GIF, WebP up to 10MB
                    </p>
                    <p className="text-xs text-[#9ecfff] mt-1">
                      Note: Uploaded images are not analyzed by AI models at
                      this time to ensure fair comparisons across all providers
                    </p>
                  </div>
                </div> */}

                {/* Source URL */}
                <div>
                  <label
                    htmlFor="source_url"
                    className="block text-sm font-medium mb-2 text-[#c0caf5]"
                  >
                    Source URL <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#787c99] pointer-events-none z-10" />
                    <Input
                      {...register("source_url")}
                      id="source_url"
                      type="url"
                      placeholder="https://newssite.com/article-url"
                      className={`pl-10 bg-[#2f3549] border-[#414868] focus:border-[#7aa2f7] text-[#c0caf5] placeholder-[#787c99] ${
                        errors.source_url ? "border-[#f7768e]" : ""
                      }`}
                    />
                  </div>
                  {errors.source_url && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.source_url.message}
                    </p>
                  )}
                  <p className="text-sm text-[#787c99] mt-1">
                    Original source URL
                  </p>
                </div>

                {/* Draft Status */}
                {lastSaved && (
                  <div className="flex items-center justify-between text-sm text-[#787c99] bg-[#2f3549]/50 px-4 py-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      <span>
                        Draft saved {new Date(lastSaved).toLocaleTimeString()}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearDraft();
                        reset({ title: "", content: "", source_url: "" });
                        // setSelectedFile(null);
                        // setPreviewUrl(null);
                      }}
                      className="text-[#f7768e] hover:text-[#ff9ea6] hover:bg-[#f7768e]/10"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear Draft
                    </Button>
                  </div>
                )}

                {/* Draft Notice */}
                {showDraftNotice && (
                  <Alert
                    variant="success"
                    className="bg-[#7aa2f7]/10 border-[#7aa2f7]/30 text-[#7aa2f7]"
                  >
                    Previous draft restored
                  </Alert>
                )}

                {/* Draft Error */}
                {draftError && (
                  <Alert
                    variant="warning"
                    className="bg-[#e0af68]/10 border-[#e0af68]/30 text-[#e0af68]"
                  >
                    {draftError}
                  </Alert>
                )}

                {/* Submit Error */}
                {submitError && (
                  <Alert
                    variant="error"
                    className="bg-[#f7768e]/10 border-[#f7768e]/30 text-[#f7768e]"
                  >
                    {submitError}
                  </Alert>
                )}

                {/* Submit Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-[#7aa2f7] to-[#bb9af7] hover:from-[#5d7bc1] hover:to-[#9d7ed8] text-[#1a1b26]"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/")}
                    disabled={isSubmitting}
                    className="border-[#414868] text-[#9aa5ce] hover:bg-[#2f3549]"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="p-6 bg-gradient-to-br from-[#7aa2f7]/10 to-[#bb9af7]/10 border-[#7aa2f7]/30">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-[#7dcfff]">
                <CheckCircle className="w-5 h-5" />
                What happens next?
              </h3>
              <ol className="space-y-2 text-sm text-[#9aa5ce]">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-[#7aa2f7]">1.</span>
                  <span>Automated check for factual news content</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-[#7aa2f7]">2.</span>
                  <span>Community verifies article authenticity</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-[#7aa2f7]">3.</span>
                  <span>5 AI models analyze the news event</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-[#7aa2f7]">4.</span>
                  <span>Compare different AI perspectives</span>
                </li>
              </ol>
            </Card>

            <Card className="p-6 bg-[#e0af68]/10 border-[#e0af68]/30">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-[#e0af68]">
                <AlertCircle className="w-5 h-5" />
                Content Guidelines
              </h3>
              <ul className="space-y-2 text-sm text-[#9aa5ce]">
                <li className="flex items-start gap-2">
                  <span className="text-[#e0af68]">•</span>
                  <span>Submit only factual news or events</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#e0af68]">•</span>
                  <span>Provide accurate source URLs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#e0af68]">•</span>
                  <span>No harmful or misleading content</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#e0af68]">•</span>
                  <span>Respect copyright and IP rights</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
      {/* TEMPORARILY DISABLED FOR V1: Wrap with EmailVerificationGuard when re-enabling */}
      {/* </EmailVerificationGuard> */}
    </>
  );
}
