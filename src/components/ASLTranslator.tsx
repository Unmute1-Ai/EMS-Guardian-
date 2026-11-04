import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS } from '@mediapipe/hands';
import { motion, AnimatePresence } from 'motion/react';
import { Languages, RefreshCw, Info, Delete, Trash2 } from 'lucide-react';
import { translateGlosstoEnglish, translateEnglishtoASL } from '../services/geminiService';
import { cn } from '../lib/utils';
import { buildFeatureVector, LandmarkFrame } from '../lib/aslFeatures';
import { classify, hasClassifierModel } from '../lib/aslClassifier';
import { recognizeFingerspell, hasGeminiApiKey } from '../services/geminiService';
import { createFingerspellAccumulator, createRecognitionGate } from '../lib/fingerspell';
import type { CommittedLetter, FingerspellAccumulator } from '../lib/fingerspell';

// Only glosses detected above this softmax confidence enter the buffer.
const SIGN_CONFIDENCE_THRESHOLD = 0.35;
// Minimum frames between accepted glosses, prevents the same window from
// re-emitting the same sign on every frame.
const SIGN_COOLDOWN_FRAMES = 20;
// Window length (frames) over which trajectory and the current pose are read.
const FEATURE_WINDOW = 15;

// Fingerspelling (Gemini path): one camera frame every FINGERSPELL_INTERVAL_MS
// goes to Gemini with at most one request in flight — excess frames are
// dropped, never queued. Smoothing tuning notes live with the accumulator in
// fingerspell.ts.
const FINGERSPELL_INTERVAL_MS = 300;
const FINGERSPELL_FRAME_WIDTH = 640;
const FINGERSPELL_FRAME_HEIGHT = 360;
const FINGERSPELL_JPEG_QUALITY = 0.6;
const WORD_BUFFER_LIMIT = 32;

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
  const [tracking, setTracking] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [mode, setMode] = useState<'ASL_TO_ENG' | 'ENG_TO_ASL'>('ASL_TO_ENG');
  const [inputText, setInputText] = useState('');

  // Gemini fingerspelling path. When no key is baked in at build time, ASL
  // mode falls back to the gloss pipeline below, labeled as a preview.
  const [wordEntries, setWordEntries] = useState<CommittedLetter[]>([]);
  const [letterConfidence, setLetterConfidence] = useState(0);
  const fingerspellActive = useMemo(() => hasGeminiApiKey(), []);

  // Rolling window of the primary hand's landmark frames.
  const landmarkBuffer = useRef<LandmarkFrame[]>([]);
  // Monotonic frame counter used to enforce the cooldown between glosses.
  const frameIdxRef = useRef(0);
  const lastEmitFrameRef = useRef(-Infinity);
  const lastEmitGlossRef = useRef<string | null>(null);
  const inferenceInFlightRef = useRef(false);
  const signClearTimerRef = useRef<number | null>(null);

  // Fingerspelling capture state (see the capture effect below).
  const fingerspellAccumulatorRef = useRef<FingerspellAccumulator | null>(null);
  if (fingerspellAccumulatorRef.current === null) {
    fingerspellAccumulatorRef.current = createFingerspellAccumulator();
  }
  const recognitionGateRef = useRef(createRecognitionGate());
  const trackingRef = useRef(false);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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

      const handsPresent = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

      if (handsPresent) {
        for (const landmarks of results.multiHandLandmarks) {
          drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#10b981', lineWidth: 5 });
          drawLandmarks(canvasCtx, landmarks, { color: '#ffffff', lineWidth: 2, radius: 3 });
        }

        // Feed only the primary hand into the per-frame feature window.
        // Two-hand modelling is deferred until the classifier model lands.
        const primary = results.multiHandLandmarks[0] as LandmarkFrame;
        landmarkBuffer.current.push(primary);
        if (landmarkBuffer.current.length > FEATURE_WINDOW) {
          landmarkBuffer.current.shift();
        }

        frameIdxRef.current += 1;
        if (landmarkBuffer.current.length === FEATURE_WINDOW) {
          runInference();
        }
        trackingRef.current = true;
        setTracking(true);
      } else {
        trackingRef.current = false;
        setTracking(false);
        // Hand left frame — forget the window so a new sign starts clean.
        landmarkBuffer.current.length = 0;
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

  // Flash a freshly committed letter or gloss over the video for ~1s.
  const flashSign = useCallback((sign: string) => {
    setCurrentSign(sign);
    if (signClearTimerRef.current !== null) {
      window.clearTimeout(signClearTimerRef.current);
    }
    signClearTimerRef.current = window.setTimeout(() => {
      setCurrentSign(null);
      signClearTimerRef.current = null;
    }, 1000);
  }, []);

  // Fingerspelling capture loop: sample the camera on a fixed cadence and ask
  // Gemini to read the letter, at most one request in flight. Runs only in
  // ASL_TO_ENG (ENG_TO_ASL is keyboard input) and only while a hand is
  // tracked — MediaPipe gates the spend, Gemini does the reading.
  useEffect(() => {
    if (!fingerspellActive) return;

    const canvas = document.createElement('canvas');
    canvas.width = FINGERSPELL_FRAME_WIDTH;
    canvas.height = FINGERSPELL_FRAME_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tick = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      if (modeRef.current !== 'ASL_TO_ENG') return;
      if (!trackingRef.current) return;
      if (!recognitionGateRef.current.tryAcquire()) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = canvas.toDataURL('image/jpeg', FINGERSPELL_JPEG_QUALITY);

      recognizeFingerspell(frame)
        .then(result => {
          if (!result) return;
          setLetterConfidence(result.confidence);
          const committed = fingerspellAccumulatorRef.current?.add(result) ?? null;
          if (committed) {
            setWordEntries(prev => {
              const next = [...prev, committed];
              return next.length > WORD_BUFFER_LIMIT ? next.slice(-WORD_BUFFER_LIMIT) : next;
            });
            flashSign(committed.letter);
          }
        })
        .catch(err => {
          console.error('Fingerspell recognition failed:', err);
        })
        .finally(() => {
          recognitionGateRef.current.release();
        });
    };

    const interval = window.setInterval(tick, FINGERSPELL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fingerspellActive, flashSign]);

  // V-to-G (Vision to Gloss): extract real geometric features from the
  // sliding landmark window, run the classifier (TFJS model if wired, or
  // the deterministic heuristic fallback), and only emit a gloss when
  // softmax confidence clears the threshold and the cooldown has elapsed.
  // With a Gemini key present, ASL mode uses the fingerspelling path instead
  // and this pipeline stays dormant (it remains the no-key offline preview).
  const runInference = () => {
    if (fingerspellActive) return;
    if (inferenceInFlightRef.current) return;
    inferenceInFlightRef.current = true;

    const feat = buildFeatureVector(landmarkBuffer.current);
    classify(feat)
      .then(pred => {
        setConfidence(pred.confidence);
        const frameIdx = frameIdxRef.current;
        const sinceLast = frameIdx - lastEmitFrameRef.current;
        const belowThreshold = pred.confidence < SIGN_CONFIDENCE_THRESHOLD;
        const inCooldown = sinceLast < SIGN_COOLDOWN_FRAMES;
        const sameAsLast = pred.gloss === lastEmitGlossRef.current;
        if (belowThreshold || inCooldown || sameAsLast) return;

        lastEmitFrameRef.current = frameIdx;
        lastEmitGlossRef.current = pred.gloss;
        flashSign(pred.gloss);

        setGlossBuffer(prev => {
          const next = [...prev, pred.gloss];
          if (next.length > 8) return next.slice(1);
          return next;
        });
      })
      .catch(err => {
        console.error('ASL classify failed:', err);
      })
      .finally(() => {
        inferenceInFlightRef.current = false;
      });
  };

  const handleWordBackspace = () => setWordEntries(prev => prev.slice(0, -1));

  const handleWordClear = () => {
    setWordEntries([]);
    fingerspellAccumulatorRef.current?.reset();
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
              <div className={cn("w-2 h-2 rounded-none", tracking ? "bg-cad-green animate-pulse" : "bg-cad-red")} />
              <span className="text-[9px] font-bold uppercase tracking-widest">TRACKING: {tracking ? 'LOCKED' : 'SEARCHING'}</span>
            </div>
            {tracking && (
              <div className={cn(
                "px-2 py-1 border",
                fingerspellActive
                  ? letterConfidence >= 0.5
                    ? "bg-cad-green/20 border-cad-green/30 text-cad-green"
                    : "bg-cad-amber/10 border-cad-amber/20 text-cad-amber"
                  : confidence >= SIGN_CONFIDENCE_THRESHOLD
                    ? "bg-cad-green/20 border-cad-green/30 text-cad-green"
                    : "bg-cad-amber/10 border-cad-amber/20 text-cad-amber"
              )}>
                <span className="text-[9px] font-bold uppercase tracking-widest">
                  {fingerspellActive
                    ? `LETTER CONFIDENCE: ${(letterConfidence * 100).toFixed(0)}% • GEMINI`
                    : `SIGN CONFIDENCE: ${(confidence * 100).toFixed(0)}%${!hasClassifierModel() ? ' • HEURISTIC' : ''}`}
                </span>
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

        {fingerspellActive ? (
          <div className="bg-cad-surface border border-cad-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cad-muted">FINGERSPELLED TEXT (GEMINI VISION)</h3>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cad-red/10 border border-cad-red/20 rounded-none text-[8px] font-bold text-cad-red uppercase tracking-widest animate-pulse">
                  <div className="w-1 h-1 bg-cad-red rounded-none" />
                  LIVE
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleWordBackspace}
                  disabled={wordEntries.length === 0}
                  className="flex items-center gap-1 text-[9px] font-bold text-cad-amber uppercase hover:underline disabled:opacity-40 disabled:hover:no-underline"
                >
                  <Delete className="w-3 h-3" />
                  BACKSPACE
                </button>
                <button
                  onClick={handleWordClear}
                  disabled={wordEntries.length === 0}
                  className="flex items-center gap-1 text-[9px] font-bold text-cad-red uppercase hover:underline disabled:opacity-40 disabled:hover:no-underline"
                >
                  <Trash2 className="w-3 h-3" />
                  CLEAR
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2 min-h-[48px]">
              {wordEntries.length === 0 ? (
                <p className="text-[10px] text-cad-muted italic uppercase">FINGERSPELL A WORD — EACH STABLE LETTER LANDS HERE...</p>
              ) : (
                wordEntries.map((entry, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center px-2.5 py-1 bg-cad-green/10 border border-cad-green/30 text-cad-green"
                  >
                    <span className="text-base font-black leading-none">{entry.letter}</span>
                    <span className="text-[8px] text-cad-green/60 mt-0.5">{(entry.confidence * 100).toFixed(0)}%</span>
                  </motion.span>
                ))
              )}
            </div>
            {wordEntries.length > 0 && (
              <p className="mt-3 text-2xl font-black tracking-[0.3em] text-white uppercase break-all">
                {wordEntries.map(entry => entry.letter).join('')}
              </p>
            )}
            <div className="mt-3 p-2 bg-cad-amber/10 border border-cad-amber/20 flex gap-2">
              <Info className="w-3 h-3 text-cad-amber shrink-0" />
              <p className="text-[8px] text-cad-amber/60 leading-relaxed uppercase">
                HOLD A STEADY HANDSHAPE FOR ~1.5S TO REPEAT THE LAST LETTER (DOUBLE LETTERS). J AND Z ARE DRAWN WITH MOTION — BEST EFFORT FROM FRAMES. CHIP % IS PER-LETTER CONFIDENCE.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-cad-surface border border-cad-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cad-muted">GLOSSES DETECTED (V-TO-G)</h3>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cad-amber/10 border border-cad-amber/20 rounded-none text-[8px] font-bold text-cad-amber uppercase tracking-widest">
                  NO GEMINI KEY — HEURISTIC PREVIEW
                </div>
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
        )}
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
