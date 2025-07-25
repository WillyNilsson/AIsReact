"use client";

/**
 * Protected Route Component
 *
 * Wraps components that require authentication.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireVerified?: boolean;
  requireRole?: "user" | "moderator" | "admin";
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requireVerified = false,
  requireRole,
  fallback = <LoadingSpinner />,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading state
  if (isLoading) {
    return <>{fallback}</>;
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Check email verification
  if (requireVerified && !user.is_verified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">
            Email Verification Required
          </h2>
          <p className="text-[var(--text-secondary)]">
            Please verify your email address to access this feature.
          </p>
        </div>
      </div>
    );
  }

  // Check role requirements
  if (requireRole) {
    const roleHierarchy = { user: 0, moderator: 1, admin: 2 };
    const userRoleLevel = roleHierarchy[user.role] || 0;
    const requiredRoleLevel = roleHierarchy[requireRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-[var(--text-secondary)]">
              You need {requireRole} privileges to access this page.
            </p>
          </div>
        </div>
      );
    }
  }

  // All checks passed
  return <>{children}</>;
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)]"></div>
    </div>
  );
}
