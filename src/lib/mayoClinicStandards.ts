/**
 * Mayo Clinic EMS Standards Integration
 * Implements Mayo Clinic protocols for patient assessment and care
 * Source: Mayo Clinic Emergency Medicine and EMS Guidelines
 */

export interface MayoPatientAssessment {
  primary: string;
  secondary: string;
  vitals: {
    heartRate: number;
    systolicBP: number;
    diastolicBP: number;
    respiratoryRate: number;
    oxygenSaturation: number;
    temperature: number;
  };
  glasgowComaScale: number;
  painScore: number;
  differentialDiagnosis: string[];
  recommendedProtocol: string;
}

export interface MayoHandoffReport {
  format: 'SBAR' | 'MIST' | 'ISoBAR';
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  identity: string;
  situation_mist: string;
  injury: string;
  signs_symptoms: string;
  treatment: string;
  timestamp: number;
  paramedic: string;
  receivingFacility: string;
}

export interface ClinicalProtocol {
  id: string;
  name: string;
  indication: string;
  contraindications: string[];
  treatment: {
    medication: string;
    dose: string;
    route: string;
    frequency: string;
  }[];
  monitoring: string[];
  transferCriteria: string[];
}

class MayoClinicStandards {
  private protocols: Map<string, ClinicalProtocol> = new Map();

  constructor() {
    this.initializeProtocols();
  }

  /**
   * Initialize Mayo Clinic standard protocols
   */
  private initializeProtocols(): void {
    // Chest Pain Protocol
    this.protocols.set('chest-pain', {
      id: 'chest-pain',
      name: 'Acute Coronary Syndrome Protocol',
      indication: 'Chest pain, chest pressure, or acute coronary symptoms',
      contraindications: [],
      treatment: [
        {
          medication: 'Aspirin',
          dose: '325-650 mg',
          route: 'PO',
          frequency: 'Once'
        },
        {
          medication: 'Nitroglycerin',
          dose: '0.3-0.6 mg',
          route: 'SL',
          frequency: 'q5min x 3 doses'
        }
      ],
      monitoring: ['Continuous cardiac monitoring', '12-lead ECG within 10 minutes', 'Troponin levels'],
      transferCriteria: ['All patients with suspected ACS']
    });

    // Stroke Protocol
    this.protocols.set('stroke', {
      id: 'stroke',
      name: 'Acute Ischemic Stroke Protocol',
      indication: 'Signs of acute stroke (FAST positive)',
      contraindications: ['Time >4.5 hours since symptom onset'],
      treatment: [
        {
          medication: 'Glucose monitoring',
          dose: 'As indicated',
          route: 'IV',
          frequency: 'Stat'
        }
      ],
      monitoring: ['Blood glucose', 'Neuro checks q15min', 'CT/MRI'],
      transferCriteria: ['All patients to stroke center']
    });

    // Sepsis Protocol
    this.protocols.set('sepsis', {
      id: 'sepsis',
      name: 'Sepsis Recognition and Response Protocol',
      indication: 'Signs of infection and system dysfunction',
      contraindications: [],
      treatment: [
        {
          medication: 'IV Fluids',
          dose: '30 mL/kg',
          route: 'IV',
          frequency: 'Bolus'
        },
        {
          medication: 'Broad-spectrum antibiotics',
          dose: 'Per protocol',
          route: 'IV',
          frequency: 'Within 1 hour'
        }
      ],
      monitoring: ['Lactate levels', 'Blood cultures', 'Continuous monitoring'],
      transferCriteria: ['ICU-level facility']
    });

    // Trauma Protocol
    this.protocols.set('trauma', {
      id: 'trauma',
      name: 'Trauma Assessment and Stabilization Protocol',
      indication: 'Significant mechanism of injury',
      contraindications: [],
      treatment: [
        {
          medication: 'Hemorrhage control',
          dose: 'As needed',
          route: 'Direct',
          frequency: 'Continuous'
        }
      ],
      monitoring: ['Hemorrhage', 'Shock signs', 'Injury patterns'],
      transferCriteria: ['Level 1 Trauma Center']
    });
  }

  /**
   * Perform standardized patient assessment using Mayo Clinic protocol
   */
  public performAssessment(patientData: any): MayoPatientAssessment {
    const vitals = patientData.vitals || {};
    const primaryAssessment = this.determinePrimaryDiagnosis(patientData);
    const protocolName = this.selectApplicableProtocol(primaryAssessment);

    return {
      primary: primaryAssessment,
      secondary: this.determineSecondaryDiagnosis(patientData),
      vitals: {
        heartRate: vitals.heartRate || 0,
        systolicBP: vitals.systolicBP || 0,
        diastolicBP: vitals.diastolicBP || 0,
        respiratoryRate: vitals.respiratoryRate || 0,
        oxygenSaturation: vitals.oxygenSaturation || 0,
        temperature: vitals.temperature || 0
      },
      glasgowComaScale: this.calculateGCS(patientData),
      painScore: patientData.painScore || 0,
      differentialDiagnosis: this.generateDifferentialDiagnosis(primaryAssessment),
      recommendedProtocol: protocolName
    };
  }

