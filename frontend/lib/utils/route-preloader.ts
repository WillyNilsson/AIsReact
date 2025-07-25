/**
 * Route preloading utilities for optimizing navigation performance
 */

// Preload a route when user hovers or focuses on a link
export function preloadRoute(href: string) {
  if (typeof window === "undefined") {
    return;
  }

  // Use Next.js router prefetch
  import("next/router").then(({ default: router }) => {
    router.prefetch(href);
  });
}

// Preload critical routes on app initialization
export function preloadCriticalRoutes() {
  const criticalRoutes = ["/", "/auth/login"];

  // Delay preloading to avoid blocking initial render
  setTimeout(() => {
    criticalRoutes.forEach((route) => {
      preloadRoute(route);
    });
  }, 2000);
}

// Intersection observer for link preloading
export function setupLinkPreloading() {
  if (typeof window === "undefined") {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const link = entry.target as HTMLAnchorElement;
          const href = link.getAttribute("href");
          if (href && href.startsWith("/")) {
            preloadRoute(href);
          }
        }
      });
    },
    {
      rootMargin: "50px",
    },
  );

  // Observe all internal links
  document.querySelectorAll('a[href^="/"]').forEach((link) => {
    observer.observe(link);
  });

  return () => observer.disconnect();
}
