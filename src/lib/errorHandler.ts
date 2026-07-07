/**
 * Enhanced Production-Grade Error Handler
 * HIPAA-compliant error handling with user-friendly messages
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400, true);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401, true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Not authorized') {
    super(message, 'AUTHORIZATION_ERROR', 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404, true);
  }
}

export interface ErrorLog {
  timestamp: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  code?: string;
  stack?: string;
  context?: Record<string, any>;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: number;
  };
}

class ErrorHandler {
  private logs: ErrorLog[] = [];
  private maxLogs = 1000;
  private enableConsole = true;

  log(severity: 'error' | 'warning' | 'info', message: string, context?: Record<string, any>, stack?: string, code?: string) {
    const entry: ErrorLog = {
      timestamp: new Date().toISOString(),
      severity,
      message,
      code,
      stack,
      context
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (this.enableConsole) {
      const consoleMethod = severity === 'error' ? console.error : severity === 'warning' ? console.warn : console.log;
      consoleMethod(`[${severity.toUpperCase()}] ${message}`, context);
    }

    // Send to monitoring service if configured
    if (process.env.MONITORING_ENDPOINT && severity === 'error') {
      this.sendToMonitoring(entry).catch(() => {
        // Fail silently to avoid cascading errors
      });
    }
  }

  error(message: string, context?: Record<string, any>, stack?: string, code?: string) {
    this.log('error', message, context, stack, code);
  }

  warning(message: string, context?: Record<string, any>) {
    this.log('warning', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context);
  }

  handleError(error: unknown): ErrorResponse {
    console.error('Error occurred:', error);

    if (error instanceof AppError) {
      return this.handleAppError(error);
    }

    if (error instanceof Error) {
      return this.handleUnknownError(error);
    }

    return this.handleUnknownError(new Error(String(error)));
  }

  getUserFriendlyMessage(error: unknown): string {
    if (error instanceof AppError) {
      return error.message;
    }

    if (error instanceof Error) {
      return 'An unexpected error occurred. Please try again.';
    }

    return 'Unknown error occurred';
  }

  getLogs() {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  private handleAppError(error: AppError): ErrorResponse {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        timestamp: Date.now()
      }
    };
  }

  private handleUnknownError(error: Error): ErrorResponse {
    console.error('Unknown error:', error);

    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: {
          originalMessage: error.message
        },
        timestamp: Date.now()
      }
    };
  }

  private async sendToMonitoring(entry: ErrorLog) {
    try {
      await fetch(process.env.MONITORING_ENDPOINT || '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (_err) {
      // Silent failure
    }
  }
}

export const errorHandler = new ErrorHandler();

/**
 * Wraps async functions with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorContext: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      const stack = err instanceof Error ? err.stack : undefined;
      const code = err instanceof AppError ? err.code : undefined;
      errorHandler.error(
        `${errorContext}: ${err instanceof Error ? err.message : String(err)}`,
        { args },
        stack,
        code
      );
      throw err;
    }
  }) as T;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    errorHandler.warning('JSON parse failed, using fallback', { json: json.substring(0, 100) });
    return fallback;
  }
}

/**
 * Retry logic with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts - 1) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        errorHandler.warning(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms`, {
          error: lastError.message
        });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
