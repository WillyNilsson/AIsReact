"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeleteButtonProps {
  onClick: () => void;
  size?: "sm" | "md" | "lg";
  variant?: "outline" | "ghost" | "primary";
  className?: string;
  children?: React.ReactNode;
  showIcon?: boolean;
  disabled?: boolean;
}

export function DeleteButton({
  onClick,
  size = "sm",
  variant = "outline",
  className,
  children = "Delete",
  showIcon = true,
  disabled = false,
}: DeleteButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "group relative overflow-hidden transition-all duration-300",
        "border-red-500/30 text-red-400",
        "hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50",
        "focus:ring-red-500/50",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {/* Hover effect background */}
      <span className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/10 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Content */}
      <span className="relative flex items-center gap-2">
        {showIcon && (
          <Trash2
            className={cn(
              "transition-transform duration-300 group-hover:scale-110",
              size === "sm" && "w-4 h-4",
              size === "md" && "w-5 h-5",
              size === "lg" && "w-6 h-6",
            )}
          />
        )}
        {children}
      </span>
    </Button>
  );
}

// Danger Zone Delete Button - for more prominent delete actions
interface DangerZoneDeleteProps {
  onDelete: () => void;
  buttonText?: string;
  disabled?: boolean;
  className?: string;
}

export function DangerZoneDelete({
  onDelete,
  buttonText = "Delete",
  disabled = false,
  className,
}: DangerZoneDeleteProps) {
  return (
    <div className={cn("pt-6", className)}>
      <DeleteButton onClick={onDelete} disabled={disabled} showIcon={true}>
        {buttonText}
      </DeleteButton>
    </div>
  );
}
