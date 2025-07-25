/**
 * Performance Monitoring Hook
 *
 * Tracks Web Vitals and custom performance metrics.
 */

import { useEffect, useCallback, useRef } from "react";
import { onCLS, onFCP, onINP, onLCP, onTTFB, Metric } from "web-vitals";
import { logWarn } from "../logger";

// Extended performance interface for Chrome's memory API
interface ExtendedPerformance extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface PerformanceMetrics {
  cls?: number;
  fcp?: number;
  inp?: number;
  lcp?: number;
  ttfb?: number;
  customMetrics: Record<string, number>;
}

interface UsePerformanceOptions {
  onReport?: (metrics: PerformanceMetrics) => void;
  reportInterval?: number;
  enableWebVitals?: boolean;
}

export function usePerformance({
  onReport,
  reportInterval = 10000,
  enableWebVitals = true,
}: UsePerformanceOptions = {}) {
  const metricsRef = useRef<PerformanceMetrics>({
    customMetrics: {},
  });
  const lastReportRef = useRef<number>(Date.now());

  // Track Web Vitals
  useEffect(() => {
    if (!enableWebVitals) {
      return undefined;
    }

    const handleMetric = (metric: Metric) => {
      switch (metric.name) {
        case "CLS":
          metricsRef.current.cls = metric.value;
          break;
        case "FCP":
          metricsRef.current.fcp = metric.value;
          break;
        case "INP":
          metricsRef.current.inp = metric.value;
          break;
        case "LCP":
          metricsRef.current.lcp = metric.value;
          break;
        case "TTFB":
          metricsRef.current.ttfb = metric.value;
          break;
      }
    };

    onCLS(handleMetric);
    onFCP(handleMetric);
    onINP(handleMetric);
    onLCP(handleMetric);
    onTTFB(handleMetric);
    return undefined;
  }, [enableWebVitals]);

  // Custom metric tracking
  const trackMetric = useCallback((name: string, value: number) => {
    metricsRef.current.customMetrics[name] = value;
  }, []);

  // Measure function execution time
  const measureTime = useCallback(
    <T extends (...args: unknown[]) => unknown>(name: string, fn: T): T => {
      return ((...args: Parameters<T>) => {
        const start = performance.now();
        const result = fn(...args);

        if (result instanceof Promise) {
          return result.finally(() => {
            const duration = performance.now() - start;
            trackMetric(name, duration);
          });
        }

        const duration = performance.now() - start;
        trackMetric(name, duration);
        return result;
      }) as T;
    },
    [trackMetric],
  );

  // Report metrics periodically
  useEffect(() => {
    if (!onReport) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastReportRef.current >= reportInterval) {
        onReport({ ...metricsRef.current });
        lastReportRef.current = now;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [onReport, reportInterval]);

  // Resource timing API
  const getResourceTimings = useCallback(() => {
    if (!performance.getEntriesByType) {
      return [];
    }

    return performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
      duration: entry.duration,
      size: entry.transferSize || 0,
      type: entry.initiatorType,
    }));
  }, []);

  // Navigation timing
  const getNavigationTiming = useCallback(() => {
    if (!performance.getEntriesByType) {
      return null;
    }

    const [navigation] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    if (!navigation) {
      return null;
    }

    return {
      domContentLoaded:
        navigation.domContentLoadedEventEnd -
        navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      domInteractive: navigation.domInteractive - navigation.fetchStart,
      ttfb: navigation.responseStart - navigation.requestStart,
    };
  }, []);

  // Memory usage (Chrome only)
  const getMemoryUsage = useCallback(() => {
    if ("memory" in performance) {
      const memory = (performance as ExtendedPerformance).memory;
      if (memory) {
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        };
      }
    }
    return null;
  }, []);

  return {
    trackMetric,
    measureTime,
    getResourceTimings,
    getNavigationTiming,
    getMemoryUsage,
    metrics: metricsRef.current,
  };
}

/**
 * Performance Observer Hook
 * Observes specific performance entry types
 */
export function usePerformanceObserver(
  entryTypes: string[],
  callback: (entries: PerformanceEntry[]) => void,
) {
  useEffect(() => {
    if (!("PerformanceObserver" in window)) {
      return undefined;
    }

    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });

    try {
      observer.observe({ entryTypes });
    } catch (e) {
      // Some entry types might not be supported
      logWarn("Performance observer error:", { error: String(e) });
    }

    return () => observer.disconnect();
  }, [entryTypes, callback]);
}
