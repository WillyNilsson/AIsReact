/**
 * JWT Utility Functions
 *
 * Simple JWT decoding without external dependencies
 */

interface JWTPayload {
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * Decode a JWT token (without verification)
 * This is safe for reading expiry time client-side
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];
    // Add padding if needed
    const paddedPayload =
      payload + "==".substring(0, (4 - (payload.length % 4)) % 4);
    const decoded = atob(paddedPayload.replace(/-/g, "+").replace(/_/g, "/"));

    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Get the expiry time from a JWT token
 * Returns null if token is invalid or has no expiry
 */
export function getTokenExpiry(token: string): Date | null {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return null;
  }

  // JWT exp is in seconds, convert to milliseconds
  return new Date(payload.exp * 1000);
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) {
    return true; // Treat invalid tokens as expired
  }

  return expiry.getTime() < Date.now();
}

/**
 * Get minutes until token expires
 */
export function getMinutesUntilExpiry(token: string): number {
  const expiry = getTokenExpiry(token);
  if (!expiry) {
    return 0;
  }

  const msUntilExpiry = expiry.getTime() - Date.now();
  return Math.max(0, Math.floor(msUntilExpiry / 60000));
}
