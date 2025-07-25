import { useMemo } from "react";

interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: "webp" | "avif" | "jpeg" | "png";
}

interface ResponsiveImageSizes {
  mobile: string;
  tablet: string;
  desktop: string;
}

export function useImageOptimization() {
  const generateSrcSet = (
    baseUrl: string,
    widths: number[] = [640, 750, 828, 1080, 1200, 1920],
  ): string => {
    return widths.map((width) => `${baseUrl}?w=${width} ${width}w`).join(", ");
  };

  const generateSizes = (
    breakpoints: ResponsiveImageSizes = {
      mobile: "100vw",
      tablet: "50vw",
      desktop: "33vw",
    },
  ): string => {
    return `(max-width: 640px) ${breakpoints.mobile}, (max-width: 1024px) ${breakpoints.tablet}, ${breakpoints.desktop}`;
  };

  const getOptimizedUrl = (
    url: string,
    options: ImageOptimizationOptions = {},
  ): string => {
    const { width, height, quality = 75, format = "webp" } = options;

    // For S3 URLs, we could integrate with a CDN or image optimization service
    // For now, return the original URL
    // In production, this would integrate with Cloudinary, Imgix, or similar

    const params = new URLSearchParams();
    if (width) {
      params.append("w", width.toString());
    }
    if (height) {
      params.append("h", height.toString());
    }
    if (quality) {
      params.append("q", quality.toString());
    }
    if (format) {
      params.append("fm", format);
    }

    const separator = url.includes("?") ? "&" : "?";
    return params.toString() ? `${url}${separator}${params.toString()}` : url;
  };

  const preloadImage = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
  };

  const lazyLoadImage = (
    element: HTMLImageElement,
    options: IntersectionObserverInit = {},
  ): (() => void) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;

            if (src) {
              img.src = src;
              img.removeAttribute("data-src");
              observer.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: "50px 0px",
        threshold: 0.01,
        ...options,
      },
    );

    observer.observe(element);

    // Return cleanup function
    return () => observer.disconnect();
  };

  return {
    generateSrcSet,
    generateSizes,
    getOptimizedUrl,
    preloadImage,
    lazyLoadImage,
  };
}

// Utility function to get image dimensions from URL
export async function getImageDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();

    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = reject;
    img.src = url;
  });
}

// Generate low quality placeholder
export function generatePlaceholder(
  width: number = 10,
  height: number = 10,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }

  // Create a simple gradient placeholder
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#1a1a1a");
  gradient.addColorStop(1, "#2a2a2a");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.1);
}
