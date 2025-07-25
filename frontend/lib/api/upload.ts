/**
 * S3 Upload API utilities
 */

import { api } from "../api";
import { logError } from "../logger";

export interface PresignedUploadData {
  upload_url: string;
  file_url: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Get presigned upload URL from backend
 */
export async function getPresignedUploadUrl(
  fileExtension: string,
  contentType: string,
): Promise<PresignedUploadData> {
  return await api.post("/upload/presigned-url/", {
    filename: `image.${fileExtension}`,
    content_type: contentType,
  });
}

/**
 * Upload file directly to S3 using presigned URL
 */
export async function uploadToS3(
  file: File,
  presignedData: PresignedUploadData,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  // Upload directly to S3 using PUT
  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200 || xhr.status === 204) {
        resolve(presignedData.file_url);
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed"));
    });

    xhr.open("PUT", presignedData.upload_url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

/**
 * Complete file upload flow
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  // Validate file
  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!validTypes.includes(file.type)) {
    throw new Error(
      "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.",
    );
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(
      `File size (${sizeInMB}MB) exceeds the 10MB limit. Please choose a smaller file.`,
    );
  }

  // Get file extension
  const extension = file.name.split(".").pop()?.toLowerCase() || "";

  try {
    // Get presigned URL
    const presignedData = await getPresignedUploadUrl(extension, file.type);

    // Upload to S3
    const fileUrl = await uploadToS3(file, presignedData, onProgress);

    return fileUrl;
  } catch (error) {
    logError("Upload error:", error, {
      filename: file.name,
      fileSize: file.size,
    });
    throw error;
  }
}
