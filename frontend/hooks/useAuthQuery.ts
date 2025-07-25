import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserSchema } from "@/lib/schemas/user";
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  AuthResponseSchema,
  type LoginRequest,
  type RegisterRequest,
} from "@/lib/schemas/auth";
import { parseErrorResponse } from "@/lib/schemas/error";
import { useAuthStore } from "@/store/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function useLogin() {
  const queryClient = useQueryClient();
  const { setAuth, clearAuth } = useAuthStore();

  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      // Validate input
      const validatedData = LoginRequestSchema.parse(data);
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(parseErrorResponse(error));
      }

      const result = await response.json();
      const validated = AuthResponseSchema.parse(result);

      return validated;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.access_token);
      queryClient.setQueryData(["currentUser"], data.user);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: () => {
      clearAuth();
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      // Validate input
      const validatedData = RegisterRequestSchema.parse(data);
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(parseErrorResponse(error));
      }

      const result = await response.json();
      const validated = AuthResponseSchema.parse(result);

      return validated;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.access_token);
      queryClient.setQueryData(["currentUser"], data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { clearAuth, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        return;
      }

      const response = await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok && response.status !== 401) {
        throw new Error("Logout failed");
      }
    },
    onSettled: () => {
      clearAuth();
      queryClient.clear();
    },
  });
}

export function useCurrentUser() {
  const { accessToken: token, user } = useAuthStore();

  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentication expired");
        }
        throw new Error("Failed to fetch user data");
      }

      const data = await response.json();
      return UserSchema.parse(data);
    },
    enabled: !!token,
    initialData: user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
