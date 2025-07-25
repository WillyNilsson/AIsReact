import React, { useMemo } from "react";
import {
  calculatePasswordStrength,
  getStrengthColor,
  getStrengthBgColor,
} from "@/lib/utils/password-strength";

interface PasswordStrengthMeterProps {
  password: string;
  showFeedback?: boolean;
  className?: string;
}

export function PasswordStrengthMeter({
  password,
  showFeedback = true,
  className = "",
}: PasswordStrengthMeterProps) {
  const strengthResult = useMemo(
    () => calculatePasswordStrength(password),
    [password],
  );

  if (!password) {
    return null;
  }

  const { strength, score, feedback } = strengthResult;
  const strengthText = strength.charAt(0).toUpperCase() + strength.slice(1);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Strength meter bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-[var(--text-secondary)]">
            Password strength
          </span>
          <span className={`text-xs font-medium ${getStrengthColor(strength)}`}>
            {strengthText}
          </span>
        </div>

        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-out ${getStrengthBgColor(
              strength,
            )}`}
            style={{ width: `${score}%` }}
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Password strength: ${strengthText} (${score}%)`}
          />
        </div>
      </div>

      {/* Feedback */}
      {showFeedback && feedback.length > 0 && (
        <div className="space-y-1">
          {feedback.map((tip, index) => (
            <p key={index} className="text-xs text-[var(--text-secondary)]">
              • {tip}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
