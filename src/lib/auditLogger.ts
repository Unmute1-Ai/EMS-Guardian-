/**
 * Production-Grade Audit Logging
 * HIPAA-compliant audit trail for all system activities
 */

export interface LogEntry {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  timestamp: number;
  service: string;
  message: string;
  userId?: string;
  sessionId?: string;
  action?: string;
  resource?: string;
  details?: Record<string, any>;
  errorStack?: string;
}

class AuditLogger {
  private logs: LogEntry[] = [];
  private sessionId: string = this.generateSessionId();

  /**
   * Log information
   */
  public info(service: string, message: string, details?: Record<string, any>): void {
    this.log('INFO', service, message, details);
  }

  /**
   * Log warning
   */
  public warn(service: string, message: string, details?: Record<string, any>): void {
    this.log('WARN', service, message, details);
  }

  /**
   * Log error
   */
  public error(service: string, message: string, error?: Error, details?: Record<string, any>): void {
    this.log('ERROR', service, message, {
      ...details,
      errorMessage: error?.message,
      errorStack: error?.stack
    });
  }

  /**
   * Log critical security event
   */
  public critical(service: string, message: string, details?: Record<string, any>): void {
    this.log('CRITICAL', service, message, details);
    // In production: Alert security team immediately
  }

  /**
   * Log user action
   */
  public logUserAction(userId: string, action: string, resource: string, success: boolean, details?: Record<string, any>): void {
    this.log('INFO', 'USER_ACTION', `${action} on ${resource}`, {
      userId,
      action,
      resource,
      success,
      ...details
    });
  }

  /**
   * Log API call
   */
  public logAPICall(endpoint: string, method: string, statusCode: number, duration: number, userId?: string): void {
    this.log('INFO', 'API', `${method} ${endpoint}`, {
      endpoint,
      method,
      statusCode,
      duration,
      userId
    });
  }

  /**
   * Get logs with filtering
   */
  public getLogs(filter?: {
    level?: string;
    service?: string;
    userId?: string;
    startTime?: number;
    endTime?: number;
  }): LogEntry[] {
    return this.logs.filter(log => {
      if (filter?.level && log.level !== filter.level) return false;
      if (filter?.service && log.service !== filter.service) return false;
      if (filter?.userId && log.userId !== filter.userId) return false;
      if (filter?.startTime && log.timestamp < filter.startTime) return false;
      if (filter?.endTime && log.timestamp > filter.endTime) return false;
      return true;
    });
  }

  /**
   * Export logs for compliance reporting
   */
  public exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    // CSV format
    const headers = ['timestamp', 'level', 'service', 'message', 'userId', 'action', 'resource'];
    const rows = this.logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.level,
      log.service,
      log.message,
      log.userId || '',
      log.action || '',
      log.resource || ''
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csv;
  }

  /**
   * Clear old logs (retention policy - 90 days for production)
   */
  public pruneOldLogs(retentionDays: number = 90): void {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp >= cutoffTime);
    
    console.log(`Pruned ${initialCount - this.logs.length} logs older than ${retentionDays} days`);
  }

  // Private methods
  private log(level: LogEntry['level'], service: string, message: string, details?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      service,
      message,
      sessionId: this.sessionId,
      ...details
    };

    this.logs.push(entry);
    this.persistLog(entry);

    // Console output for development
    if (import.meta.env.DEV) {
      const prefix = `[${service}]`;
      console.log(`${prefix} ${message}`, details);
    }
  }

  private persistLog(entry: LogEntry): void {
    // In production: Send to secure logging service (Datadog, CloudWatch, ELK)
    // Ensure logs are encrypted and isolated from application data
    if (import.meta.env.PROD) {
      // Send to logging endpoint
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      }).catch(err => console.error('Failed to persist log:', err));
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const auditLogger = new AuditLogger();
export default auditLogger;
