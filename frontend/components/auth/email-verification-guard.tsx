"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
// Temporarily disabled imports for V1
// import { Alert, AlertDescription } from "@/components/ui/alert";
// import { Button } from "@/components/ui/button";
// import { Mail } from "lucide-react";

interface EmailVerificationGuardProps {
  children: React.ReactNode;
  requireVerified?: boolean;
}

export default function EmailVerificationGuard({
  children,
  requireVerified: _requireVerified = true,
}: EmailVerificationGuardProps) {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    // If user is not logged in, they shouldn't be here
    if (!user) {
      router.push("/auth/login");
    }
  }, [user, router]);

  // TEMPORARILY DISABLED FOR V1: Email verification
  // Always render children regardless of verification status
  return <>{children}</>;

  // COMMENTED OUT FOR V1 - Re-enable when email verification is needed
  /*
  // If verification is not required, render children
  if (!requireVerified) {
    return <>{children}</>;
  }

  // If user is verified, render children
  if (user?.is_verified) {
    return <>{children}</>;
  }

  // If user is not verified, show verification prompt
  return (
    <div className="min-h-screen bg-[#0D1117] p-8">
      <div className="max-w-4xl mx-auto">
        <Alert className="bg-amber-500/10 border-amber-500/20 mb-6">
          <Mail className="h-5 w-5 text-amber-500" />
          <AlertDescription className="text-amber-400">
            <div className="flex items-center justify-between">
              <span>
                Your email address is not verified. Please verify your email to access all features.
              </span>
              <Button
                onClick={() => router.push("/auth/resend-verification")}
                size="sm"
                variant="outline"
                className="ml-4 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              >
                Verify Email
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-8 text-center">
          <Mail className="h-16 w-16 text-[#8B949E] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#E6EDF3] mb-2">
            Email Verification Required
          </h2>
          <p className="text-[#8B949E] mb-6">
            To submit posts and access all features, please verify your email address first.
          </p>
          <Button
            onClick={() => router.push("/auth/resend-verification")}
            className="bg-[#2F81F7] hover:bg-[#2F81F7]/90"
          >
            Verify Your Email
          </Button>
        </div>
      </div>
    </div>
  );
  */
}
