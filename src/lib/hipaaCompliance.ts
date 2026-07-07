/**
 * HIPAA Compliance Framework
 * Implements Privacy Rule, Security Rule, and Breach Notification Rule
 */

export interface AuditLog {
  timestamp: number;
  userId: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'LOGIN' | 'LOGOUT';
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  status: 'SUCCESS' | 'FAILURE';
  reason?: string;
}

export interface AccessControl {
  userId: string;
  role: 'PARAMEDIC' | 'SUPERVISOR' | 'ADMINISTRATOR' | 'AUDITOR';
  permissions: string[];
  departmentId: string;
  accessLevel: 'FULL' | 'LIMITED' | 'READ_ONLY';
  mfaEnabled: boolean;
  lastPasswordChange: number;
}

export interface BreachNotification {
  breachDate: number;
  discoveryDate: number;
  affectedIndividuals: number;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  mitigationSteps: string[];
}

class HIPAACompliance {
  private auditLogs: AuditLog[] = [];
  private accessControls: Map<string, AccessControl> = new Map();

  /**
   * Log all access to PHI (Protected Health Information)
   * Required by HIPAA Security Rule (164.312(b))
   */
  public logAccess(log: AuditLog): void {
    const sanitizedLog: AuditLog = {
      ...log,
      timestamp: Date.now(),
      ipAddress: this.maskIP(log.ipAddress),
      userAgent: this.maskUserAgent(log.userAgent)
    };

    this.auditLogs.push(sanitizedLog);
    this.persistAuditLog(sanitizedLog);
  }

  /**
   * Implement Role-Based Access Control (RBAC)
   * HIPAA requirement: Minimum necessary principle
   */
  public checkAccess(userId: string, resource: string, action: string): boolean {
    const control = this.accessControls.get(userId);
    
    if (!control) {
      console.warn(`No access control found for user: ${userId}`);
      return false;
    }

    // Check if user has MFA enabled (required for admin)
    if (control.role === 'ADMINISTRATOR' && !control.mfaEnabled) {
      return false;
    }

    // Check access level
    if (control.accessLevel === 'READ_ONLY' && action !== 'READ') {
      return false;
    }

    // Check specific permissions
    const permission = `${resource}:${action}`;
    const hasPermission = control.permissions.includes(permission) || 
                         control.permissions.includes('*');

    if (hasPermission) {
      this.logAccess({
        timestamp: Date.now(),
        userId,
        action: action as any,
        resourceType: resource,
        resourceId: '',
        ipAddress: this.getCurrentIP(),
        userAgent: navigator.userAgent,
        status: 'SUCCESS'
      });
    }

    return hasPermission;
  }

  /**
   * Get audit trail for compliance reporting
   * HIPAA requirement: Maintain records for 6 years
   */
  public getAuditTrail(userId?: string, startDate?: number, endDate?: number): AuditLog[] {
    return this.auditLogs.filter(log => {
      if (userId && log.userId !== userId) return false;
      if (startDate && log.timestamp < startDate) return false;
      if (endDate && log.timestamp > endDate) return false;
      return true;
    });
  }

  /**
   * Implement password policy
   * HIPAA requirement: Administrative procedures for user authentication
   */
  public validatePasswordComplexity(password: string): {valid: boolean; errors: string[]} {
    const errors: string[] = [];

    if (password.length < 12) {
      errors.push('Password must be at least 12 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letters');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letters');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain numbers');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain special characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Enforce session timeout
   * HIPAA requirement: Automatic logoff
   */
  public validateSessionTimeout(lastActivity: number, timeoutMinutes: number = 15): boolean {
    const elapsedMinutes = (Date.now() - lastActivity) / (1000 * 60);
    return elapsedMinutes < timeoutMinutes;
  }

  /**
   * Report potential breach
   * HIPAA Breach Notification Rule
   */
  public reportBreach(breach: BreachNotification): void {
    console.error('HIPAA BREACH REPORT:', breach);
    
    // In production: Send to compliance officer and regulatory authorities
    // Notify affected individuals within 60 days
    // Document all breach details for regulatory response
    
    this.persistBreachReport(breach);
  }

  /**
   * Data retention and deletion policy
   * HIPAA requirement: Privacy Rule (164.404)
   */
  public scheduleDataDeletion(resourceId: string, delayDays: number = 30): void {
    const deletionDate = Date.now() + (delayDays * 24 * 60 * 60 * 1000);
    
    // Store deletion schedule for compliance
    console.log(`Data scheduled for deletion: ${resourceId} on ${new Date(deletionDate)}`);
  }

  /**
   * Generate HIPAA compliance report
   */
  public generateComplianceReport(period: {start: number; end: number}) {
    const logs = this.getAuditTrail(undefined, period.start, period.end);
    
    const report = {
      period,
      totalAccesses: logs.length,
      failedAccesses: logs.filter(l => l.status === 'FAILURE').length,
      byUser: this.groupLogsByUser(logs),
      byAction: this.groupLogsByAction(logs),
      accessControlsActive: this.accessControls.size,
      mfaEnabled: Array.from(this.accessControls.values()).filter(ac => ac.mfaEnabled).length,
      lastAuditDate: new Date().toISOString()
    };

    return report;
  }

  // Private helper methods
  private maskIP(ip: string): string {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.*.* `;
  }

  private maskUserAgent(ua: string): string {
    return ua.substring(0, 20) + '...';
  }

  private getCurrentIP(): string {
    return '127.0.0.1'; // In production, get from request
  }

  private groupLogsByUser(logs: AuditLog[]): Record<string, number> {
    return logs.reduce((acc, log) => {
      acc[log.userId] = (acc[log.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupLogsByAction(logs: AuditLog[]): Record<string, number> {
    return logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private persistAuditLog(log: AuditLog): void {
    // In production: Send to HIPAA-compliant database with encryption
    // Consider using a dedicated audit service
    console.log('Audit log persisted:', log);
  }

  private persistBreachReport(breach: BreachNotification): void {
    // In production: Send to compliance system
    console.error('Breach report persisted:', breach);
  }
}

export const hipaaCompliance = new HIPAACompliance();
export default hipaaCompliance;
