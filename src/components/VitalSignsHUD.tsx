/**
 * Vital Signs Display HUD Component
 */
import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { Heart, Droplets, Wind } from 'lucide-react';

export interface VitalSigns {
  heartRate: number;
  spo2: number;
  respirationRate: number;
  bloodPressure: { systolic: number; diastolic: number };
  temperature: number;
  lastUpdated: Date;
}

interface VitalSignsHUDProps {
  vitals: VitalSigns | null;
  loading?: boolean;
  className?: string;
}

export function VitalSignsHUD({ vitals, loading, className }: VitalSignsHUDProps) {
  const [isAbnormal, setIsAbnormal] = useState(false);

  useEffect(() => {
    if (!vitals) return;

    // Check for abnormal vitals
    const abnormal =
      vitals.heartRate < 50 ||
      vitals.heartRate > 120 ||
      vitals.spo2 < 94 ||
      vitals.respirationRate < 12 ||
      vitals.respirationRate > 24 ||
      vitals.bloodPressure.systolic < 90 ||
      vitals.bloodPressure.systolic > 180;

    setIsAbnormal(abnormal);
  }, [vitals]);

  const getVitalColor = (value: number, min: number, max: number) => {
    if (value < min || value > max) return 'text-cad-red';
    if (value < min + 10 || value > max - 10) return 'text-cad-amber';
    return 'text-cad-green';
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-3 bg-black/40 border border-cad-border',
        isAbnormal ? 'border-cad-red/50 ring-1 ring-cad-red/30' : '',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-cad-muted">
          VITAL SIGNS HUD
        </span>
        {loading && <span className="text-[8px] text-cad-cyan animate-pulse">UPDATING...</span>}
      </div>

      {vitals ? (
        <div className="grid grid-cols-2 gap-2">
          {/* Heart Rate */}
          <div className="flex items-center gap-2 p-2 bg-cad-surface border border-cad-border/50">
            <Heart
              className={cn('w-3 h-3', getVitalColor(vitals.heartRate, 60, 100))}
            />
            <div>
              <div className="text-[9px] text-cad-muted uppercase">HR</div>
              <div
                className={cn('text-[11px] font-bold', getVitalColor(vitals.heartRate, 60, 100))}
              >
                {vitals.heartRate} BPM
              </div>
            </div>
          </div>

          {/* SpO2 */}
          <div className="flex items-center gap-2 p-2 bg-cad-surface border border-cad-border/50">
            <Droplets
              className={cn('w-3 h-3', getVitalColor(vitals.spo2, 95, 100))}
            />
            <div>
              <div className="text-[9px] text-cad-muted uppercase">SPO2</div>
              <div
                className={cn('text-[11px] font-bold', getVitalColor(vitals.spo2, 95, 100))}
              >
                {vitals.spo2}%
              </div>
            </div>
          </div>

          {/* Respiration Rate */}
          <div className="flex items-center gap-2 p-2 bg-cad-surface border border-cad-border/50">
            <Wind
              className={cn('w-3 h-3', getVitalColor(vitals.respirationRate, 12, 20))}
            />
            <div>
              <div className="text-[9px] text-cad-muted uppercase">RR</div>
              <div
                className={cn('text-[11px] font-bold', getVitalColor(vitals.respirationRate, 12, 20))}
              >
                {vitals.respirationRate} /min
              </div>
            </div>
          </div>

          {/* Blood Pressure */}
          <div className="flex items-center gap-2 p-2 bg-cad-surface border border-cad-border/50">
            <Heart className={cn('w-3 h-3', getVitalColor(vitals.bloodPressure.systolic, 90, 140))} />
            <div>
              <div className="text-[9px] text-cad-muted uppercase">BP</div>
              <div className={cn('text-[11px] font-bold', getVitalColor(vitals.bloodPressure.systolic, 90, 140))}>
                {vitals.bloodPressure.systolic}/{vitals.bloodPressure.diastolic}
              </div>
            </div>
          </div>

          {/* Temperature */}
          <div className="col-span-2 flex items-center gap-2 p-2 bg-cad-surface border border-cad-border/50">
            <span className="text-[9px] text-cad-muted uppercase">TEMP</span>
            <span className={cn('text-[11px] font-bold', getVitalColor(vitals.temperature, 36.5, 37.5))}>
              {vitals.temperature.toFixed(1)}°C
            </span>
          </div>
        </div>
      ) : (
        <div className="h-24 flex items-center justify-center text-cad-muted text-[9px] uppercase opacity-50">
          NO VITAL DATA
        </div>
      )}

      {vitals && (
        <div className="text-[8px] text-cad-muted mt-2 border-t border-cad-border/30 pt-2">
          Last: {vitals.lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

/**
 * Simulate vital signs for demo/training purposes
 */
export function useSimulatedVitals(): VitalSigns {
  const [vitals, setVitals] = useState<VitalSigns>({
    heartRate: 72 + Math.random() * 20 - 10,
    spo2: 98 + Math.random() * 2 - 1,
    respirationRate: 16 + Math.random() * 4 - 2,
    bloodPressure: {
      systolic: 120 + Math.random() * 20 - 10,
      diastolic: 80 + Math.random() * 10 - 5
    },
    temperature: 37 + Math.random() * 0.4 - 0.2,
    lastUpdated: new Date()
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setVitals(prev => ({
        heartRate: Math.max(40, Math.min(180, prev.heartRate + (Math.random() - 0.5) * 5)),
        spo2: Math.max(90, Math.min(100, prev.spo2 + (Math.random() - 0.5) * 1)),
        respirationRate: Math.max(8, Math.min(40, prev.respirationRate + (Math.random() - 0.5) * 2)),
        bloodPressure: {
          systolic: Math.max(60, Math.min(200, prev.bloodPressure.systolic + (Math.random() - 0.5) * 4)),
          diastolic: Math.max(40, Math.min(130, prev.bloodPressure.diastolic + (Math.random() - 0.5) * 3))
        },
        temperature: Math.max(35, Math.min(40, prev.temperature + (Math.random() - 0.5) * 0.2)),
        lastUpdated: new Date()
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return vitals;
}