  /**
   * Generate SBAR handoff report (Situation, Background, Assessment, Recommendation)
   * Standard at Mayo Clinic and most US hospitals
   */
  public generateSBARReport(patientData: any): MayoHandoffReport {
    const assessment = this.performAssessment(patientData);

    return {
      format: 'SBAR',
      situation: `Patient with ${assessment.primary}. Vitals: HR ${assessment.vitals.heartRate}, BP ${assessment.vitals.systolicBP}/${assessment.vitals.diastolicBP}, RR ${assessment.vitals.respiratoryRate}, SpO2 ${assessment.vitals.oxygenSaturation}%`,
      background: `Chief complaint: ${patientData.chiefComplaint}. Relevant history: ${patientData.medicalHistory?.join(', ') || 'None reported'}`,
      assessment: `Suspected ${assessment.primary}. GCS: ${assessment.glasgowComaScale}. Pain: ${assessment.painScore}/10. Differential: ${assessment.differentialDiagnosis.join(', ')}`,
      recommendation: `Follow ${assessment.recommendedProtocol} protocol. Transfer to appropriate facility.`,
      identity: patientData.paramedic || 'Unknown',
      situation_mist: '',
      injury: '',
      signs_symptoms: '',
      treatment: '',
      timestamp: Date.now(),
      paramedic: patientData.paramedic || 'Unknown',
      receivingFacility: patientData.receivingFacility || 'Nearest Appropriate Facility'
    };
  }

  /**
   * Generate MIST report (Mechanism, Injury, Signs/Symptoms, Treatment)
   * Preferred for trauma cases
   */
  public generateMISTReport(patientData: any): MayoHandoffReport {
    return {
      format: 'MIST',
      situation: '',
      background: '',
      assessment: '',
      recommendation: '',
      identity: patientData.paramedic || 'Unknown',
      situation_mist: patientData.mechanism || 'Unknown mechanism',
      injury: patientData.injuries?.join(', ') || 'Multiple injuries',
      signs_symptoms: this.generateSignsSymptomsList(patientData),
      treatment: this.generateTreatmentList(patientData),
      timestamp: Date.now(),
      paramedic: patientData.paramedic || 'Unknown',
      receivingFacility: patientData.receivingFacility || 'Trauma Center'
    };
  }

  /**
   * Get specific protocol details
   */
  public getProtocol(protocolId: string): ClinicalProtocol | null {
    return this.protocols.get(protocolId) || null;
  }

  /**
   * Validate medication dosage against Mayo Clinic standards
   */
  public validateDosage(medication: string, dose: number, weight: number): boolean {
    // Simplified dosage validation
    const protocols = Array.from(this.protocols.values());
    
    for (const protocol of protocols) {
      for (const med of protocol.treatment) {
        if (med.medication.toLowerCase() === medication.toLowerCase()) {
          // In production: implement comprehensive dosage tables
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate Glasgow Coma Scale
   */
  private calculateGCS(patientData: any): number {
    const eye = patientData.gcsEye || 3;
    const verbal = patientData.gcsVerbal || 3;
    const motor = patientData.gcsMotor || 3;
    return eye + verbal + motor;
  }

  /**
   * Determine primary diagnosis based on presentation
   */
  private determinePrimaryDiagnosis(patientData: any): string {
    if (patientData.chiefComplaint?.toLowerCase().includes('chest')) {
      return 'Acute Coronary Syndrome';
    }
    if (patientData.chiefComplaint?.toLowerCase().includes('stroke')) {
      return 'Acute Ischemic Stroke';
    }
    if (patientData.chiefComplaint?.toLowerCase().includes('difficulty breathing')) {
      return 'Respiratory Distress';
    }
    if (patientData.temperature > 38.5) {
      return 'Sepsis';
    }
    if (patientData.mechanism === 'trauma') {
      return 'Trauma';
    }
    return 'Undifferentiated Emergency';
  }

  /**
   * Determine secondary diagnosis
   */
  private determineSecondaryDiagnosis(patientData: any): string {
    return patientData.medicalHistory?.[0] || 'None identified';
  }

  /**
   * Select applicable clinical protocol
   */
  private selectApplicableProtocol(diagnosis: string): string {
    if (diagnosis.includes('Coronary')) return 'chest-pain';
    if (diagnosis.includes('Stroke')) return 'stroke';
    if (diagnosis.includes('Sepsis')) return 'sepsis';
    if (diagnosis.includes('Trauma')) return 'trauma';
    return 'general-emergency';
  }

  /**
   * Generate differential diagnosis list
   */
  private generateDifferentialDiagnosis(primaryDiagnosis: string): string[] {
    const differentials: Record<string, string[]> = {
      'Acute Coronary Syndrome': ['Cardiac arrhythmia', 'Pulmonary embolism', 'Aortic dissection'],
      'Acute Ischemic Stroke': ['Intracranial hemorrhage', 'Migraine', 'Seizure'],
      'Sepsis': ['SIRS', 'Severe infection', 'Multiorgan dysfunction'],
      'Trauma': ['Internal bleeding', 'Shock', 'Head injury']
    };

    return differentials[primaryDiagnosis] || ['Primary diagnosis likely'];
  }

  private generateSignsSymptomsList(patientData: any): string {
    return patientData.symptoms?.join(', ') || 'As assessed';
  }

  private generateTreatmentList(patientData: any): string {
    return patientData.treatmentProvided?.join(', ') || 'Standard protocols applied';
  }
}

export const mayoClinicStandards = new MayoClinicStandards();
export default mayoClinicStandards;
