import React, { useEffect, useRef, useState } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS } from '@mediapipe/hands';
import { motion, AnimatePresence } from 'motion/react';
import { Languages, Mic, Volume2, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { translateGlosstoEnglish, translateEnglishtoASL } from '../services/geminiService';
import { cn } from '../lib/utils';

export const ASLTranslator: React.FC<{ location?: { lat: number; lng: number; crossStreets: string | null; accuracy: number | null } | null }> = ({ location }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  const [isReady, setIsReady] = useState(false);
  const [glossBuffer, setGlossBuffer] = useState<string[]>([]);
  const [currentSign, setCurrentSign] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [mode, setMode] = useState<'ASL_TO_ENG' | 'ENG_TO_ASL'>('ASL_TO_ENG');
  const [inputText, setInputText] = useState('');

  // Buffer for landmarks to prevent jitter and handle sequence
  const landmarkBuffer = useRef<any[]>([]);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults((results: Results) => {
      if (!canvasRef.current || !videoRef.current) return;
      const canvasCtx = canvasRef.current.getContext('2d');
      if (!canvasCtx) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
          drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#10b981', lineWidth: 5 });
          drawLandmarks(canvasCtx, landmarks, { color: '#ffffff', lineWidth: 2, radius: 3 });
          
          // Add to buffer for inference
          landmarkBuffer.current.push(landmarks);
          if (landmarkBuffer.current.length > 60) {
            landmarkBuffer.current.shift();
            // Trigger pseudo-inference (V-to-G)
            // In a real app, this would be a TFLite model call
            // Here we simulate detection of common signs
            handleInference();
          }
        }
        setConfidence(results.multiHandLandmarks.length > 0 ? 0.92 : 0);
      } else {
        setConfidence(0);
      }
      canvasCtx.restore();
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await hands.send({ image: videoRef.current! });
      },
      width: 1280,
      height: 720,
    });

    camera.start().then(() => setIsReady(true));

    return () => {
      camera.stop();
      hands.close();
    };
  }, []);

  const handleInference = () => {
    // Simulated V-to-G (Vision to Gloss)
    const mockGlosses = ['HELLO', 'NEED', 'HELP', 'PAIN', 'CHEST', 'PATIENT', 'STABLE', 'BREATHING'];
    const randomGloss = mockGlosses[Math.floor(Math.random() * mockGlosses.length)];
    
    if (Math.random() > 0.97) { 
      setCurrentSign(randomGloss);
      
      // Clear current sign after 1.5s
      setTimeout(() => setCurrentSign(null), 1500);

      setGlossBuffer(prev => {
        if (prev[prev.length - 1] === randomGloss) return prev;
        const next = [...prev, randomGloss];
        if (next.length > 8) return next.slice(1);
        return next;
      });
    }
  };

  const performTranslation = async () => {
    if (glossBuffer.length === 0) return;
    setIsTranslating(true);
    try {
      const result = await translateGlosstoEnglish(glossBuffer);
      setTranslation(result || '');
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleEngToAsl = async () => {
    if (!inputText.trim()) return;
    setIsTranslating(true);
    try {
      const result = await translateEnglishtoASL(inputText);
      setTranslation(result || '');
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas ref={canvasRef} className="w-full h-full object-cover mirror" width={1280} height={720} />
          
          {!isReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
              <p className="text-sm font-mono uppercase tracking-widest">Calibrating Vision Sensors...</p>
            </div>
          )}

          {/* HUD Overlay */}
          <div className="absolute top-6 left-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
              <div className={cn("w-2 h-2 rounded-full", confidence > 0.5 ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
              <span className="text-[10px] font-mono uppercase tracking-widest">Tracking: {confidence > 0.5 ? 'Locked' : 'Searching'}</span>
            </div>
            {confidence > 0 && (
              <div className="px-3 py-1.5 bg-emerald-500/20 backdrop-blur-md rounded-lg border border-emerald-500/30">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500">Confidence: {(confidence * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>

          {/* Real-time Sign Overlay */}
          <AnimatePresence>
            {currentSign && (
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="px-8 py-4 bg-emerald-500 text-black font-black text-4xl rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.4)] border-4 border-white/20 uppercase tracking-tighter">
                  {currentSign}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-6 right-6 flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10">
              <Languages className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-widest">ASL v2.0 Engine</span>
            </div>
            <div className="text-[10px] font-mono text-white/30 bg-black/40 px-2 py-1 rounded text-right">
              {location && location.lat !== 0 ? (
                <>
                  <div className="flex items-center justify-end gap-2 mb-1">
                    <span className="opacity-50 uppercase">GPS: {getAccuracyLabel(location.accuracy)}</span>
                    <div className={cn("w-1.5 h-1.5 rounded-full", getAccuracyColor(location.accuracy))} />
                  </div>
                  <div>X-STREETS: {location.crossStreets || 'LOCATING...'}</div>
                  <div className="opacity-50">LAT: {location.lat.toFixed(4)} | LON: {location.lng.toFixed(4)}</div>
                </>
              ) : (
                'INITIALIZING TACTICAL GPS...'
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#111] border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Glosses Detected (V-to-G)</h3>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[8px] font-bold text-red-500 uppercase tracking-widest animate-pulse">
                <div className="w-1 h-1 bg-red-500 rounded-full" />
                Live
              </div>
            </div>
            <button 
              onClick={() => setGlossBuffer([])}
              className="text-[10px] font-bold text-emerald-500 uppercase hover:underline"
            >
              Clear Buffer
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {glossBuffer.length === 0 ? (
              <p className="text-sm font-mono text-white/20 italic">Perform signs to populate buffer...</p>
            ) : (
              glossBuffer.map((gloss, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-500 font-mono text-sm font-bold"
                >
                  {gloss}
                </motion.span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6 flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <RefreshCw className={cn("w-5 h-5 text-emerald-500", isTranslating && "animate-spin")} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest">Nemotron Bridge</h3>
              <p className="text-[10px] text-white/40 font-mono">G-to-T Linguistic Processor</p>
            </div>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-white/40">Mode Selection</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setMode('ASL_TO_ENG')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                    mode === 'ASL_TO_ENG' ? "bg-emerald-600 text-white" : "bg-white/5 text-white/40"
                  )}
                >
                  ASL to English
                </button>
                <button 
                  onClick={() => setMode('ENG_TO_ASL')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                    mode === 'ENG_TO_ASL' ? "bg-emerald-600 text-white" : "bg-white/5 text-white/40"
                  )}
                >
                  English to ASL
                </button>
              </div>
            </div>

            {mode === 'ASL_TO_ENG' ? (
              <div className="space-y-4">
                <button 
                  onClick={performTranslation}
                  disabled={isTranslating || glossBuffer.length === 0}
                  className="w-full py-4 bg-emerald-600 rounded-xl font-bold uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isTranslating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                  Translate Sequence
                </button>
                
                <div className="p-4 bg-black/40 border border-white/5 rounded-xl min-h-[120px]">
                  <span className="text-[10px] font-bold uppercase text-white/40 block mb-2">Natural English Output</span>
                  <p className="text-sm leading-relaxed text-emerald-50">
                    {translation || "Awaiting translation..."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type English sentence..."
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <button 
                  onClick={handleEngToAsl}
                  disabled={isTranslating || !inputText.trim()}
                  className="w-full py-4 bg-emerald-600 rounded-xl font-bold uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Generate Glosses
                </button>
                <div className="p-4 bg-black/40 border border-white/5 rounded-xl min-h-[100px]">
                  <span className="text-[10px] font-bold uppercase text-white/40 block mb-2">ASL Gloss Sequence</span>
                  <p className="text-sm font-mono font-bold text-emerald-500">
                    {translation || "Awaiting input..."}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3">
            <Info className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-[10px] text-amber-200/60 leading-relaxed">
              Confidence score below 80% may result in linguistic artifacts. Ensure hands are clearly visible within the frame.
            </p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .mirror {
          transform: scaleX(-1);
        }
      `}} />
    </div>
  );
};
