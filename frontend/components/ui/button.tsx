/**
 * Button Component
 *
 * Reusable button with multiple variants and sizes.
 */

import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "danger"
    | "outline"
    | "gradient"
    | "neumorph";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "relative inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:pointer-events-none disabled:opacity-50 group haptic-tap transform-gpu";

    const variants = {
      primary:
        "bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98]",
      secondary:
        "bg-gray-800/50 backdrop-blur-sm text-gray-100 hover:bg-gray-700/50 border border-gray-700/50 hover:border-gray-600/50 hover:scale-[1.01] active:scale-[0.99]",
      ghost:
        "hover:bg-gray-800/50 hover:text-gray-100 text-gray-400 hover:scale-[1.01] active:scale-[0.99]",
      danger:
        "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]",
      outline:
        "border border-gray-700/50 bg-transparent hover:bg-gray-800/30 text-gray-300 hover:text-gray-100 hover:border-gray-600/50 hover:scale-[1.01] active:scale-[0.99]",
      gradient:
        "bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98]",
      neumorph:
        "neumorph-glass text-gray-100 hover:text-white hover:scale-[1.01] active:scale-[0.99]",
    };

    const sizes = {
      sm: "h-9 px-4 text-sm rounded-lg",
      md: "h-11 px-6 py-2.5 rounded-xl",
      lg: "h-13 px-8 text-lg rounded-xl",
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {/* Gradient overlay for hover effect */}
        <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Button content */}
        <span className="relative flex items-center gap-2">
          {isLoading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Loading...</span>
            </>
          ) : (
            children
          )}
        </span>
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button };
