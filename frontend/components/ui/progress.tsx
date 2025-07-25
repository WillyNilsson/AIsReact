"use client";

import * as React from "react";
import {
  Root as ProgressRoot,
  Indicator as ProgressIndicator,
} from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressRoot> {
  indicatorClassName?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressRoot>,
  ProgressProps
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressRoot
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-background-tertiary",
      className,
    )}
    {...props}
  >
    <ProgressIndicator
      className={cn(
        "h-full w-full flex-1 bg-brand-primary transition-all duration-500 ease-out",
        indicatorClassName,
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressRoot>
));
Progress.displayName = ProgressRoot.displayName;

export { Progress };
