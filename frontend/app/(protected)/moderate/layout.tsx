"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function ModerateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // If not authenticated at all, redirect to login
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    // If authenticated but not a moderator/admin, redirect to home
    if (user && user.role !== "moderator" && user.role !== "admin") {
      router.push("/");
    }
  }, [user, isAuthenticated, router]);

  // Don't render children until we know the user is authorized
  if (
    !isAuthenticated ||
    !user ||
    (user.role !== "moderator" && user.role !== "admin")
  ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
