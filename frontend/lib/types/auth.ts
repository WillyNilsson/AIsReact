/**
 * Authentication-related type definitions
 */

import { User } from "../types";

// Login response from API
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

// Registration response from API
export interface RegisterResponse extends User {
  access_token: string;
  refresh_token: string;
}

// Token refresh response
export interface TokenRefreshResponse {
  access: string;
  refresh: string;
}

// Password reset request
export interface PasswordResetRequest {
  email: string;
}

// Password reset confirm
export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}
