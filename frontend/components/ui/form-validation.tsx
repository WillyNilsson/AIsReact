"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ValidationRule {
  test: (value: string) => boolean;
  message: string;
}

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  validationRules?: ValidationRule[];
  showValidationOnType?: boolean;
  className?: string;
}

// Enhanced form field with validation feedback
export function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  helperText,
  required,
  validationRules = [],
  showValidationOnType = false,
  className,
}: FormFieldProps) {
  const [touched, setTouched] = useState(false);
  const [validationState, setValidationState] = useState<
    "idle" | "valid" | "invalid"
  >("idle");
  const [validationMessages, setValidationMessages] = useState<string[]>([]);

  const validateField = useCallback(() => {
    if (!value && !required) {
      setValidationState("idle");
      setValidationMessages([]);
      return;
    }

    const failedRules = validationRules.filter((rule) => !rule.test(value));

    if (failedRules.length > 0) {
      setValidationState("invalid");
      setValidationMessages(failedRules.map((rule) => rule.message));
    } else if (value) {
      setValidationState("valid");
      setValidationMessages([]);
    } else {
      setValidationState("idle");
      setValidationMessages([]);
    }
  }, [value, required, validationRules]);

  useEffect(() => {
    if (showValidationOnType || touched) {
      validateField();
    }
  }, [value, touched, showValidationOnType, validateField]);

  const handleBlur = () => {
    setTouched(true);
    onBlur?.();
  };

  const getFieldIcon = () => {
    if (error || validationState === "invalid") {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    if (validationState === "valid") {
      return <Check className="w-4 h-4 text-green-500" />;
    }
    return null;
  };

  const fieldClasses = cn(
    "w-full px-3 py-2 pr-10 rounded-lg border transition-all duration-200",
    "focus:outline-none focus:ring-2",
    {
      "border-gray-300 dark:border-gray-700 focus:ring-blue-500":
        !error && validationState === "idle",
      "border-green-500 focus:ring-green-500": validationState === "valid",
      "border-red-500 focus:ring-red-500":
        error || validationState === "invalid",
    },
    "bg-white dark:bg-gray-900",
    "text-gray-900 dark:text-gray-100",
    className,
  );

  return (
    <div className="space-y-1">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          className={fieldClasses}
          aria-invalid={!!error || validationState === "invalid"}
          aria-describedby={`${name}-error ${name}-helper`}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {getFieldIcon()}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {(error || validationMessages.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            id={`${name}-error`}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {error || validationMessages[0]}
          </motion.div>
        )}

        {!error && !validationMessages.length && helperText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            id={`${name}-helper`}
            className="text-sm text-gray-500 dark:text-gray-400"
          >
            {helperText}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Password strength indicator
export function PasswordStrength({ password }: { password: string }) {
  const calculateStrength = () => {
    let strength = 0;
    if (password.length >= 8) {
      strength++;
    }
    if (password.length >= 12) {
      strength++;
    }
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
      strength++;
    }
    if (/\d/.test(password)) {
      strength++;
    }
    if (/[^a-zA-Z\d]/.test(password)) {
      strength++;
    }
    return strength;
  };

  const strength = calculateStrength();
  const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-blue-500",
    "bg-green-500",
  ];

  if (!password) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i < strength
                ? strengthColors[strength - 1]
                : "bg-gray-200 dark:bg-gray-700",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Password strength: {strengthLabels[strength - 1] || "Very Weak"}
      </p>
    </div>
  );
}

// Form validation summary
export function ValidationSummary({
  errors,
}: {
  errors: Record<string, string>;
}) {
  const errorList = Object.entries(errors).filter(([, error]) => error);

  if (errorList.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
    >
      <div className="flex gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Please fix the following errors:
          </p>
          <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
            {errorList.map(([field, error]) => (
              <li key={field} className="flex items-start gap-1">
                <span className="text-red-500 mt-1">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

// Live validation feedback list
export function ValidationFeedback({
  rules,
  value,
}: {
  rules: ValidationRule[];
  value: string;
}) {
  return (
    <div className="space-y-1 mt-2">
      {rules.map((rule, index) => {
        const isValid = rule.test(value);
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "flex items-center gap-2 text-sm transition-colors",
              isValid
                ? "text-green-600 dark:text-green-400"
                : "text-gray-400 dark:text-gray-600",
            )}
          >
            {isValid ? (
              <Check className="w-3 h-3" />
            ) : (
              <X className="w-3 h-3" />
            )}
            <span>{rule.message}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

// Common validation rules
export const validationRules = {
  required: (message = "This field is required"): ValidationRule => ({
    test: (value) => !!value && value.trim().length > 0,
    message,
  }),

  email: (message = "Please enter a valid email address"): ValidationRule => ({
    test: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),

  minLength: (length: number, message?: string): ValidationRule => ({
    test: (value) => value.length >= length,
    message: message || `Must be at least ${length} characters`,
  }),

  maxLength: (length: number, message?: string): ValidationRule => ({
    test: (value) => value.length <= length,
    message: message || `Must be no more than ${length} characters`,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    test: (value) => regex.test(value),
    message,
  }),

  url: (message = "Please enter a valid URL"): ValidationRule => ({
    test: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message,
  }),

  match: (
    otherValue: string,
    message = "Values do not match",
  ): ValidationRule => ({
    test: (value) => value === otherValue,
    message,
  }),
};
