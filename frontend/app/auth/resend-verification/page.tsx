"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, CheckCircle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { logError } from "@/lib/logger";
import { api } from "@/lib/api";
import { AxiosError } from "axios";

export default function ResendVerificationPage() {
  const router = useRouter();
  const { user, accessToken: _accessToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleResendVerification = async () => {
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await api.post("/api/auth/resend-verification/");
      setSuccessMessage(
        response.data.detail || "Verification email sent successfully!",
      );
    } catch (error) {
      logError("Resend verification error:", error, { userId: user?.id });

      // Handle specific error cases
      if ((error as AxiosError<{ detail?: string }>)?.response?.data?.detail) {
        setErrorMessage(
          (error as AxiosError<{ detail: string }>).response!.data.detail,
        );
      } else if ((error as Error)?.message) {
        setErrorMessage((error as Error).message);
      } else {
        setErrorMessage(
          "An error occurred while sending the verification email",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToHome = () => {
    router.push("/");
  };

  // Handle redirects in useEffect to avoid SSR issues
  useEffect(() => {
    if (!user) {
      router.push("/auth/login");
    } else if (user.is_verified) {
      router.push("/");
    }
  }, [user, router]);

  // Show loading state while checking auth
  if (!user || user.is_verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1117] px-4">
        <Card className="w-full max-w-md p-8 bg-[#161B22] border-[#30363D]">
          <div className="text-center">
            <Loader2 className="h-16 w-16 text-[#2F81F7] animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[#E6EDF3] mb-2">
              Loading...
            </h1>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1117] px-4">
      <Card className="w-full max-w-md p-8 bg-[#161B22] border-[#30363D]">
        <div className="text-center">
          <Mail className="h-16 w-16 text-[#2F81F7] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#E6EDF3] mb-2">
            Verify Your Email
          </h1>
          <p className="text-[#8B949E] mb-6">
            Your email address ({user.email}) is not yet verified. Please check
            your inbox for a verification email or request a new one.
          </p>

          {successMessage && (
            <Alert className="mb-4 bg-green-500/10 border-green-500/20">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-400">
                {successMessage}
              </AlertDescription>
            </Alert>
          )}

          {errorMessage && (
            <Alert className="mb-4 bg-red-500/10 border-red-500/20">
              <AlertDescription className="text-red-400">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Button
              onClick={handleResendVerification}
              disabled={isLoading}
              className="w-full bg-[#2F81F7] hover:bg-[#2F81F7]/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Verification Email"
              )}
            </Button>

            <Button
              onClick={handleBackToHome}
              variant="outline"
              className="w-full border-[#30363D] hover:bg-[#1C2128]"
            >
              Back to Home
            </Button>
          </div>

          {successMessage && (
            <p className="text-sm text-[#8B949E] mt-4">
              Please check your email inbox and click the verification link. The
              link will expire in 7 days.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
