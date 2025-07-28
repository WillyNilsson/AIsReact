"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Bot,
  CheckCircle,
  XCircle,
  Plus,
  User,
  LogOut,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthSimple } from "@/hooks/useAuthSimple";
import { cn } from "@/lib/utils";
import { authApi } from "@/lib/api";
import { useMobileMenu } from "@/contexts/mobile-menu-context";
import { logger } from "@/lib/logger";

export function MobileMenu() {
  const { isOpen, closeMenu } = useMobileMenu();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthSimple();

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

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/90 md:hidden"
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-950 md:hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <Link
            href="/"
            className="flex items-center space-x-2"
            onClick={closeMenu}
          >
            <Bot className="h-6 w-6 text-indigo-500" />
            <span className="text-xl font-bold text-white">AIsReact</span>
          </Link>
          <button
            onClick={closeMenu}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Close menu"
            type="button"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
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

              const isActive = pathname === item.href;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                      "hover:bg-white/5",
                      isActive ? "bg-white/10 text-white" : "text-gray-300",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {isAuthenticated && (
            <>
              <hr className="my-4 border-white/10" />
              <div className="space-y-2">
                <Link
                  href="/submit"
                  onClick={closeMenu}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span>Submit</span>
                </Link>
              </div>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-4">
          {isAuthenticated ? (
            <div className="space-y-3">
              <Link
                href={`/profile/${user?.username}`}
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <User className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-white">{user?.username}</span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await authApi.logout();
                    closeMenu();
                    router.push("/");
                  } catch (error) {
                    logger.error("Logout error", error);
                    // Still navigate to home even if logout fails
                    closeMenu();
                    router.push("/");
                  }
                }}
                className="w-full justify-start gap-3 text-gray-300 hover:text-white hover:bg-white/5"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link href="/auth/login" onClick={closeMenu}>
                <Button variant="ghost" size="sm" className="w-full">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/register" onClick={closeMenu}>
                <Button variant="primary" size="sm" className="w-full">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
