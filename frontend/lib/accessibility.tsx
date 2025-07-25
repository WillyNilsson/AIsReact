/**
 * Accessibility utilities and helpers
 *
 * Ensures WCAG 2.1 AA compliance throughout the application.
 */

import { useEffect } from "react";

/**
 * Announce message to screen readers
 */
export function announce(
  message: string,
  priority: "polite" | "assertive" = "polite",
) {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.style.position = "absolute";
  announcement.style.left = "-10000px";
  announcement.style.width = "1px";
  announcement.style.height = "1px";
  announcement.style.overflow = "hidden";

  announcement.textContent = message;
  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Hook to trap focus within an element
 */
export function useFocusTrap(
  isActive: boolean,
  containerRef: React.RefObject<HTMLElement>,
) {
  useEffect(() => {
    if (!isActive || !containerRef.current) {
      return undefined;
    }

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])',
    );

    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") {
        return;
      }

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    firstFocusable?.focus();

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, containerRef]);
}

/**
 * Skip to main content link component
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-white focus:rounded-lg"
    >
      Skip to main content
    </a>
  );
}

/**
 * Get appropriate heading level based on context
 */
export function getHeadingLevel(level: 1 | 2 | 3 | 4 | 5 | 6) {
  const headingMap = {
    1: "h1",
    2: "h2",
    3: "h3",
    4: "h4",
    5: "h5",
    6: "h6",
  };

  return headingMap[level];
}

/**
 * Color contrast checker
 */
export function checkColorContrast(
  foreground: string,
  background: string,
): number {
  const getLuminance = (color: string): number => {
    const rgb = color.match(/\d+/g);
    if (!rgb) {
      return 0;
    }

    const [r, g, b] = rgb.map((val) => {
      const channel = parseInt(val) / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * ARIA labels for common UI patterns
 */
export const ariaLabels = {
  loading: "Loading content",
  submitting: "Submitting form",
  expanding: "Expand content",
  collapsing: "Collapse content",
  navigating: "Navigating to page",
  sorting: "Sort items",
  filtering: "Filter results",
  paginating: "Load more items",
  dismissing: "Dismiss",
  copying: "Copy to clipboard",
  sharing: "Share content",
};

/**
 * Keyboard navigation keys
 */
export const KEYS = {
  ENTER: "Enter",
  SPACE: " ",
  ESCAPE: "Escape",
  TAB: "Tab",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
};

/**
 * Focus visible utility classes
 */
export const focusClasses =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background-primary";

/**
 * Screen reader only class
 */
export const srOnly =
  "absolute left-[-10000px] top-auto w-1 h-1 overflow-hidden";

/**
 * Ensure minimum touch target size (44x44px)
 */
export const touchTarget = "min-h-[44px] min-w-[44px]";
