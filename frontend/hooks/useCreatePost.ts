import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PostCreate } from "@/lib/types";
import { PostSchema } from "@/lib/schemas/post";

interface PresignedUploadData {
  upload_url: string;
  file_url: string;
}

// Get presigned upload URL
async function getPresignedUploadUrl({
  filename,
  content_type,
}: {
  filename: string;
  content_type: string;
}) {
  const response = await api.post("/api/upload/presigned-url/", {
    filename,
    content_type,
  });
  return response.data as PresignedUploadData;
}

// Upload file to S3
async function uploadToS3(
  presignedData: PresignedUploadData,
  file: File,
): Promise<void> {
  const response = await fetch(presignedData.upload_url, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to upload file to S3");
  }
}

// Create a new post
async function createPost(postData: PostCreate) {
  const data = await api.post(
    "/api/posts/",
    postData as unknown as Record<string, unknown>,
  );
  const parsed = PostSchema.parse(data);
  return parsed;
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      // Invalidate and refetch posts lists
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  return {
    createPost: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export function usePresignedUpload() {
  const mutation = useMutation({
    mutationFn: getPresignedUploadUrl,
  });

  return {
    getPresignedUrl: mutation.mutateAsync,
    isGettingUrl: mutation.isPending,
    error: mutation.error,
  };
}

export function useS3Upload() {
  const uploadFile = async (presignedData: PresignedUploadData, file: File) => {
    return uploadToS3(presignedData, file);
  };

  return { uploadFile };
}
