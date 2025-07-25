/**
 * Optimized imports for common libraries
 * Use these instead of importing entire libraries
 */

// Optimized Lucide React imports
export {
  Search,
  RefreshCw,
  Loader2,
  User,
  Clock,
  MessageSquare,
  ExternalLink,
  Image,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Plus,
  Minus,
  Edit,
  Trash,
  Save,
  Copy,
  Download,
  Upload,
  Filter,
  Settings,
  LogOut,
  LogIn,
} from "lucide-react";

// Re-export commonly used utilities
export { cn } from "../utils";
// export { formatDate, formatRelativeTime } from './date';

// Type-safe omit function
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}

// Type-safe pick function
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
