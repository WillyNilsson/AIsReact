/**
 * Label Component
 *
 * Form label with consistent styling.
 */

import { forwardRef, LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-sm font-semibold text-gray-200 leading-none",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className,
        )}
        {...props}
      >
        {children}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
    );
  },
);

Label.displayName = "Label";

export { Label };
