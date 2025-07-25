"use client";

/**
 * Reset Password Page
 *
 * Allows users to reset their password using a token from email.
 */

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors/messages";
import { AxiosError } from "axios";

interface ResetPasswordFormData {
  new_password: string;
  confirm_password: string;
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>();

  const newPassword = watch("new_password");

  useEffect(() => {
    // Get token from URL parameters
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      const errorMsg = getErrorMessage("invalid token", { action: "verify" });
      setError(errorMsg);
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      const errorMsg = getErrorMessage("invalid token", { action: "verify" });
      setError(errorMsg);
      return;
    }

    setError(null);

    try {
      const result = await api.post("/api/auth/password-reset/confirm/", {
        token,
        new_password: data.new_password,
      });

      // Auto-login after successful password reset
      if (result.data.access_token && result.data.refresh_token) {
        setAuth(
          result.data.user,
          result.data.access_token,
          result.data.refresh_token,
        );
        router.push("/");
      } else {
        // Redirect to login if no tokens provided
        router.push("/auth/login?reset=success");
      }
    } catch (error) {
      const errorMsg = getErrorMessage(
        (error as AxiosError<{ detail?: string; token?: string[] }>)?.response
          ?.data?.detail ||
          (error as AxiosError<{ detail?: string; token?: string[] }>)?.response
            ?.data?.token?.[0] ||
          (error as Error)?.message ||
          "password reset failed",
        { action: "update", field: "password" },
      );
      setError(errorMsg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background-primary)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">AIsReact</h1>
          <p className="text-[var(--text-secondary)]">
            Create your new password
          </p>
        </div>

        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Reset password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="new_password" required>
                  New password
                </Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    error={!!errors.new_password}
                    disabled={!token}
                    {...register("new_password", {
                      required: "Password is required",
                      minLength: {
                        value: 12,
                        message: "Password must be at least 12 characters",
                      },
                      validate: {
                        complexity: (value) => {
                          const hasUpperCase = /[A-Z]/.test(value);
                          const hasLowerCase = /[a-z]/.test(value);
                          const hasNumber = /[0-9]/.test(value);
                          const hasSpecialChar =
                            /[!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?`~]/.test(
                              value,
                            );

                          if (!hasUpperCase) {
                            return "Password must contain at least one uppercase letter";
                          }
                          if (!hasLowerCase) {
                            return "Password must contain at least one lowercase letter";
                          }
                          if (!hasNumber) {
                            return "Password must contain at least one number";
                          }
                          if (!hasSpecialChar) {
                            return "Password must contain at least one special character";
                          }

                          return true;
                        },
                      },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.new_password && (
                  <p className="text-sm text-error">
                    {errors.new_password.message}
                  </p>
                )}
                {newPassword && (
                  <PasswordStrengthMeter
                    password={newPassword}
                    className="mt-2"
                  />
                )}
                {!errors.new_password && !newPassword && (
                  <div className="text-xs text-text-secondary space-y-1">
                    <p>Password requirements:</p>
                    <ul className="list-disc list-inside pl-2">
                      <li>At least 12 characters long</li>
                      <li>One uppercase letter (A-Z)</li>
                      <li>One lowercase letter (a-z)</li>
                      <li>One number (0-9)</li>
                      <li>One special character (!@#$%^&*...)</li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password" required>
                  Confirm password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    error={!!errors.confirm_password}
                    disabled={!token}
                    {...register("confirm_password", {
                      required: "Please confirm your password",
                      validate: (value) =>
                        value === newPassword || "Passwords do not match",
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
                {errors.confirm_password && (
                  <p className="text-sm text-error">
                    {errors.confirm_password.message}
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full"
                isLoading={isSubmitting}
                disabled={isSubmitting || !token}
              >
                Reset password
              </Button>

              <p className="text-sm text-center text-text-secondary">
                Remember your password?{" "}
                <Link
                  href="/auth/login"
                  className="text-brand-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
