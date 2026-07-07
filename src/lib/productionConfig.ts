/**
 * Production Configuration
 * HIPAA-compliant configuration management
 */

export interface ProductionConfig {
  // Security
  encryptionEnabled: boolean;
  encryptionKey: string;
  tokenSecret: string;
  sessionTimeout: number;
  
  // HIPAA
  hipaaMode: boolean;
  auditLoggingEnabled: boolean;
  mfaRequired: boolean;
  dataRetentionDays: number;
  
  // API
  apiUrl: string;
  apiTimeout: number;
  retryAttempts: number;
  
  // Mayo Clinic
  mayoProtocolsEnabled: boolean;
  clinicalValidation: boolean;
  
  // UI
  darkModeDefault: boolean;
  highContrastMode: boolean;
  animationsEnabled: boolean;
  
  // Monitoring
  errorTrackingEnabled: boolean;
  performanceMonitoringEnabled: boolean;
  loggingLevel: 'debug' | 'info' | 'warn' | 'error';
}

const defaultConfig: ProductionConfig = {
  // Security
  encryptionEnabled: true,
  encryptionKey: process.env.ENCRYPTION_KEY || 'change-me-in-production',
  tokenSecret: process.env.TOKEN_SECRET || 'change-me-in-production',
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  
  // HIPAA
  hipaaMode: true,
  auditLoggingEnabled: true,
  mfaRequired: true,
  dataRetentionDays: 2555, // 7 years per HIPAA requirement
  
  // API
  apiUrl: process.env.API_URL || 'https://api.ems-guardian.medical',
  apiTimeout: 30000,
  retryAttempts: 3,
  
  // Mayo Clinic
  mayoProtocolsEnabled: true,
  clinicalValidation: true,
  
  // UI
  darkModeDefault: true,
  highContrastMode: false,
  animationsEnabled: true,
  
  // Monitoring
  errorTrackingEnabled: true,
  performanceMonitoringEnabled: true,
  loggingLevel: import.meta.env.DEV ? 'debug' : 'warn'
};

class ConfigManager {
  private config: ProductionConfig;

  constructor() {
    this.config = this.mergeWithEnv(defaultConfig);
    this.validateConfig();
  }

  public getConfig(): ProductionConfig {
    return { ...this.config };
  }

  public get<K extends keyof ProductionConfig>(key: K): ProductionConfig[K] {
    return this.config[key];
  }

  public set<K extends keyof ProductionConfig>(key: K, value: ProductionConfig[K]): void {
    if (key === 'encryptionKey' || key === 'tokenSecret') {
      console.warn(`Attempting to modify sensitive configuration: ${key}`);
    }
    this.config[key] = value;
  }

  private mergeWithEnv(defaults: ProductionConfig): ProductionConfig {
    return {
      ...defaults,
      encryptionEnabled: process.env.ENCRYPTION_ENABLED !== 'false',
      hipaaMode: process.env.HIPAA_MODE !== 'false',
      auditLoggingEnabled: process.env.AUDIT_LOGGING !== 'false',
      mfaRequired: process.env.MFA_REQUIRED !== 'false',
      mayoProtocolsEnabled: process.env.MAYO_PROTOCOLS !== 'false',
      errorTrackingEnabled: process.env.ERROR_TRACKING !== 'false',
      performanceMonitoringEnabled: process.env.PERF_MONITORING !== 'false'
    };
  }

  private validateConfig(): void {
    if (this.config.hipaaMode && !this.config.encryptionEnabled) {
      throw new Error('HIPAA mode requires encryption to be enabled');
    }

    if (this.config.mfaRequired && !this.config.hipaaMode) {
      console.warn('MFA required but HIPAA mode is disabled');
    }

    if (import.meta.env.PROD) {
      if (this.config.encryptionKey === 'change-me-in-production') {
        throw new Error('ENCRYPTION_KEY must be changed for production');
      }
      if (this.config.tokenSecret === 'change-me-in-production') {
        throw new Error('TOKEN_SECRET must be changed for production');
      }
    }
  }
}

export const configManager = new ConfigManager();
export const config = configManager.getConfig();
export default configManager;
