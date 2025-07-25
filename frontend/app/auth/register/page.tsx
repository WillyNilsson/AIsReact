"use client";

/**
 * Registration Page
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { useAuth } from "@/hooks/useAuth";
import { logError } from "@/lib/logger";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const handleRegister = async (data: {
    username: string;
    email?: string;
    password: string;
  }) => {
    if (!data.email) {
      return { success: false, error: "Email is required" };
    }

    try {
      const result = await register({
        username: data.username,
        email: data.email,
        password: data.password,
      });

      if (result.success) {
        router.push("/");
      }

      return result;
    } catch (error) {
      logError("Registration error:", error, { username: data.username });
      return {
        success: false,
        error: "Registration failed. Please try again.",
      };
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">AIsReact</h1>
          <p className="text-gray-400">Join our community of AI observers</p>
        </div>

        <AuthForm mode="register" onSubmit={handleRegister} />
      </div>
    </div>
  );
}
