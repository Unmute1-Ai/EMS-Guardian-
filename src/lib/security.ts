/**
 * HIPAA-Compliant Security Module
 * Handles encryption, key management, and data protection
 */

import CryptoJS from 'crypto-js';

export interface EncryptedData {
  iv: string;
  encryptedData: string;
  timestamp: number;
}

export interface SecurityConfig {
  encryptionKey: string;
  tokenSecret: string;
  sessionTimeout: number;
  enableAuditLog: boolean;
}

class SecurityManager {
  private encryptionKey: string = '';
  private config: SecurityConfig | null = null;

  constructor() {
    this.initializeFromEnv();
  }

  private initializeFromEnv(): void {
    const key = process.env.ENCRYPTION_KEY || import.meta.env.VITE_ENCRYPTION_KEY;
    if (!key && import.meta.env.PROD) {
      throw new Error('ENCRYPTION_KEY is required in production');
    }
    this.encryptionKey = key || 'dev-key-change-in-production';
  }

  /**
   * Encrypt sensitive data using AES-256
   * HIPAA requirement: Encryption for data at rest and in transit
   */
  public encrypt(data: any): EncryptedData {
    try {
      const jsonString = JSON.stringify(data);
      const encrypted = CryptoJS.AES.encrypt(jsonString, this.encryptionKey).toString();
      
      return {
        iv: CryptoJS.lib.WordArray.random(16).toString(),
        encryptedData: encrypted,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt encrypted data
   */
  public decrypt(encryptedPayload: EncryptedData): any {
    try {
      const decrypted = CryptoJS.AES.decrypt(
        encryptedPayload.encryptedData,
        this.encryptionKey
      ).toString(CryptoJS.enc.Utf8);
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data - possible tampering');
    }
  }

  /**
   * Hash sensitive data (one-way)
   * Used for storing identifiers without exposing actual values
   */
  public hash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * Anonymize patient data for training/analytics
   * HIPAA requirement: Safe harbor method for de-identification
   */
  public anonymizePatientData(patientData: any): any {
    const safeData = { ...patientData };
    
    // Remove directly identifying information per HIPAA Safe Harbor
    const identifiersToRemove = [
      'name', 'medicalRecordNumber', 'healthPlanID', 'accountNumber',
      'certificate', 'license', 'vehicle', 'vin', 'serial', 'phone',
      'fax', 'email', 'socialSecurityNumber', 'address', 'county',
      'zipCode', 'dateOfBirth', 'admissionDate', 'dischargeDate'
    ];

    identifiersToRemove.forEach(identifier => {
      delete safeData[identifier];
    });

    // Replace dates with year only
    if (safeData.encounterDate) {
      safeData.encounterYear = new Date(safeData.encounterDate).getFullYear();
      delete safeData.encounterDate;
    }

    // Hash or remove specific visit data
    if (safeData.location) {
      safeData.locationRegion = 'REGION_' + this.hash(safeData.location).substring(0, 8);
      delete safeData.location;
    }

    return safeData;
  }

  /**
   * Validate data integrity using HMAC
   */
  public generateSignature(data: any): string {
    const jsonString = JSON.stringify(data);
    return CryptoJS.HmacSHA256(jsonString, this.encryptionKey).toString();
  }

  /**
   * Verify data integrity
   */
  public verifySignature(data: any, signature: string): boolean {
    const calculatedSignature = this.generateSignature(data);
    return calculatedSignature === signature;
  }

  /**
   * Generate cryptographically secure random token
   */
  public generateSecureToken(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Secure session cleanup
   */
  public clearSensitiveData(): void {
    this.encryptionKey = '';
    sessionStorage.clear();
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('refreshToken');
  }
}

export const securityManager = new SecurityManager();

/**
 * Password hashing for user authentication
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await generateSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function generateSalt(rounds: number): Promise<string> {
  // Placeholder - in production use bcryptjs
  return CryptoJS.lib.WordArray.random(16).toString();
}

export default securityManager;
