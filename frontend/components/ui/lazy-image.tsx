/**
 * LazyImage Component
 *
 * Optimized image loading with blur-up effect and LQIP support.
 */

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  placeholderSrc?: string;
  lqip?: string; // Low Quality Image Placeholder for blur-up effect
  threshold?: number;
  rootMargin?: string;
  onVisible?: () => void;
  aspectRatio?: number;
}

export function LazyImage({
  src,
  placeholderSrc,
  lqip,
  className,
  alt = "",
  threshold = 0.01,
  rootMargin = "50px",
  onVisible,
  aspectRatio,
  ...props
}: LazyImageProps) {
  const [imageSrc, setImageSrc] = useState(placeholderSrc || "");
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;

    if (imageRef && imageSrc !== src) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setImageSrc(src);
              onVisible?.();
              observer?.unobserve(entry.target);
            }
          });
        },
        {
          threshold,
          rootMargin,
        },
      );

      observer.observe(imageRef);
    }

    return () => {
      if (observer && imageRef) {
        observer.unobserve(imageRef);
      }
    };
  }, [imageRef, imageSrc, src, threshold, rootMargin, onVisible]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div
      className={cn("relative overflow-hidden bg-muted", className)}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* LQIP blur background */}
      {lqip && !isLoaded && (
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${lqip})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(20px)",
            transform: "scale(1.1)",
          }}
        />
      )}

      {/* Main image */}
      <img
        ref={setImageRef}
        src={imageSrc}
        alt={alt}
        onLoad={handleLoad}
        className={cn(
          "relative z-10 w-full h-full object-cover transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
        )}
        loading="lazy"
        decoding="async"
        {...props}
      />

      {/* Loading shimmer effect */}
      {!isLoaded && (
        <div className="absolute inset-0 z-20">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      )}
    </div>
  );
}
