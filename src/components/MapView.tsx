import React from 'react';
import { motion } from 'motion/react';
import { Navigation, MapPin, Compass, Wind, Map as MapIcon, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

interface MapViewProps {
  location: { lat: number; lng: number; crossStreets: string | null; accuracy: number | null } | null;
  className?: string;
  onArrive: () => void;
}

export function MapView({ location, className, onArrive }: MapViewProps) {
  const getAccuracyColor = (accuracy: number | null) => {
    if (!accuracy) return 'bg-cad-muted';
    if (accuracy < 10) return 'bg-cad-green';
    if (accuracy < 50) return 'bg-cad-amber';
    return 'bg-cad-red';
  };

  const getAccuracyLabel = (accuracy: number | null) => {
    if (!accuracy) return 'NO SIGNAL';
    if (accuracy < 10) return 'EXCELLENT';
    if (accuracy < 50) return 'GOOD';
    return 'POOR';
  };

  return (
    <div className={cn("relative w-full h-full bg-cad-bg rounded-none overflow-hidden border border-cad-border shadow-2xl flex flex-col font-mono", className)}>
      {/* Tactical Map Background (Placeholder) */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,255,0,0.1) 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }} />
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(0,255,0,0.15)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Map Content */}
      <div className="relative flex-1 flex items-center justify-center">
        {(!location || location.lat === 0) ? (
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="w-12 h-12 text-cad-green animate-spin" />
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-cad-green/40">ACQUIRING SAT LINK...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
          {/* Pulsing Location Marker */}
          <div className="relative">
            <div className="absolute inset-0 bg-cad-green/20 rounded-none animate-ping scale-[3]" />
            <div className="absolute inset-0 bg-cad-green/40 rounded-none animate-pulse scale-[2]" />
            <div className="relative z-10 w-10 h-10 bg-cad-green flex items-center justify-center border border-white/20">
              <Navigation className="w-5 h-5 text-black rotate-45" />
            </div>
          </div>

          {/* Destination Marker */}
          <div className="absolute top-[-150px] left-[100px]">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 bg-cad-red flex items-center justify-center border border-white/20">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div className="bg-cad-surface border border-cad-border px-2 py-0.5 text-[9px] font-mono whitespace-nowrap text-cad-red font-bold">
                SCENE: 1242 OAK ST
              </div>
            </div>
          </div>

          {/* Path Line (SVG) */}
          <svg className="absolute top-[-150px] left-[100px] w-[200px] h-[200px] pointer-events-none overflow-visible">
             <motion.path 
               d="M 0 0 L -100 150" 
               fill="none" 
               stroke="rgba(0,255,0,0.5)" 
               strokeWidth="2" 
               strokeDasharray="4 4"
               initial={{ pathLength: 0 }}
               animate={{ pathLength: 1 }}
               transition={{ duration: 2, repeat: Infinity }}
             />
          </svg>
        </motion.div>
      )}
    </div>

      {/* Map HUD */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="bg-cad-surface/80 backdrop-blur-sm border border-cad-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <Compass className="w-3 h-3 text-cad-amber animate-spin-slow" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">NAV STATUS</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between gap-6">
              <span className="text-[9px] text-cad-muted">ETA</span>
              <span className="text-[10px] text-cad-green">02:45 M</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-[9px] text-cad-muted">DIST</span>
              <span className="text-[10px] text-cad-green">1.2 MI</span>
            </div>
          </div>
        </div>

        <div className="bg-cad-surface/80 backdrop-blur-sm border border-cad-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <Wind className="w-3 h-3 text-cad-cyan" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">CAD DATA</span>
          </div>
          <div className="text-[9px] text-cad-cyan">
            {location?.crossStreets || 'CALC...'}
          </div>
        </div>
      </div>

      {/* Arrival Control */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <button 
          onClick={onArrive}
          className="group relative flex items-center gap-3 px-8 py-3 bg-cad-red text-white font-bold text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 border border-white/20"
        >
          <MapIcon className="w-4 h-4" />
          <span>10-97 (ARRIVED)</span>
        </button>
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 px-1.5 py-0.5 bg-black/60 border border-cad-border">
          <span className="text-[8px] text-cad-muted uppercase tracking-widest">GPS: {getAccuracyLabel(location?.accuracy || null)}</span>
          <div className={cn("w-1 h-1", getAccuracyColor(location?.accuracy || null))} />
        </div>
        <div className="text-[8px] text-cad-muted uppercase tracking-widest">
          TACTICAL OVERLAY // UNIT 01-A
        </div>
      </div>
    </div>
  );
}
