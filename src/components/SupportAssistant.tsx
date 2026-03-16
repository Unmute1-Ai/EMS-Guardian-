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
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-80 bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-white/2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-widest">Guardian Support</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 h-64 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/20">
              {transcript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-2">
                  <Brain className="w-8 h-8" />
                  <p className="text-[10px] font-mono uppercase tracking-widest">Awaiting Voice Input</p>
                  <p className="text-[9px] leading-relaxed">Ask me about protocols, study for NREMT, or just talk after a hard call.</p>
                </div>
              ) : (
                transcript.map((entry, i) => (
                  <div key={i} className={cn(
                    "p-3 rounded-xl text-xs leading-relaxed",
                    entry.role === 'user' ? "bg-white/5 ml-4" : "bg-emerald-500/10 mr-4 border-l-2 border-emerald-500"
                  )}>
                    <p className={entry.role === 'model' ? "text-emerald-50" : "text-white/80"}>
                      {entry.text}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Hidden Webcam for Audio Capture (using the same component but hidden) */}
            <div className="hidden">
              <WebcamView active={isListening} onAudio={sendAudio} onFrame={() => {}} />
            </div>

            {/* Controls */}
            <div className="p-4 bg-white/2 border-t border-white/5 flex items-center justify-center gap-4">
              <button
                onClick={handleToggle}
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg",
                  status === 'connected' ? "bg-red-500 text-white animate-pulse" : "bg-emerald-600 text-white hover:bg-emerald-500"
                )}
              >
                {status === 'connected' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {status === 'connected' ? 'Listening...' : 'Voice Support'}
                </span>
                <span className="text-[8px] text-white/40 font-mono">
                  {status === 'connected' ? 'Speak naturally' : 'Click to activate'}
                </span>
              </div>
            </div>

            {/* Quick Modes */}
            <div className="px-4 pb-4 flex justify-between gap-2">
              <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 cursor-help">
                <Heart className="w-3 h-3 text-rose-500" />
                <span className="text-[8px] uppercase font-bold">Therapy</span>
              </div>
              <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 cursor-help">
                <Book className="w-3 h-3 text-blue-500" />
                <span className="text-[8px] uppercase font-bold">Study</span>
              </div>
              <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 cursor-help">
                <MessageCircle className="w-3 h-3 text-emerald-500" />
                <span className="text-[8px] uppercase font-bold">Chat</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 border border-white/10",
          isOpen ? "bg-white text-black" : "bg-emerald-600 text-white hover:bg-emerald-500"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-[#0A0A0A] flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          </div>
        )}
      </button>
    </div>
  );
}
