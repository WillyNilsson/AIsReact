"use client";

/**
 * Authentication Form Component
 *
 * Reusable form for login and registration.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import { ErrorAlert } from "@/components/ui/error-alert";

interface AuthFormData {
  username: string;
  email?: string;
  password: string;
}

interface AuthFormProps {
  mode: "login" | "register";
  onSubmit: (
    data: AuthFormData,
  ) => Promise<{ success: boolean; error?: string }>;
}

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormData>();

  const password = watch("password", "");

  const handleFormSubmit = async (data: AuthFormData) => {
    setError(null);
    const result = await onSubmit(data);
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">
          {mode === "login" ? "Welcome back" : "Create an account"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Enter your credentials to access your account"
            : "Enter your details to create your account"}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <ErrorAlert
              error={error}
              context={{ action: mode }}
              onDismiss={() => setError(null)}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="username" required>
              {mode === "login" ? "Username or Email" : "Username"}
            </Label>
            <Input
              id="username"
              placeholder={
                mode === "login" ? "johndoe or john@example.com" : "johndoe"
              }
              error={!!errors.username}
              {...register("username", {
                required: "Username is required",
                minLength: {
                  value: mode === "register" ? 3 : 1,
                  message: "Username must be at least 3 characters",
                },
                ...(mode === "register" && {
                  pattern: {
                    value: /^[a-zA-Z0-9_-]+$/,
                    message:
                      "Username can only contain letters, numbers, underscores, and hyphens",
                  },
                }),
              })}
            />
            {errors.username && (
              <p className="text-sm text-[var(--error)]">
                {errors.username.message}
              </p>
            )}
          </div>

          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="email" required>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                error={!!errors.email}
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address",
                  },
                })}
              />
              {errors.email && (
                <p className="text-sm text-[var(--error)]">
                  {errors.email.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password" required>
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                error={!!errors.password}
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: mode === "register" ? 12 : 1,
                    message: "Password must be at least 12 characters",
                  },
                  ...(mode === "register" && {
                    validate: {
                      complexity: (value) => {
                        const hasUpperCase = /[A-Z]/.test(value);
                        const hasLowerCase = /[a-z]/.test(value);
                        const hasNumber = /[0-9]/.test(value);
                        const hasSpecialChar =
                          /[!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?`~]/.test(value);

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
                  }),
                })}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-[var(--error)]">
                {errors.password.message}
              </p>
            )}
            {mode === "register" && password && (
              <PasswordStrengthMeter password={password} className="mt-2" />
            )}
            {mode === "register" && passwordFocused && (
              <div className="text-xs text-[var(--text-secondary)] space-y-1">
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

          {mode === "login" && (
            <div className="flex justify-end">
              <Link
                href="/auth/forgot-password"
                className="text-sm text-[var(--accent)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {mode === "login" ? "Sign In" : "Create Account"}
          </Button>

          <p className="text-sm text-center text-[var(--text-secondary)]">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <Link
                  href="/auth/register"
                  className="text-[var(--accent)] hover:underline"
                >
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="text-[var(--accent)] hover:underline"
                >
                  Sign in
                </Link>
              </>
            )}
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
