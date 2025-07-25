"use client";

import { useState, useRef, DragEvent } from "react";
import { Upload, X, FileImage, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFile, UploadProgress } from "@/lib/api/upload";
import { Progress } from "./progress";
import { Alert } from "./alert";

interface FileUploadProps {
  value?: string;
  onChange?: (s3Key: string | undefined) => void;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  value,
  onChange,
  disabled,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    setError(null);

    // Validate file size before proceeding
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      setError(
        `File size (${sizeInMB}MB) exceeds the 10MB limit. Please choose a smaller file.`,
      );
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError(
        "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.",
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const s3Key = await uploadFile(file, (progress: UploadProgress) => {
        setUploadProgress(progress.percentage);
      });

      onChange?.(s3Key);
      setIsUploading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setIsUploading(false);
      setPreview(null);
    }
  };

  const handleRemove = () => {
    onChange?.(undefined);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {error && (
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <div>{error}</div>
        </Alert>
      )}

      {!value && !preview ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 transition-colors",
            "hover:border-accent-400 hover:bg-surface-50",
            isDragging && "border-accent-400 bg-surface-50",
            disabled && "opacity-50 cursor-not-allowed",
            !disabled && "cursor-pointer",
          )}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-surface-100 rounded-full">
              <Upload className="h-8 w-8 text-text-secondary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">
                Drop your image here, or click to browse
              </p>
              <p className="text-xs text-text-secondary mt-1">
                JPEG, PNG, GIF, or WebP • Max 10MB
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            disabled={disabled}
            className="hidden"
          />
        </div>
      ) : (
        <div className="relative">
          {preview && (
            <div className="relative rounded-lg overflow-hidden bg-surface-50">
              <img
                src={preview}
                alt="Upload preview"
                className="w-full h-64 object-cover"
              />
              {!isUploading && (
                <button
                  onClick={handleRemove}
                  className="absolute top-2 right-2 p-2 bg-background/80 backdrop-blur-sm rounded-full hover:bg-background transition-colors"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-lg">
              <div className="bg-background p-6 rounded-lg shadow-lg space-y-4 max-w-xs w-full">
                <div className="flex items-center space-x-3">
                  <FileImage className="h-5 w-5 text-text-secondary" />
                  <span className="text-sm font-medium">Uploading...</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-xs text-text-secondary text-center">
                  {uploadProgress}% complete
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
