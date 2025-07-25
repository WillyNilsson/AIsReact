"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";

export interface SimpleMarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
}

export default function SimpleMarkdownEditor({
  value = "",
  onChange,
  placeholder = "Write your content here... (Markdown supported)",
  disabled = false,
  minHeight = 200,
  maxHeight = 500,
  className,
}: SimpleMarkdownEditorProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e.target.value);
    },
    [onChange],
  );

  return (
    <div className={cn("w-full", className)}>
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full px-4 py-3 rounded-lg",
          "bg-[#24283b] border border-[#414868]",
          "text-[#c0caf5] placeholder-[#787c99]",
          "focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent",
          "transition-all duration-200",
          "resize-none font-mono text-sm",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        style={{
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
        }}
      />
      <p className="mt-2 text-xs text-[#787c99]">
        Supports Markdown formatting: **bold**, *italic*, [links](url), `code`,
        etc.
      </p>
    </div>
  );
}
