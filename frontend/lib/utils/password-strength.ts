/**
 * Password strength calculation utilities
 */

export type PasswordStrength = "weak" | "medium" | "strong"; // pragma: allowlist secret

export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0-100
  feedback: string[];
}

/**
 * Calculate password strength based on various factors
 */
export function calculatePasswordStrength(
  password: string,
): PasswordStrengthResult {
  if (!password) {
    return {
      strength: "weak",
      score: 0,
      feedback: ["Enter a password"],
    };
  }

  let score = 0;
  const feedback: string[] = [];

  // Length scoring (max 30 points)
  if (password.length >= 12) {
    score += 15;
    if (password.length >= 16) {
      score += 10;
      if (password.length >= 20) {
        score += 5;
      }
    }
  } else {
    feedback.push(`Add ${12 - password.length} more characters`);
  }

  // Character variety scoring (max 40 points)
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChars = /[!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?`~]/.test(
    password,
  );

  let varietyCount = 0;
  if (hasLowercase) {
    varietyCount++;
  }
  if (hasUppercase) {
    varietyCount++;
  }
  if (hasNumbers) {
    varietyCount++;
  }
  if (hasSpecialChars) {
    varietyCount++;
  }

  score += varietyCount * 10;

  // Add feedback for missing character types
  if (!hasUppercase) {
    feedback.push("Add uppercase letters");
  }
  if (!hasLowercase) {
    feedback.push("Add lowercase letters");
  }
  if (!hasNumbers) {
    feedback.push("Add numbers");
  }
  if (!hasSpecialChars) {
    feedback.push("Add special characters");
  }

  // Pattern penalty (reduce score for common patterns)
  const hasRepeatingChars = /(.)\1{2,}/.test(password); // 3+ repeating chars
  const hasSequentialNumbers =
    /(?:012|123|234|345|456|567|678|789|890|987|876|765|654|543|432|321|210)/.test(
      password,
    );
  const hasSequentialLetters =
    /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(
      password,
    );
  const hasKeyboardPatterns =
    /(?:qwer|wert|erty|rtyu|tyui|yuio|uiop|asdf|sdfg|dfgh|fghj|ghjk|hjkl|zxcv|xcvb|cvbn|vbnm)/i.test(
      password,
    );

  if (hasRepeatingChars) {
    score -= 10;
    feedback.push("Avoid repeating characters");
  }
  if (hasSequentialNumbers || hasSequentialLetters) {
    score -= 10;
    feedback.push("Avoid sequential characters");
  }
  if (hasKeyboardPatterns) {
    score -= 10;
    feedback.push("Avoid keyboard patterns");
  }

  // Common password patterns penalty
  const lowerPassword = password.toLowerCase();
  const commonPatterns = [
    "password",
    "letmein",
    "welcome",
    "admin",
    "user",
    "login",
  ];
  if (commonPatterns.some((pattern) => lowerPassword.includes(pattern))) {
    score -= 20;
    feedback.push("Avoid common words");
  }

  // Entropy bonus (max 30 points)
  const uniqueChars = new Set(password).size;
  const entropyRatio = uniqueChars / password.length;
  score += Math.floor(entropyRatio * 30);

  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine strength category
  let strength: PasswordStrength;
  if (score < 40) {
    strength = "weak";
  } else if (score < 70) {
    strength = "medium";
  } else {
    strength = "strong";
  }

  // Provide positive feedback for strong passwords
  if (strength === "strong" && feedback.length === 0) {
    feedback.push("Great password!");
  }

  return {
    strength,
    score,
    feedback,
  };
}

/**
 * Get color class for password strength
 */
export function getStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case "weak":
      return "text-red-500";
    case "medium":
      return "text-yellow-500";
    case "strong":
      return "text-green-500";
    default:
      return "text-gray-500";
  }
}

/**
 * Get background color class for password strength meter
 */
export function getStrengthBgColor(strength: PasswordStrength): string {
  switch (strength) {
    case "weak":
      return "bg-red-500";
    case "medium":
      return "bg-yellow-500";
    case "strong":
      return "bg-green-500";
    default:
      return "bg-gray-300";
  }
}
