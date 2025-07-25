"use client";

/**
 * Main Layout
 *
 * Layout for authenticated pages with header.
 */

import { Header } from "@/components/layout/header";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SkipLinks } from "@/components/layout/skip-links";
import { NavigationErrorBoundary } from "@/components/error-boundary/navigation-error-boundary";
import { MobileMenuProvider } from "@/contexts/mobile-menu-context";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NavigationErrorBoundary>
      <MobileMenuProvider>
        <SkipLinks />
        <Header />
        <MobileMenu />
        <main id="main-content" className="px-3 sm:px-4 py-6 sm:py-8">
          {children}
        </main>
      </MobileMenuProvider>
    </NavigationErrorBoundary>
  );
}
