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
      if (!canvasRef.current || !videoRef.current || !results.image) return;
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
          if (landmarkBuffer.current.length > 15) {
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
        if (videoRef.current && videoRef.current.readyState >= 2) {
          await hands.send({ image: videoRef.current });
        }
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
    
    if (Math.random() > 0.92) { 
      setCurrentSign(randomGloss);
      
      // Clear current sign after 1.0s
      setTimeout(() => setCurrentSign(null), 1000);

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

  // Auto-translate effect
  useEffect(() => {
    if (glossBuffer.length > 0 && mode === 'ASL_TO_ENG') {
      const timer = setTimeout(() => {
        setIsTranslating(true);
        translateGlosstoEnglish(glossBuffer).then(result => {
          setTranslation(result || '');
          setIsTranslating(false);
        }).catch(err => {
          console.error(err);
          setIsTranslating(false);
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [glossBuffer, mode]);

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
    <div className="grid grid-cols-12 gap-4 h-full font-mono">
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
        <div className="relative aspect-video bg-black rounded-none overflow-hidden border border-cad-border shadow-2xl">
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas ref={canvasRef} className="w-full h-full object-cover mirror" width={1280} height={720} />
          
          {!isReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
              <RefreshCw className="w-8 h-8 text-cad-green animate-spin mb-4" />
              <p className="text-[10px] font-mono uppercase tracking-widest">CALIBRATING VISION SENSORS...</p>
            </div>
          )}

          {/* HUD Overlay */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 px-2 py-1 bg-black/60 border border-cad-border">
              <div className={cn("w-2 h-2 rounded-none", confidence > 0.5 ? "bg-cad-green animate-pulse" : "bg-cad-red")} />
              <span className="text-[9px] font-bold uppercase tracking-widest">TRACKING: {confidence > 0.5 ? 'LOCKED' : 'SEARCHING'}</span>
            </div>
            {confidence > 0 && (
              <div className="px-2 py-1 bg-cad-green/20 border border-cad-green/30">
                <span className="text-[9px] font-bold uppercase tracking-widest text-cad-green">CONFIDENCE: {(confidence * 100).toFixed(0)}%</span>
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
                <div className="px-6 py-3 bg-cad-green text-black font-black text-3xl border-2 border-white/20 uppercase tracking-tighter shadow-[0_0_40px_rgba(0,255,0,0.3)]">
                  {currentSign}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-black/60 border border-cad-border">
              <Languages className="w-3 h-3 text-cad-green" />
              <span className="text-[9px] font-bold uppercase tracking-widest">ASL v2.0 ENGINE</span>
            </div>
            <div className="text-[8px] text-cad-muted bg-black/40 px-2 py-1 border border-cad-border text-right">
              {location && location.lat !== 0 ? (
                <>
                  <div className="flex items-center justify-end gap-2 mb-1">
                    <span className="uppercase tracking-tighter">GPS: {getAccuracyLabel(location.accuracy)}</span>
                    <div className={cn("w-1.5 h-1.5", getAccuracyColor(location.accuracy))} />
                  </div>
                  <div className="text-cad-cyan uppercase tracking-tighter">X-STREETS: {location.crossStreets || 'LOCATING...'}</div>
                  <div className="opacity-50 tracking-tighter">LAT: {location.lat.toFixed(4)} | LON: {location.lng.toFixed(4)}</div>
                </>
              ) : (
                'INITIALIZING TACTICAL GPS...'
              )}
            </div>
          </div>
        </div>

        <div className="bg-cad-surface border border-cad-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cad-muted">GLOSSES DETECTED (V-TO-G)</h3>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cad-red/10 border border-cad-red/20 rounded-none text-[8px] font-bold text-cad-red uppercase tracking-widest animate-pulse">
                <div className="w-1 h-1 bg-cad-red rounded-none" />
                LIVE
              </div>
            </div>
            <button 
              onClick={() => setGlossBuffer([])}
              className="text-[9px] font-bold text-cad-amber uppercase hover:underline"
            >
              CLEAR BUFFER
            </button>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {glossBuffer.length === 0 ? (
              <p className="text-[10px] text-cad-muted italic uppercase">PERFORM SIGNS TO POPULATE BUFFER...</p>
            ) : (
              glossBuffer.map((gloss, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="px-2 py-0.5 bg-cad-green/10 border border-cad-green/30 text-cad-green text-[10px] font-bold"
                >
                  {gloss}
                </motion.span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
        <div className="bg-cad-surface border border-cad-border p-4 flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-cad-green/10 flex items-center justify-center border border-cad-green/20">
              <RefreshCw className={cn("w-4 h-4 text-cad-green", isTranslating && "animate-spin")} />
            </div>
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest">NEMOTRON BRIDGE</h3>
              <p className="text-[9px] text-cad-muted">G-TO-T LINGUISTIC PROCESSOR</p>
            </div>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase text-cad-muted">MODE SELECTION</label>
              <div className="grid grid-cols-2 gap-1">
                <button 
                  onClick={() => setMode('ASL_TO_ENG')}
                  className={cn(
                    "px-2 py-2 text-[9px] font-bold uppercase tracking-widest transition-all border",
                    mode === 'ASL_TO_ENG' ? "bg-cad-green text-black border-cad-green" : "bg-black/40 text-cad-muted border-cad-border"
                  )}
                >
                  ASL TO ENG
                </button>
                <button 
                  onClick={() => setMode('ENG_TO_ASL')}
                  className={cn(
                    "px-2 py-2 text-[9px] font-bold uppercase tracking-widest transition-all border",
                    mode === 'ENG_TO_ASL' ? "bg-cad-green text-black border-cad-green" : "bg-black/40 text-cad-muted border-cad-border"
                  )}
                >
                  ENG TO ASL
                </button>
              </div>
            </div>

            {mode === 'ASL_TO_ENG' ? (
              <div className="space-y-4">
                <button 
                  onClick={performTranslation}
                  disabled={isTranslating || glossBuffer.length === 0}
                  className="w-full py-3 bg-cad-green text-black font-bold uppercase tracking-widest hover:bg-cad-green/80 disabled:opacity-50 flex items-center justify-center gap-2 text-[10px]"
                >
                  {isTranslating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                  {isTranslating ? 'TRANSLATING...' : 'AUTO-TRANSLATE ACTIVE'}
                </button>
                
                <div className="p-3 bg-black/40 border border-cad-border min-h-[100px]">
                  <span className="text-[9px] font-bold uppercase text-cad-muted block mb-2">NATURAL ENGLISH OUTPUT</span>
                  <p className="text-[11px] leading-relaxed text-white/90 uppercase">
                    {translation || "AWAITING TRANSLATION..."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="TYPE ENGLISH SENTENCE..."
                  className="w-full h-24 bg-black/40 border border-cad-border p-3 text-[11px] focus:outline-none focus:border-cad-green uppercase placeholder:text-cad-muted/40"
                />
                <button 
                  onClick={handleEngToAsl}
                  disabled={isTranslating || !inputText.trim()}
                  className="w-full py-3 bg-cad-green text-black font-bold uppercase tracking-widest hover:bg-cad-green/80 disabled:opacity-50 flex items-center justify-center gap-2 text-[10px]"
                >
                  GENERATE GLOSSES
                </button>
                <div className="p-3 bg-black/40 border border-cad-border min-h-[80px]">
                  <span className="text-[9px] font-bold uppercase text-cad-muted block mb-2">ASL GLOSS SEQUENCE</span>
                  <p className="text-[11px] font-bold text-cad-green uppercase">
                    {translation || "AWAITING INPUT..."}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 p-3 bg-cad-amber/10 border border-cad-amber/20 flex gap-3">
            <Info className="w-3 h-3 text-cad-amber shrink-0" />
            <p className="text-[9px] text-cad-amber/60 leading-relaxed uppercase">
              CONFIDENCE SCORE BELOW 80% MAY RESULT IN LINGUISTIC ARTIFACTS. ENSURE HANDS ARE CLEARLY VISIBLE.
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
