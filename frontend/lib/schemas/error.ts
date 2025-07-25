import { z } from "zod";

export const APIErrorSchema = z.object({
  detail: z.string(),
  code: z.string().optional(),
  field: z.string().optional(),
  status: z.number().optional(),
});

export const ValidationErrorSchema = z.object({
  detail: z.array(
    z.object({
      loc: z.array(z.union([z.string(), z.number()])),
      msg: z.string(),
      type: z.string(),
    }),
  ),
});

export const FieldErrorSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);

export const ErrorResponseSchema = z.union([
  APIErrorSchema,
  ValidationErrorSchema,
  z.object({
    errors: FieldErrorSchema,
  }),
  z.object({
    message: z.string(),
    errors: FieldErrorSchema.optional(),
  }),
]);

export type APIError = z.infer<typeof APIErrorSchema>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
export type FieldError = z.infer<typeof FieldErrorSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Helper function to parse error responses
export function parseErrorResponse(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "An unexpected error occurred";
  }

  try {
    const parsed = ErrorResponseSchema.parse(error);

    if ("detail" in parsed && typeof parsed.detail === "string") {
      return parsed.detail;
    }

    if ("detail" in parsed && Array.isArray(parsed.detail)) {
      return parsed.detail.map((err) => err.msg).join(", ");
    }

    if ("message" in parsed) {
      return parsed.message;
    }

    if ("errors" in parsed) {
      const errors = Object.entries(parsed.errors)
        .map(([field, messages]) => {
          const messageStr = Array.isArray(messages)
            ? messages.join(", ")
            : messages;
          return `${field}: ${messageStr}`;
        })
        .join("; ");
      return errors || "Validation error occurred";
    }

    return "An unexpected error occurred";
  } catch {
    // If parsing fails, try to extract any message-like property
    const errorObj = error as Record<string, unknown>;
    if ("message" in errorObj && typeof errorObj.message === "string") {
      return errorObj.message;
    }
    if ("detail" in errorObj && typeof errorObj.detail === "string") {
      return errorObj.detail;
    }
    return "An unexpected error occurred";
  }
}
