"use client";

/**
 * Forgot Password Page
 *
 * Allows users to request a password reset link.
 */

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { getErrorMessage } from "@/lib/errors/messages";
import { api } from "@/lib/api";
import { AxiosError } from "axios";

interface ForgotPasswordFormData {
  email: string;
}

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>();

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError(null);
    setSuccess(false);

    try {
      await api.post(
        "/api/auth/password-reset/",
        data as unknown as Record<string, unknown>,
      );
      setSuccess(true);
    } catch (error) {
      const errorMsg = getErrorMessage(
        (error as AxiosError<{ detail?: string }>)?.response?.data?.detail ||
          (error as Error)?.message ||
          "password reset failed",
        { action: "update", field: "email" },
      );
      setError(errorMsg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background-primary)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">AIsReact</h1>
          <p className="text-[var(--text-secondary)]">Reset your password</p>
        </div>

        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">
              Forgot password?
            </CardTitle>
            <CardDescription>
              Enter your email for a reset link.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <AlertDescription>
                    Check your email for a reset link.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" required>
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  error={!!errors.email}
                  disabled={success}
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email address",
                    },
                  })}
                />
                {errors.email && (
                  <p className="text-sm text-error">{errors.email.message}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full"
                isLoading={isSubmitting}
                disabled={isSubmitting || success}
              >
                Send reset link
              </Button>

              <Link
                href="/auth/login"
                className="flex items-center text-sm text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft className="mr-2" size={16} />
                Back to login
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
