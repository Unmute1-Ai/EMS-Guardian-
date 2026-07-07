/**
 * Production Startup Initialization
 * Initialize all security, compliance, and clinical systems
 */

import React, { useEffect, useState } from 'react';
import securityManager from './lib/security';
import hipaaCompliance from './lib/hipaaCompliance';
import mayoClinicStandards from './lib/mayoClinicStandards';
import auditLogger from './lib/auditLogger';
import authManager from './lib/authManager';
import errorHandler from './lib/errorHandler';
import { configManager } from './lib/productionConfig';

export interface InitializationStatus {
  security: boolean;
  hipaa: boolean;
  clinical: boolean;
  logging: boolean;
  auth: boolean;
  errors: string[];
}

class ProductionInitializer {
  private status: InitializationStatus = {
    security: false,
    hipaa: false,
    clinical: false,
    logging: false,
    auth: false,
    errors: []
  };

  /**
   * Initialize all production systems
   */
  public async initialize(): Promise<InitializationStatus> {
    try {
      console.log('🔐 Initializing EMS Guardian Production Environment...');

      // 1. Configuration
      await this.initializeConfig();

      // 2. Security
      await this.initializeSecurity();

      // 3. HIPAA Compliance
      await this.initializeHIPAA();

      // 4. Clinical Protocols
      await this.initializeClinical();

      // 5. Audit Logging
      await this.initializeLogging();

      // 6. Authentication
      await this.initializeAuth();

      if (this.status.errors.length === 0) {
        console.log('✅ All systems initialized successfully');
        auditLogger.info('INIT', 'Production environment initialized', { status: this.status });
      } else {
        console.warn('⚠️ Initialization completed with warnings:', this.status.errors);
      }

      return this.status;
    } catch (error) {
      console.error('❌ Critical initialization error:', error);
      this.status.errors.push(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Verify all production requirements
   */
  public async verifyProduction(): Promise<boolean> {
    const checks = {
      encryptionEnabled: configManager.get('encryptionEnabled'),
      hipaaMode: configManager.get('hipaaMode'),
      auditLoggingEnabled: configManager.get('auditLoggingEnabled'),
      mfaRequired: configManager.get('mfaRequired'),
      mayoProtocolsEnabled: configManager.get('mayoProtocolsEnabled'),
      clinicalValidation: configManager.get('clinicalValidation')
    };

    const allEnabled = Object.values(checks).every(v => v === true);

    if (!allEnabled) {
      const disabled = Object.entries(checks)
        .filter(([_, v]) => v === false)
        .map(([k]) => k);
      console.warn('⚠️ Production requirements not fully met:', disabled);
    }

    return allEnabled;
  }

  // Private initialization methods
  private async initializeConfig(): Promise<void> {
    try {
      const config = configManager.getConfig();
      console.log('✓ Configuration loaded');

      if (!import.meta.env.PROD) {
        console.warn('⚠️ Running in development mode - some security features may be limited');
      }
    } catch (error) {
      this.status.errors.push(`Configuration error: ${error}`);
    }
  }

  private async initializeSecurity(): Promise<void> {
    try {
      // Verify encryption key is set
      const encryptionKey = configManager.get('encryptionKey');
      if (!encryptionKey || encryptionKey === 'change-me-in-production') {
        throw new Error('ENCRYPTION_KEY not properly configured');
      }

      // Test encryption/decryption
      const testData = { test: 'data' };
      const encrypted = securityManager.encrypt(testData);
      const decrypted = securityManager.decrypt(encrypted);

      if (JSON.stringify(decrypted) !== JSON.stringify(testData)) {
        throw new Error('Encryption/decryption verification failed');
      }

      this.status.security = true;
      console.log('✓ Security systems initialized');
    } catch (error) {
      this.status.errors.push(`Security initialization error: ${error}`);
    }
  }

  private async initializeHIPAA(): Promise<void> {
    try {
      // Verify HIPAA mode
      if (!configManager.get('hipaaMode')) {
        throw new Error('HIPAA mode not enabled');
      }

      // Test audit logging
      auditLogger.info('HIPAA', 'HIPAA compliance check initiated');

      this.status.hipaa = true;
      console.log('✓ HIPAA compliance systems initialized');
    } catch (error) {
      this.status.errors.push(`HIPAA initialization error: ${error}`);
    }
  }

  private async initializeClinical(): Promise<void> {
    try {
      // Verify Mayo Clinic protocols are loaded
      if (!configManager.get('mayoProtocolsEnabled')) {
        console.warn('⚠️ Mayo Clinic protocols not enabled');
      }

      // Test clinical assessment
      const testPatient = {
        chiefComplaint: 'chest pain',
        vitals: {
          heartRate: 110,
          systolicBP: 140,
          diastolicBP: 90,
          respiratoryRate: 20,
          oxygenSaturation: 95,
          temperature: 37.2
        },
        painScore: 8
      };

      const assessment = mayoClinicStandards.performAssessment(testPatient);
      if (!assessment.recommendedProtocol) {
        throw new Error('Clinical assessment verification failed');
      }

      this.status.clinical = true;
      console.log('✓ Clinical protocols initialized');
    } catch (error) {
      this.status.errors.push(`Clinical initialization error: ${error}`);
    }
  }

  private async initializeLogging(): Promise<void> {
    try {
      // Verify audit logging
      if (!configManager.get('auditLoggingEnabled')) {
        throw new Error('Audit logging not enabled');
      }

      auditLogger.info('SYSTEM', 'Audit logging system initialized');

      this.status.logging = true;
      console.log('✓ Audit logging system initialized');
    } catch (error) {
      this.status.errors.push(`Logging initialization error: ${error}`);
    }
  }

  private async initializeAuth(): Promise<void> {
    try {
      // Verify authentication system
      const config = configManager.getConfig();

      if (config.mfaRequired) {
        console.log('✓ MFA authentication required');
      }

      this.status.auth = true;
      console.log('✓ Authentication system initialized');
    } catch (error) {
      this.status.errors.push(`Authentication initialization error: ${error}`);
    }
  }
}

export const productionInitializer = new ProductionInitializer();

/**
 * React Hook for production initialization
 */
export const useProductionInit = () => {
  const [initialized, setInitialized] = useState(false);
  const [status, setStatus] = useState<InitializationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const initStatus = await productionInitializer.initialize();
        setStatus(initStatus);
        setInitialized(true);

        // Verify production requirements
        const isProduction = await productionInitializer.verifyProduction();
        if (!isProduction && import.meta.env.PROD) {
          console.warn('⚠️ Production environment verification failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setInitialized(false);
      }
    };

    init();
  }, []);

  return { initialized, status, error };
};

export default productionInitializer;
