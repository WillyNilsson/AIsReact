/**
 * Input Component
 *
 * Reusable input field with consistent styling.
 */

import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl border bg-white/[0.02] px-4 py-3 text-sm",
          "placeholder:text-gray-500 backdrop-blur-sm",
          "transition-all duration-200",
          "focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.04]",
          "focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-red-500/50 focus:border-red-500/50 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]"
            : "border-white/10 hover:border-white/20",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
