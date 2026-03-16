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
    if (!accuracy) return 'bg-white/20';
    if (accuracy < 10) return 'bg-emerald-500';
    if (accuracy < 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getAccuracyLabel = (accuracy: number | null) => {
    if (!accuracy) return 'NO SIGNAL';
    if (accuracy < 10) return 'EXCELLENT';
    if (accuracy < 50) return 'GOOD';
    return 'POOR';
  };

  return (
    <div className={cn("relative w-full h-full bg-[#0D0D0D] rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col", className)}>
      {/* Tactical Map Background (Placeholder) */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }} />
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(16,185,129,0.1)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Map Content */}
      <div className="relative flex-1 flex items-center justify-center">
        {(!location || location.lat === 0) ? (
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin" />
            <p className="text-sm font-mono uppercase tracking-[0.3em] text-white/40">Acquiring Satellite Link...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
          {/* Pulsing Location Marker */}
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping scale-[3]" />
            <div className="absolute inset-0 bg-emerald-500/40 rounded-full animate-pulse scale-[2]" />
            <div className="relative z-10 w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] border-2 border-white/20">
              <Navigation className="w-6 h-6 text-white rotate-45" />
            </div>
          </div>

          {/* Destination Marker */}
          <div className="absolute top-[-150px] left-[100px]">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 bg-rose-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(225,29,72,0.4)] border-2 border-white/20">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div className="bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1 rounded text-[10px] font-mono whitespace-nowrap">
                SCENE: 1242 OAK ST
              </div>
            </div>
          </div>

          {/* Path Line (SVG) */}
          <svg className="absolute top-[-150px] left-[100px] w-[200px] h-[200px] pointer-events-none overflow-visible">
             <motion.path 
               d="M 0 0 L -100 150" 
               fill="none" 
               stroke="rgba(16,185,129,0.5)" 
               strokeWidth="2" 
               strokeDasharray="8 8"
               initial={{ pathLength: 0 }}
               animate={{ pathLength: 1 }}
               transition={{ duration: 2, repeat: Infinity }}
             />
          </svg>
        </motion.div>
      </div>

      {/* Map HUD */}
      <div className="absolute top-6 left-6 flex flex-col gap-4">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <Compass className="w-4 h-4 text-emerald-500 animate-spin-slow" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Navigation Status</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between gap-8">
              <span className="text-[10px] font-mono text-white/30">ETA</span>
              <span className="text-xs font-mono text-emerald-500">02:45 MIN</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-[10px] font-mono text-white/30">DISTANCE</span>
              <span className="text-xs font-mono text-emerald-500">1.2 MI</span>
            </div>
          </div>
        </div>

        <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <Wind className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">En Route Data</span>
          </div>
          <div className="text-xs font-mono">
            {location?.crossStreets || 'CALCULATING...'}
          </div>
        </div>
      </div>

      {/* Arrival Control */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <button 
          onClick={onArrive}
          className="group relative flex items-center gap-4 px-10 py-5 bg-emerald-600 rounded-full font-black text-sm uppercase tracking-[0.2em] shadow-[0_0_50px_rgba(16,185,129,0.3)] hover:bg-emerald-500 transition-all active:scale-95"
        >
          <div className="absolute inset-0 rounded-full border-2 border-white/20 group-hover:scale-110 transition-transform" />
          <MapIcon className="w-5 h-5" />
          <span>Arrived at Scene</span>
        </button>
      </div>

      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 px-2 py-1 bg-black/40 rounded border border-white/5">
          <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">GPS: {getAccuracyLabel(location?.accuracy || null)}</span>
          <div className={cn("w-1 h-1 rounded-full", getAccuracyColor(location?.accuracy || null))} />
        </div>
        <div className="text-[10px] font-mono text-white/20 uppercase tracking-widest">
          Tactical Map Overlay // Unit 01-A
        </div>
      </div>
    </div>
  );
}
