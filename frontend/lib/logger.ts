/**
 * Frontend logger utility that provides environment-aware logging.
 * In production, logs are disabled by default unless explicitly enabled.
 * In development, all logs are shown.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

// Extend Window interface for Sentry
declare global {
  interface Window {
    Sentry?: {
      captureMessage: (
        message: string,
        context: {
          level: string;
          extra?: unknown;
        },
      ) => void;
    };
  }
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

class Logger {
  private isDevelopment: boolean;
  private isDebugEnabled: boolean;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
    this.isDebugEnabled = process.env.NEXT_PUBLIC_DEBUG === "true";
  }

  private shouldLog(level: LogLevel): boolean {
    // In development, always log
    if (this.isDevelopment) {
      return true;
    }

    // In production, only log errors unless debug is enabled
    if (level === "error") {
      return true;
    }

    return this.isDebugEnabled;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (context) {
      return `${prefix} ${message} ${JSON.stringify(context)}`;
    }

    return `${prefix} ${message}`;
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);

    // Keep buffer size limited
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  private sendToMonitoring(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): void {
    // In production, send errors to monitoring service
    if (!this.isDevelopment && level === "error") {
      // If we have error tracking (e.g., Sentry) configured, send the error
      if (typeof window !== "undefined" && window.Sentry) {
        window.Sentry.captureMessage(message, {
          level,
          extra: context,
        });
      }
    }
  }

  debug(message: string, context?: LogContext): void {
    const entry: LogEntry = {
      level: "debug",
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    this.addToBuffer(entry);

    if (this.shouldLog("debug")) {
      // eslint-disable-next-line no-console
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    const entry: LogEntry = {
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    this.addToBuffer(entry);

    if (this.shouldLog("info")) {
      // eslint-disable-next-line no-console
      console.info(this.formatMessage("info", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    const entry: LogEntry = {
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    this.addToBuffer(entry);

    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const entry: LogEntry = {
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      context: {
        ...context,
        error: error
          ? {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              name: error instanceof Error ? error.name : undefined,
            }
          : undefined,
      },
    };

    this.addToBuffer(entry);
    this.sendToMonitoring("error", message, entry.context);

    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message, entry.context));
    }
  }

  /**
   * Get the log buffer for debugging purposes
   */
  getLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Clear the log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Group console logs (development only)
   */
  group(label: string): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.group(label);
    }
  }

  groupEnd(): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.groupEnd();
    }
  }

  /**
   * Time measurement (development only)
   */
  time(label: string): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.timeEnd(label);
    }
  }

  /**
   * Table display (development only)
   */
  table(data: unknown): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.table(data);
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Export logger instance and utility functions
export default logger;
export { logger };

// Export convenience functions
export const logDebug = (message: string, context?: LogContext) =>
  logger.debug(message, context);
export const logInfo = (message: string, context?: LogContext) =>
  logger.info(message, context);
export const logWarn = (message: string, context?: LogContext) =>
  logger.warn(message, context);
export const logError = (
  message: string,
  error?: Error | unknown,
  context?: LogContext,
) => logger.error(message, error, context);

// Export types for use in other files
export type { LogEntry, LogLevel, LogContext };
