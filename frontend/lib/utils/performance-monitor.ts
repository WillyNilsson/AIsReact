/**
 * Performance monitoring utilities for production
 * Helps detect memory leaks and performance issues specific to production
 */

interface PerformanceMetrics {
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  longTasks: number;
  fps?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = { longTasks: 0 };
  private observers: PerformanceObserver[] = [];
  private fpsInterval?: NodeJS.Timeout;
  private lastFrameTime = 0;
  private frameCount = 0;

  constructor() {
    if (typeof window === "undefined") {
      return;
    }

    // Monitor long tasks (blocking main thread)
    if ("PerformanceObserver" in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              // Task longer than 50ms
              this.metrics.longTasks++;
              console.warn(`Long task detected: ${entry.duration}ms`);
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ["longtask"] });
        this.observers.push(longTaskObserver);
      } catch {
        // Long task observer not supported
      }
    }

    // Monitor memory usage
    if ("memory" in performance) {
      setInterval(() => {
        const memory = (
          performance as Performance & {
            memory?: {
              usedJSHeapSize: number;
              totalJSHeapSize: number;
              jsHeapSizeLimit: number;
            };
          }
        ).memory;
        if (memory) {
          this.metrics.memoryUsage = {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
          };

          // Warn if memory usage is high
          const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
          if (usage > 0.9) {
            console.error("High memory usage detected:", {
              used: `${(memory.usedJSHeapSize / 1048576).toFixed(2)}MB`,
              limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)}MB`,
              percentage: `${(usage * 100).toFixed(2)}%`,
            });
          }
        }
      }, 30000); // Check every 30 seconds
    }

    // Monitor FPS in production
    if (process.env.NODE_ENV === "production") {
      this.startFPSMonitoring();
    }
  }

  private startFPSMonitoring() {
    let lastTime = performance.now();
    let frames = 0;

    const measureFPS = () => {
      frames++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        // Update FPS every second
        this.metrics.fps = Math.round(
          (frames * 1000) / (currentTime - lastTime),
        );

        // Warn if FPS drops below 30
        if (this.metrics.fps < 30) {
          console.warn(`Low FPS detected: ${this.metrics.fps}`);
        }

        frames = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  cleanup() {
    this.observers.forEach((observer) => observer.disconnect());
    if (this.fpsInterval) {
      clearInterval(this.fpsInterval);
    }
  }

  // Report critical metrics to monitoring service
  reportCriticalMetrics() {
    const metrics = this.getMetrics();

    // In production, you might send these to your monitoring service
    if (process.env.NODE_ENV === "production") {
      // Example: Send to monitoring endpoint
      fetch("/api/monitoring/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          ...metrics,
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      }).catch(() => {
        // Silently fail - don't impact user experience
      });
    }
  }
}

// Singleton instance
let monitor: PerformanceMonitor | null = null;

export function initPerformanceMonitoring() {
  if (typeof window === "undefined" || monitor) {
    return;
  }

  monitor = new PerformanceMonitor();

  // Report metrics periodically in production
  if (process.env.NODE_ENV === "production") {
    setInterval(() => {
      monitor?.reportCriticalMetrics();
    }, 300000); // Every 5 minutes
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    monitor?.cleanup();
  });
}

export function getPerformanceMetrics() {
  return monitor?.getMetrics() || { longTasks: 0 };
}
