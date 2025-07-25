"use client";

/**
 * Protected Layout
 *
 * Layout for authenticated pages with header.
 */

import { Header } from "@/components/layout/header";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SkipLinks } from "@/components/layout/skip-links";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { NavigationErrorBoundary } from "@/components/error-boundary/navigation-error-boundary";
import { MobileMenuProvider } from "@/contexts/mobile-menu-context";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    // Only redirect after hydration to avoid flash
    if (isHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, isHydrated, router]);

  // Don't render until we know auth state
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="text-muted-foreground">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <NavigationErrorBoundary>
      <MobileMenuProvider>
        <SkipLinks />
        <Header />
        <MobileMenu />
        <main id="main-content" className="min-h-screen">
          {children}
        </main>
      </MobileMenuProvider>
    </NavigationErrorBoundary>
  );
}
