"use client";

/**
 * Header Component
 *
 * Main navigation header.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, Bot, CheckCircle, XCircle, Plus, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/ui/user-dropdown-responsive";
import { useAuthSimple } from "@/hooks/useAuthSimple";
import { cn } from "@/lib/utils";
import { useMobileMenu } from "@/contexts/mobile-menu-context";

export function Header() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthSimple();
  const { toggleMenu } = useMobileMenu();

  const navItems: Array<{
    href: string;
    label: string;
    icon: React.ElementType;
    requireAuth?: boolean;
    requireRole?: string[];
  }> = [
    { href: "/", label: "Home", icon: Home, requireAuth: true },
    { href: "/verify", label: "Verify", icon: CheckCircle, requireAuth: true },
    { href: "/rejected", label: "Rejected", icon: XCircle, requireAuth: true },
    // Moderation page temporarily removed - see /app/(protected)/moderate/page.tsx for future implementation notes
  ];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex h-16 sm:h-20 items-center justify-between">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center space-x-2 sm:space-x-3 group"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity" />
                <Bot className="h-6 w-6 sm:h-8 sm:w-8 text-white relative z-10" />
              </div>
              <span className="text-xl sm:text-2xl bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                AIsReact
              </span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              {navItems.map((item) => {
                if (item.requireAuth && !isAuthenticated) {
                  return null;
                }
                if (
                  item.requireRole &&
                  (!user || !item.requireRole.includes(user.role))
                ) {
                  return null;
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium",
                      "transition-all duration-200",
                      "hover:bg-white/5 hover:text-white text-gray-400",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Actions */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Desktop actions */}
              <div className="hidden sm:flex items-center space-x-2">
                {isAuthenticated ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => router.push("/submit")}
                      className="hidden lg:flex"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Submit
                    </Button>
                    {user && <UserDropdown user={user} />}
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push("/auth/login")}
                    >
                      Sign In
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => router.push("/auth/register")}
                    >
                      Sign Up
                    </Button>
                  </>
                )}
              </div>

              {/* Mobile menu button - only show on mobile */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMenu}
                className="sm:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
