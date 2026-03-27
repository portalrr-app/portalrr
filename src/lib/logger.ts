/**
 * Structured logging utility for Portalrr.
 *
 * Outputs JSON-formatted log lines to stdout/stderr for easy parsing
 * by Docker, log aggregators, or monitoring tools.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  error?: string;
  stack?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function extractError(err: unknown): { error: string; stack?: string } {
  if (err instanceof Error) {
    return { error: err.message, stack: err.stack };
  }
  return { error: String(err) };
}

/**
 * Log an informational message.
 */
export function logInfo(message: string, context?: string, details?: Record<string, unknown>) {
  const entry: LogEntry = {
    level: 'info',
    message,
    context,
    details,
    timestamp: new Date().toISOString(),
  };
  console.log(formatEntry(entry));
}

/**
 * Log a warning.
 */
export function logWarn(message: string, context?: string, details?: Record<string, unknown>) {
  const entry: LogEntry = {
    level: 'warn',
    message,
    context,
    details,
    timestamp: new Date().toISOString(),
  };
  console.warn(formatEntry(entry));
}

/**
 * Log an error with full context.
 */
export function logError(message: string, err: unknown, context?: string, details?: Record<string, unknown>) {
  const { error, stack } = extractError(err);
  const entry: LogEntry = {
    level: 'error',
    message,
    error,
    stack,
    context,
    details,
    timestamp: new Date().toISOString(),
  };
  console.error(formatEntry(entry));
}

/**
 * Create a scoped logger for a specific context (e.g., a route or module).
 * Avoids repeating the context string in every call.
 */
export function createLogger(context: string) {
  return {
    info: (message: string, details?: Record<string, unknown>) => logInfo(message, context, details),
    warn: (message: string, details?: Record<string, unknown>) => logWarn(message, context, details),
    error: (message: string, err: unknown, details?: Record<string, unknown>) => logError(message, err, context, details),
  };
}

/**
 * Silently-caught fire-and-forget handler.
 * Use instead of `.catch(() => {})` to ensure errors are at least logged.
 */
export function logOnError(context: string) {
  return (err: unknown) => {
    logWarn('Background task failed', context, { error: extractError(err).error });
  };
}
