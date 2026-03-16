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
    <div className="grid grid-cols-12 gap-6 h-full">
      {/* Visual Context / Camera */}
      <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          <WebcamView 
            active={isActive} 
            onAudio={sendAudio} 
            onFrame={sendVideoFrame}
            location={location}
            className="w-full h-full object-cover"
          />
          
          <div className="absolute top-6 left-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
              <div className={cn("w-2 h-2 rounded-full", isActive ? "bg-emerald-500 animate-pulse" : "bg-white/20")} />
              <span className="text-[10px] font-mono uppercase tracking-widest">Translator: {isActive ? 'Listening' : 'Standby'}</span>
            </div>
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <button
              onClick={handleToggle}
              className={cn(
                "flex items-center gap-3 px-8 py-4 rounded-full font-bold transition-all active:scale-95 shadow-2xl",
                status === 'connected' 
                  ? "bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white" 
                  : "bg-emerald-500 text-black hover:bg-emerald-400"
              )}
            >
              {status === 'connected' ? (
                <>
                  <MicOff className="w-5 h-5" />
                  <span>STOP TRANSLATION</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  <span>START AUTO-DETECT</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-[#111] border border-white/5 p-6 rounded-2xl flex-1">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-bold uppercase tracking-widest">Linguistic Intelligence</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-xs text-white/60">Auto-Detection Engine</span>
              <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Neural v4.2</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-xs text-white/60">Target Language</span>
              <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">English (US)</span>
            </div>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <p className="text-[10px] text-emerald-200/60 leading-relaxed">
                The translator uses real-time audio analysis to detect the patient's language. Speak naturally. The AI will bridge the gap.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Translation Feed */}
      <div className="col-span-12 lg:col-span-6 flex flex-col h-full">
        <div className="flex-1 bg-[#111] border border-white/5 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Translation Stream</span>
            </div>
            <div className="flex items-center gap-2">
              <History className="w-3 h-3 text-white/40" />
              <span className="text-[10px] text-white/40 font-mono uppercase">Session Log</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                <Languages className="w-12 h-12 mb-4" />
                <p className="text-sm font-mono">Awaiting speech for detection...</p>
              </div>
            ) : (
              transcript.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-4 rounded-xl text-sm leading-relaxed",
                    entry.role === 'user' 
                      ? "bg-white/5 ml-8 border-l-2 border-white/20" 
                      : "bg-emerald-500/10 mr-8 border-l-2 border-emerald-500"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase text-white/40">
                      {entry.role === 'user' ? 'Input' : 'Translated'}
                    </span>
                    {entry.role === 'model' && (
                      <Volume2 className="w-3 h-3 text-emerald-500/50 cursor-pointer hover:text-emerald-500" />
                    )}
                  </div>
                  <p className={entry.role === 'model' ? "text-emerald-50" : "text-white/80"}>
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
