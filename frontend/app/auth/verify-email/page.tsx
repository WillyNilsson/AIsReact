"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, MailOpen } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { logError } from "@/lib/logger";
import { api } from "@/lib/api";
import { AxiosError } from "axios";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const { setAuth } = useAuthStore();

  const [verificationState, setVerificationState] = useState<
    "loading" | "success" | "error" | "no-token"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setVerificationState("no-token");
      return;
    }

    // Verify the email
    const verifyEmail = async () => {
      try {
        const data = await api.get(`/api/auth/verify-email/?token=${token}`);

        // Auto-login the user
        if (data.access_token && data.user) {
          setAuth(data.user, data.access_token, data.refresh_token);
        }
        setVerificationState("success");

        // Redirect to home after 3 seconds
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } catch (error) {
        logError("Email verification error:", error, {
          token: token?.substring(0, 10) + "...",
        });

        // Handle specific error cases
        if (
          (error as AxiosError<{ detail?: string }>)?.response?.data?.detail
        ) {
          setErrorMessage(
            (error as AxiosError<{ detail: string }>).response!.data.detail,
          );
        } else if ((error as Error)?.message) {
          setErrorMessage((error as Error).message);
        } else {
          setErrorMessage("An error occurred while verifying your email");
        }
        setVerificationState("error");
      }
    };

    verifyEmail();
    return undefined;
  }, [token, setAuth, router]);

  const handleResendClick = () => {
    router.push("/auth/resend-verification");
  };

  const handleLoginClick = () => {
    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1117] px-4">
      <Card className="w-full max-w-md p-8 bg-[#161B22] border-[#30363D]">
        <div className="text-center">
          {verificationState === "loading" && (
            <>
              <Loader2 className="h-16 w-16 text-[#2F81F7] animate-spin mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-[#E6EDF3] mb-2">
                Verifying Your Email
              </h1>
              <p className="text-[#8B949E]">
                Please wait while we verify your email address...
              </p>
            </>
          )}

          {verificationState === "success" && (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-[#E6EDF3] mb-2">
                Email Verified!
              </h1>
              <p className="text-[#8B949E] mb-6">
                Email verified. Redirecting...
              </p>
              <Button
                onClick={() => router.push("/")}
                className="w-full bg-[#2F81F7] hover:bg-[#2F81F7]/90"
              >
                Go to Home
              </Button>
            </>
          )}

          {verificationState === "error" && (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-[#E6EDF3] mb-2">
                Verification Failed
              </h1>
              <Alert className="mb-6 bg-red-500/10 border-red-500/20">
                <AlertDescription className="text-red-400">
                  {errorMessage}
                </AlertDescription>
              </Alert>
              <div className="space-y-3">
                <Button
                  onClick={handleResendClick}
                  className="w-full bg-[#2F81F7] hover:bg-[#2F81F7]/90"
                >
                  Request New Verification Email
                </Button>
                <Button
                  onClick={handleLoginClick}
                  variant="outline"
                  className="w-full border-[#30363D] hover:bg-[#1C2128]"
                >
                  Back to Login
                </Button>
              </div>
            </>
          )}

          {verificationState === "no-token" && (
            <>
              <MailOpen className="h-16 w-16 text-[#8B949E] mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-[#E6EDF3] mb-2">
                Email Verification
              </h1>
              <p className="text-[#8B949E] mb-6">
                No token found. Request a new verification link.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={handleResendClick}
                  className="w-full bg-[#2F81F7] hover:bg-[#2F81F7]/90"
                >
                  Request Verification Email
                </Button>
                <Button
                  onClick={handleLoginClick}
                  variant="outline"
                  className="w-full border-[#30363D] hover:bg-[#1C2128]"
                >
                  Back to Login
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
