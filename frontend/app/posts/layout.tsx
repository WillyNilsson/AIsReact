"use client";

/**
 * Posts Layout
 *
 * Layout for post pages with header.
 */

import { Header } from "@/components/layout/header";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SkipLinks } from "@/components/layout/skip-links";
import { MobileMenuProvider } from "@/contexts/mobile-menu-context";

export default function PostsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileMenuProvider>
      <SkipLinks />
      <Header />
      <MobileMenu />
      <main id="main-content" className="min-h-screen">
        {children}
      </main>
    </MobileMenuProvider>
  );
}
