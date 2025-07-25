/**
 * Alert Component
 *
 * Display alerts and notifications.
 */

import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, XCircle, Info } from "lucide-react";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "error";
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variants = {
      default: "bg-white/[0.02] text-gray-200 border-white/10 backdrop-blur-sm",
      success:
        "bg-green-500/10 text-green-400 border-green-500/20 backdrop-blur-sm",
      warning:
        "bg-amber-500/10 text-amber-400 border-amber-500/20 backdrop-blur-sm",
      error: "bg-red-500/10 text-red-400 border-red-500/20 backdrop-blur-sm",
    };

    const icons = {
      default: Info,
      success: CheckCircle,
      warning: AlertCircle,
      error: XCircle,
    };

    const Icon = icons[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative w-full rounded-xl border p-5 flex items-center gap-4",
          "shadow-lg transition-all duration-200",
          variants[variant],
          className,
        )}
        {...props}
      >
        {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
        <div className="flex-1">{children}</div>
      </div>
    );
  },
);

Alert.displayName = "Alert";

const AlertTitle = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
