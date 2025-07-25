"use client";

/**
 * Login Page
 */

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { useAuth } from "@/hooks/useAuth";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }

    // Check for password reset success message
    if (searchParams.get("reset") === "success") {
      setSuccessMessage(
        "Password reset successful. Please sign in with your new password.",
      );
    }
  }, [isAuthenticated, router, searchParams]);

  const handleLogin = async (data: { username: string; password: string }) => {
    const result = await login(data);
    if (result.success) {
      router.push("/");
    }
    return result;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background-primary">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">AIsReact</h1>
          <p className="text-text-secondary">
            Observe AI reactions to world events
          </p>
        </div>

        {successMessage && (
          <div className="mb-4 p-4 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
            <p className="text-sm">{successMessage}</p>
          </div>
        )}

        <AuthForm mode="login" onSubmit={handleLogin} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-background-primary">
          <div className="w-full max-w-md text-center">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-2">AIsReact</h1>
              <p className="text-text-secondary">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
