import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, 
  X, 
  Mic, 
  MicOff, 
  Brain, 
  Heart, 
  Book, 
  Volume2,
  Sparkles
} from 'lucide-react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { cn } from '../lib/utils';
import { WebcamView } from './WebcamView';

const SUPPORT_INSTRUCTION = `You are Guardian Support AI, a compassionate and knowledgeable companion for EMS crews. 
Your mission is to provide mental health support (therapy), educational assistance (study help), and general information.

DIRECTIVES:
1. THERAPY MODE: If the crew is stressed or had a hard call, listen empathetically. Provide grounding techniques, validation, and a safe space to decompress.
2. STUDY MODE: Help the crew study for certifications (NREMT, etc.). Explain complex medical concepts simply.
3. CHAT MODE: Be a helpful companion for general questions or casual conversation during downtime.
4. TONE: Professional yet warm, supportive, and non-judgmental.
5. CONCISE: Keep spoken responses relatively brief but meaningful.`;

export function SupportAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const { status, connect, disconnect, sendAudio, transcript } = useGeminiLive(SUPPORT_INSTRUCTION);
  const [isListening, setIsListening] = useState(false);

  const handleToggle = () => {
    if (status === 'connected') {
      disconnect();
      setIsListening(false);
    } else {
      connect();
      setIsListening(true);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-mono">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-80 bg-cad-surface border border-cad-border rounded-none shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-3 border-b border-cad-border bg-black/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-cad-green" />
                <span className="text-[10px] font-bold uppercase tracking-widest">GUARDIAN SUPPORT</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-cad-muted hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 h-64 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-black/20">
              {transcript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20 space-y-2">
                  <Brain className="w-6 h-6" />
                  <p className="text-[9px] font-bold uppercase tracking-widest">AWAITING VOICE INPUT</p>
                  <p className="text-[8px] leading-relaxed uppercase">ASK ME ABOUT PROTOCOLS, STUDY FOR NREMT, OR JUST TALK AFTER A HARD CALL.</p>
                </div>
              ) : (
                transcript.map((entry, i) => (
                  <div key={i} className={cn(
                    "p-2 rounded-none text-[10px] leading-relaxed border",
                    entry.role === 'user' ? "bg-black/40 ml-4 border-cad-border" : "bg-cad-green/10 mr-4 border-cad-green/30"
                  )}>
                    <p className={cn("uppercase", entry.role === 'model' ? "text-cad-green" : "text-white/80")}>
                      {entry.text}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Hidden Webcam for Audio Capture */}
            <div className="hidden">
              <WebcamView active={isListening} onAudio={sendAudio} onFrame={() => {}} />
            </div>

            {/* Controls */}
            <div className="p-3 bg-black/40 border-t border-cad-border flex items-center justify-center gap-4">
              <button
                onClick={handleToggle}
                className={cn(
                  "w-10 h-10 rounded-none flex items-center justify-center transition-all shadow-lg border border-white/10",
                  status === 'connected' ? "bg-cad-red text-white animate-pulse" : "bg-cad-green text-black hover:bg-cad-green/80"
                )}
              >
                {status === 'connected' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-widest">
                  {status === 'connected' ? 'LISTENING...' : 'VOICE SUPPORT'}
                </span>
                <span className="text-[8px] text-cad-muted font-bold uppercase">
                  {status === 'connected' ? 'SPEAK NATURALLY' : 'CLICK TO ACTIVATE'}
                </span>
              </div>
            </div>

            {/* Quick Modes */}
            <div className="px-3 pb-3 flex justify-between gap-2">
              <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 cursor-help">
                <Heart className="w-3 h-3 text-cad-red" />
                <span className="text-[7px] uppercase font-bold">THERAPY</span>
              </div>
              <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 cursor-help">
                <Book className="w-3 h-3 text-cad-blue" />
                <span className="text-[7px] uppercase font-bold">STUDY</span>
              </div>
              <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 cursor-help">
                <MessageCircle className="w-3 h-3 text-cad-green" />
                <span className="text-[7px] uppercase font-bold">CHAT</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-12 h-12 rounded-none flex items-center justify-center shadow-2xl transition-all active:scale-90 border border-cad-border",
          isOpen ? "bg-white text-black" : "bg-cad-surface text-cad-green hover:bg-cad-surface/80"
        )}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-cad-red rounded-none border border-black flex items-center justify-center">
            <div className="w-1 h-1 bg-white rounded-none animate-pulse" />
          </div>
        )}
      </button>
    </div>
  );
}
