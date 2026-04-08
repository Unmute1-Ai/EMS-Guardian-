import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Languages, 
  RefreshCw, 
  Volume2, 
  Globe,
  MessageSquare,
  History
} from 'lucide-react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { WebcamView } from './WebcamView';
import { cn } from '../lib/utils';

const TRANSLATOR_INSTRUCTION = `You are the Guardian EMS Universal Translator. 
Your mission is to facilitate communication between EMS responders and patients who speak different languages.

DIRECTIVES:
1. AUTO-DETECT: Automatically identify the language being spoken by the patient.
2. TRANSLATE TO ENGLISH: Immediately translate any non-English speech into clear, professional English for the responder.
3. TRANSLATE TO PATIENT: If the responder speaks in English, translate it into the patient's detected language.
4. EMS CONTEXT: Maintain medical accuracy. If a patient mentions "chest pain", "shortness of breath", or "allergies", ensure these are translated with high priority.
5. CONCISE: Keep translations direct and clear. Do not add fluff.
6. FORMAT: Start every translation with the language name in brackets, e.g., "[Spanish] I have a headache."`;

export const LanguageTranslator: React.FC<{ location?: { lat: number; lng: number; crossStreets: string | null; accuracy: number | null } | null }> = ({ location }) => {
  const { status, connect, disconnect, sendAudio, sendVideoFrame, transcript } = useGeminiLive(TRANSLATOR_INSTRUCTION);
  const [isActive, setIsActive] = useState(false);

  const handleToggle = () => {
    if (status === 'connected') {
      disconnect();
      setIsActive(false);
    } else {
      connect();
      setIsActive(true);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-full font-mono">
      {/* Visual Context / Camera */}
      <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
        <div className="relative aspect-video bg-black rounded-none overflow-hidden border border-cad-border shadow-2xl">
          <WebcamView 
            active={isActive} 
            onAudio={sendAudio} 
            onFrame={sendVideoFrame}
            location={location}
            className="w-full h-full object-cover"
          />
          
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 px-2 py-1 bg-black/60 border border-cad-border">
              <div className={cn("w-2 h-2 rounded-none", isActive ? "bg-cad-green animate-pulse" : "bg-cad-muted")} />
              <span className="text-[9px] font-bold uppercase tracking-widest">TRANSLATOR: {isActive ? 'LISTENING' : 'STANDBY'}</span>
            </div>
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <button
              onClick={handleToggle}
              className={cn(
                "flex items-center gap-3 px-8 py-3 rounded-none font-bold transition-all active:scale-95 shadow-2xl border border-white/20 text-[10px] uppercase tracking-widest",
                status === 'connected' 
                  ? "bg-cad-red text-white hover:bg-cad-red/80" 
                  : "bg-cad-green text-black hover:bg-cad-green/80"
              )}
            >
              {status === 'connected' ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>STOP TRANSLATION</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>START AUTO-DETECT</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-cad-surface border border-cad-border p-4 flex-1">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-4 h-4 text-cad-green" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest">LINGUISTIC INTELLIGENCE</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-black/40 border border-cad-border">
              <span className="text-[10px] text-cad-muted uppercase">AUTO-DETECTION ENGINE</span>
              <span className="text-[9px] font-bold text-cad-green bg-cad-green/10 px-2 py-0.5 border border-cad-green/20">NEURAL v4.2</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-black/40 border border-cad-border">
              <span className="text-[10px] text-cad-muted uppercase">TARGET LANGUAGE</span>
              <span className="text-[9px] font-bold text-cad-green bg-cad-green/10 px-2 py-0.5 border border-cad-green/20">ENGLISH (US)</span>
            </div>
            <div className="p-3 bg-cad-green/5 border border-cad-green/20">
              <p className="text-[9px] text-cad-green/60 leading-relaxed uppercase">
                THE TRANSLATOR USES REAL-TIME AUDIO ANALYSIS TO DETECT THE PATIENT'S LANGUAGE. SPEAK NATURALLY. THE AI WILL BRIDGE THE GAP.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Translation Feed */}
      <div className="col-span-12 lg:col-span-6 flex flex-col h-full">
        <div className="flex-1 bg-cad-surface border border-cad-border flex flex-col overflow-hidden">
          <div className="p-3 border-b border-cad-border flex items-center justify-between bg-black/20">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3 h-3 text-cad-green" />
              <span className="text-[10px] font-bold uppercase tracking-widest">TRANSLATION STREAM</span>
            </div>
            <div className="flex items-center gap-2">
              <History className="w-3 h-3 text-cad-muted" />
              <span className="text-[9px] text-cad-muted font-bold uppercase">SESSION LOG</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-10">
                <Languages className="w-10 h-10 mb-4" />
                <p className="text-[10px] uppercase tracking-widest">AWAITING SPEECH FOR DETECTION...</p>
              </div>
            ) : (
              transcript.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-3 rounded-none text-[11px] leading-relaxed border",
                    entry.role === 'user' 
                      ? "bg-black/40 ml-6 border-cad-border" 
                      : "bg-cad-green/10 mr-6 border-cad-green/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold uppercase text-cad-muted">
                      {entry.role === 'user' ? 'INPUT' : 'TRANSLATED'}
                    </span>
                    {entry.role === 'model' && (
                      <Volume2 className="w-3 h-3 text-cad-green/50 cursor-pointer hover:text-cad-green" />
                    )}
                  </div>
                  <p className={cn("uppercase", entry.role === 'model' ? "text-cad-green" : "text-white/80")}>
                    {entry.text}
                  </p>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
