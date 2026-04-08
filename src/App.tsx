import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Shield, 
  Mic, 
  MicOff, 
  AlertCircle, 
  ChevronRight,
  Clock,
  HeartPulse,
  Scan,
  BookOpen,
  FileText,
  Stethoscope,
  Send,
  Loader2,
  Image as ImageIcon,
  Languages,
  Globe,
  Navigation,
  Search
} from 'lucide-react';
import Markdown from 'react-markdown';
import { WebcamView } from './components/WebcamView';
import { ASLTranslator } from './components/ASLTranslator';
import { LanguageTranslator } from './components/LanguageTranslator';
import { MapView } from './components/MapView';
import { SupportAssistant } from './components/SupportAssistant';
import { TacticalLookup } from './components/TacticalLookup';
import { useGeminiLive, Hazard } from './hooks/useGeminiLive';
import { generateSimulatorScenario, generateImage, generateHandoffReport, getCrossStreets } from './services/geminiService';
import { cn } from './lib/utils';

type AppMode = 'FIELD' | 'TRAINING' | 'REPORT' | 'ASL' | 'TRANSLATOR';
type MissionStatus = 'EN_ROUTE' | 'ON_SCENE';

export default function App() {
  const [mode, setMode] = useState<AppMode>('FIELD');
  const [missionStatus, setMissionStatus] = useState<MissionStatus>('EN_ROUTE');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dutyStatus, setDutyStatus] = useState<'ACTIVE' | 'TRAINING'>('ACTIVE');
  const [isARMode, setIsARMode] = useState(false);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  
  const trainingInstruction = `You are a 911 Dispatcher and EMS Training Instructor. A training simulation is starting. 
First, announce the simulated dispatch call verbally (e.g., "Unit 1, respond to a simulated cardiac arrest at 123 Main St"). 
Then, guide the user through the scenario, asking them what they do next and providing verbal feedback on their actions. Make it realistic.

SCENE ANALYSIS & HAZARD DETECTION (CRITICAL):
- Continuously analyze the visual feed for hazards: traffic, downed power lines, fire, hazardous materials, or aggressive bystanders.
- When a hazard is detected, you MUST include a hidden tag in your text response in the EXACT format: [HAZARD: {"type": "fire", "box": [ymin, xmin, ymax, xmax], "confidence": 0.9}]
- The box coordinates MUST be normalized (0-1000): [ymin, xmin, ymax, xmax].
- If multiple hazards are detected, include multiple tags.
- Interrupt immediately with a clear verbal "SAFETY ALERT" and specific instructions if a hazard is detected.`;

  const handleHazardsDetected = useCallback((detectedHazards: Hazard[]) => {
    setHazards(detectedHazards);
  }, []);

  // Field Assistant State
  const { status, connect, disconnect, sendAudio, sendVideoFrame, transcript: fieldTranscript } = useGeminiLive(
    dutyStatus === 'TRAINING' ? trainingInstruction : undefined,
    handleHazardsDetected
  );
  const [isFieldActive, setIsFieldActive] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; crossStreets: string | null; accuracy: number | null }>({ lat: 0, lng: 0, crossStreets: null, accuracy: null });

  useEffect(() => {
    const isLocationNeeded = isFieldActive || mode === 'TRANSLATOR' || mode === 'ASL' || missionStatus === 'EN_ROUTE';
    if (isLocationNeeded) {
      const watchId = navigator.geolocation.watchPosition(async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        // Only fetch cross streets if we don't have them or if location moved significantly
        // For simplicity, we'll fetch once or every 30 seconds
        setLocation(prev => {
          if (prev.lat === lat && prev.lng === lng && prev.accuracy === accuracy) return prev;
          return { ...prev, lat, lng, accuracy };
        });

        // Debounced or conditional cross street fetch
        if (!location.crossStreets || location.crossStreets === 'LOCATING...') {
          try {
            const streets = await getCrossStreets(lat, lng);
            setLocation(prev => ({ ...prev, crossStreets: streets || 'UNKNOWN' }));
          } catch (err) {
            console.error(err);
            setLocation(prev => ({ ...prev, crossStreets: 'ERROR' }));
          }
        }
      }, (err) => console.error(err), { enableHighAccuracy: true });

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isFieldActive, mode, missionStatus]);

  // Training Simulator State
  const [simHistory, setSimHistory] = useState<any[]>([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simInput, setSimInput] = useState('');
  const [currentSimImage, setCurrentSimImage] = useState<string | null>(null);

  // Handoff Report State
  const [reportInput, setReportInput] = useState('');
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    if (hazards.length > 0) {
      const timer = setTimeout(() => setHazards([]), 5000);
      return () => clearTimeout(timer);
    }
  }, [hazards]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleField = () => {
    if (status === 'connected') {
      disconnect();
      setIsFieldActive(false);
    } else {
      connect();
      setIsFieldActive(true);
    }
  };

  const playDispatchChime = () => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.type = 'square';
    osc2.type = 'square';
    
    osc1.frequency.setValueAtTime(800, ctx.currentTime);
    osc2.frequency.setValueAtTime(1000, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    
    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime + 0.2);
    
    osc1.stop(ctx.currentTime + 1.5);
    osc2.stop(ctx.currentTime + 1.5);
  };

  const triggerTrainingDispatch = () => {
    playDispatchChime();
    setTimeout(() => {
      connect();
      setIsFieldActive(true);
    }, 1500);
  };

  const startNewSimulation = async () => {
    setSimLoading(true);
    setSimHistory([]);
    setCurrentSimImage(null);
    try {
      const res = await generateSimulatorScenario();
      const text = res.text || '';
      setSimHistory([{ role: 'model', parts: [{ text }] }]);
      
      // Extract visual prompt and generate image
      const visualMatch = text.match(/Visual Prompt:?\s*(.*)/i);
      if (visualMatch?.[1]) {
        const img = await generateImage(visualMatch[1]);
        setCurrentSimImage(img);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimLoading(false);
    }
  };

  const handleSimAction = async () => {
    if (!simInput.trim()) return;
    const action = simInput;
    setSimInput('');
    setSimLoading(true);
    
    const newHistory = [...simHistory, { role: 'user', parts: [{ text: action }] }];
    setSimHistory(newHistory);

    try {
      const res = await generateSimulatorScenario(action, simHistory);
      const text = res.text || '';
      setSimHistory([...newHistory, { role: 'model', parts: [{ text }] }]);
      
      const visualMatch = text.match(/Visual Prompt:?\s*(.*)/i);
      if (visualMatch?.[1]) {
        const img = await generateImage(visualMatch[1]);
        setCurrentSimImage(img);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!reportInput.trim()) return;
    setReportLoading(true);
    try {
      const report = await generateHandoffReport(reportInput);
      setGeneratedReport(report || 'Failed to generate report.');
    } catch (err) {
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  const [hasSafetyAlert, setHasSafetyAlert] = useState(false);

  useEffect(() => {
    if (fieldTranscript.length > 0) {
      const lastMessage = fieldTranscript[fieldTranscript.length - 1];
      if (lastMessage.role === 'model' && lastMessage.text.toUpperCase().includes('SAFETY ALERT')) {
        setHasSafetyAlert(true);
        // Auto-clear after 10 seconds
        const timer = setTimeout(() => setHasSafetyAlert(false), 10000);
        return () => clearTimeout(timer);
      }
    }
  }, [fieldTranscript]);

  return (
    <div className={cn(
      "min-h-screen text-cad-text font-mono flex flex-col selection:bg-cad-green selection:text-black",
      dutyStatus === 'TRAINING' ? "bg-cad-bg/90" : "bg-cad-bg",
      isARMode ? "bg-black" : ""
    )}>
      {/* FDNY CAD Top Status Bar */}
      {!isARMode && (
        <nav className={cn(
          "h-10 border-b flex items-center justify-between px-4 shrink-0 transition-colors",
          dutyStatus === 'TRAINING' ? "bg-cad-amber/10 border-cad-amber/30" : "bg-cad-surface border-cad-border"
        )}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className={cn("w-4 h-4", dutyStatus === 'TRAINING' ? "text-cad-amber" : "text-cad-red")} />
              <span className="text-xs font-bold tracking-tighter uppercase">
                {dutyStatus === 'TRAINING' ? 'TRAINING SIM // UNIT 01-A' : 'FDNY CAD // UNIT 01-A'}
              </span>
            </div>
            <div className={cn("h-4 w-[1px]", dutyStatus === 'TRAINING' ? "bg-cad-amber/30" : "bg-cad-border")} />
            <div className="flex items-center gap-3">
              {[
                { id: 'FIELD', label: '10-8' }, // In Service
                { id: 'TRAINING', label: 'SIM' },
                { id: 'REPORT', label: 'RPT' },
                { id: 'TRANSLATOR', label: 'TRN' },
                { id: 'ASL', label: 'ASL' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setMode(item.id as AppMode)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest transition-all border",
                    mode === item.id 
                      ? (dutyStatus === 'TRAINING' ? "bg-cad-amber text-black border-cad-amber" : "bg-cad-green text-black border-cad-green")
                      : "text-cad-muted border-transparent hover:text-white hover:border-cad-border"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDutyStatus(prev => prev === 'ACTIVE' ? 'TRAINING' : 'ACTIVE')}
                className={cn(
                  "px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border transition-colors",
                  dutyStatus === 'TRAINING' ? "bg-cad-amber text-black border-cad-amber" : "bg-black/40 text-cad-muted border-cad-border hover:text-white"
                )}
              >
                {dutyStatus === 'TRAINING' ? 'TRAINING MODE' : 'ACTIVE DUTY'}
              </button>
              <button
                onClick={() => setIsARMode(true)}
                className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border bg-black/40 text-cad-cyan border-cad-cyan/50 hover:bg-cad-cyan hover:text-black transition-colors"
              >
                AR HUD
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Clock className={cn("w-3 h-3", dutyStatus === 'TRAINING' ? "text-cad-amber" : "text-cad-green")} />
              <span className="text-[10px] font-mono">{currentTime.toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-none",
                status === 'connected' ? (dutyStatus === 'TRAINING' ? "bg-cad-amber" : "bg-cad-green") : "bg-cad-red"
              )} />
              <span className="text-[10px] uppercase tracking-widest text-cad-muted">
                {status === 'connected' ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </nav>
      )}

      <main className="flex-1 p-2 overflow-hidden flex flex-col gap-2">
        <AnimatePresence mode="wait">
          {mode === 'FIELD' && (
            <motion.div 
              key="field"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col w-full gap-2"
            >
              <AnimatePresence mode="wait">
                {missionStatus === 'EN_ROUTE' ? (
                  <motion.div
                    key="map"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 min-h-0 border border-cad-border"
                  >
                    <MapView 
                      location={location} 
                      onArrive={() => {
                        setMissionStatus('ON_SCENE');
                        if (status !== 'connected') {
                          connect();
                          setIsFieldActive(true);
                        }
                      }} 
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="on-scene"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "gap-2 flex-1 min-h-0",
                      isARMode ? "flex flex-col fixed inset-0 z-50 bg-black" : "grid grid-cols-12"
                    )}
                  >
                    {/* Left Column: Visual Feed & Vitals */}
                    <div className={cn(
                      "flex flex-col gap-2",
                      isARMode ? "flex-1 h-full relative" : "col-span-12 lg:col-span-8"
                    )}>
                      <div className={cn(
                        "relative flex-1 border bg-black",
                        isARMode ? "border-transparent" : "min-h-[400px] border-cad-border"
                      )}>
                        <div className="absolute top-0 left-0 right-0 z-10 bg-cad-border/80 px-2 py-1 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-white uppercase">Visual Feed // Scene Analysis</span>
                          <div className="flex gap-2">
                            <div className={cn("w-2 h-2", isFieldActive ? "bg-cad-green" : "bg-cad-muted")} />
                            <span className="text-[8px] text-white/60">AI: {isFieldActive ? 'ACTIVE' : 'STANDBY'}</span>
                          </div>
                        </div>

                        <WebcamView 
                          active={isFieldActive} 
                          onAudio={sendAudio} 
                          onFrame={sendVideoFrame}
                          location={location}
                          hazards={hazards}
                          className={cn(
                            "w-full h-full object-cover contrast-125",
                            !isARMode && "grayscale",
                            hasSafetyAlert ? "ring-4 ring-cad-red ring-inset" : ""
                          )}
                        />
                        
                        <AnimatePresence>
                          {hasSafetyAlert && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute top-10 left-2 right-2 z-20"
                            >
                              <div className="bg-cad-red text-white px-4 py-2 flex items-center gap-4 border border-white/20">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest">10-33: EMERGENCY TRAFFIC</p>
                                  <p className="text-[8px] opacity-80 uppercase">AI DETECTED IMMEDIATE HAZARD</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
                          {isARMode && (
                            <button
                              onClick={() => setIsARMode(false)}
                              className="px-4 py-2 font-bold text-xs uppercase tracking-[0.2em] transition-all border bg-black/60 text-cad-cyan border-cad-cyan hover:bg-cad-cyan hover:text-black backdrop-blur-md"
                            >
                              EXIT AR HUD
                            </button>
                          )}
                          
                          {dutyStatus === 'TRAINING' && (
                            <button
                              onClick={triggerTrainingDispatch}
                              className="px-4 py-2 font-bold text-xs uppercase tracking-[0.2em] transition-all border bg-cad-amber text-black border-cad-amber hover:bg-white shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                            >
                              SIM DISPATCH
                            </button>
                          )}

                          <button
                            onClick={handleToggleField}
                            className={cn(
                              "px-6 py-2 font-bold text-xs uppercase tracking-[0.2em] transition-all border",
                              status === 'connected' 
                                ? "bg-cad-red/20 border-cad-red text-cad-red hover:bg-cad-red hover:text-white" 
                                : (dutyStatus === 'TRAINING' ? "bg-cad-amber text-black border-cad-amber hover:bg-white" : "bg-cad-green text-black border-cad-green hover:bg-white")
                            )}
                          >
                            {status === 'connected' ? '10-7 (OUT)' : '10-8 (IN)'}
                          </button>
                          
                          <button 
                            onClick={() => setMissionStatus('EN_ROUTE')}
                            className="p-2 bg-cad-surface border border-cad-border text-cad-muted hover:text-white hover:bg-cad-border transition-all"
                          >
                            <Navigation className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Vitals Grid - CAD Style */}
                      <div className={cn(
                        "grid grid-cols-3 gap-2",
                        isARMode ? "absolute top-10 right-2 w-48 grid-cols-1 z-20" : ""
                      )}>
                        {[
                          { label: 'HR', value: '72', unit: 'BPM', color: 'text-cad-green' },
                          { label: 'SPO2', value: '98', unit: '%', color: 'text-cad-cyan' },
                          { label: 'RESP', value: '16', unit: '/M', color: 'text-cad-amber' },
                        ].map((stat) => (
                          <div key={stat.label} className={cn(
                            "border p-2",
                            isARMode ? "bg-black/60 border-cad-border/50 backdrop-blur-sm" : "bg-cad-surface border-cad-border"
                          )}>
                            <div className="text-[8px] text-cad-muted uppercase mb-1">{stat.label}</div>
                            <div className="flex items-baseline gap-2">
                              <span className={cn("text-2xl font-bold", stat.color)}>{stat.value}</span>
                              <span className="text-[8px] text-cad-muted">{stat.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column: Comms & Lookup */}
                    {!isARMode && (
                      <div className="col-span-12 lg:col-span-4 flex flex-col gap-2">
                        <div className="flex-1 bg-cad-surface border border-cad-border flex flex-col overflow-hidden relative">
                        <div className="bg-cad-border px-2 py-1 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest">CAD COMMS // PROTOCOL</span>
                            {isFieldActive && (
                              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-cad-green/20 border border-cad-green/30">
                                <Languages className="w-3 h-3 text-cad-green" />
                                <span className="text-[8px] text-cad-green font-bold uppercase tracking-widest animate-pulse">AUTO-TRANSLATE: ON</span>
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => setIsLookupOpen(!isLookupOpen)}
                            className={cn(
                              "px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest transition-all border",
                              isLookupOpen ? "bg-cad-amber text-black border-cad-amber" : "bg-black/20 text-cad-muted border-cad-border hover:text-white"
                            )}
                          >
                            LOOKUP
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar font-mono text-[11px]">
                          {fieldTranscript.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-10">
                              <Activity className="w-8 h-8 mb-2" />
                              <p className="text-[10px] uppercase">Awaiting Data...</p>
                            </div>
                          ) : (
                            fieldTranscript.map((entry, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={cn(
                                  "p-2 border-l-2",
                                  entry.role === 'user' 
                                    ? "bg-white/5 border-cad-muted ml-4" 
                                    : "bg-cad-green/5 border-cad-green mr-4"
                                )}
                              >
                                <span className={cn(
                                  "text-[8px] font-bold uppercase block mb-1",
                                  entry.role === 'user' ? "text-cad-muted" : "text-cad-green"
                                )}>
                                  {entry.role === 'user' ? 'UNIT-01A' : 'DISPATCH-AI'}
                                </span>
                                <p className={entry.role === 'model' ? "text-cad-green" : "text-white/80"}>
                                  {entry.text}
                                </p>
                              </motion.div>
                            ))
                          )}
                        </div>

                        <AnimatePresence>
                          {isLookupOpen && (
                            <motion.div
                              initial={{ x: '100%' }}
                              animate={{ x: 0 }}
                              exit={{ x: '100%' }}
                              transition={{ type: 'tween', duration: 0.2 }}
                              className="absolute inset-0 z-30"
                            >
                              <TacticalLookup onClose={() => setIsLookupOpen(false)} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {mode === 'ASL' && (
            <motion.div
              key="asl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 min-h-0"
            >
              <ASLTranslator location={location} />
            </motion.div>
          )}

          {mode === 'TRANSLATOR' && (
            <motion.div
              key="translator"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 min-h-0"
            >
              <LanguageTranslator location={location} />
            </motion.div>
          )}

          {mode === 'TRAINING' && (
            <motion.div 
              key="training"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-5xl mx-auto h-full flex flex-col gap-4 w-full"
            >
              <div className="flex items-center justify-between bg-cad-surface border border-cad-border p-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest">EMS TRAINING SIMULATOR</h2>
                  <p className="text-[10px] text-cad-muted uppercase">INTERACTIVE SCENARIOS // MULTIMODAL FEEDBACK</p>
                </div>
                <button 
                  onClick={startNewSimulation}
                  disabled={simLoading}
                  className="px-4 py-2 bg-cad-green text-black font-bold text-[10px] uppercase tracking-widest hover:bg-white disabled:opacity-50 border border-cad-green"
                >
                  NEW SCENARIO
                </button>
              </div>

              <div className="flex-1 bg-cad-surface border border-cad-border overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {simHistory.length === 0 && !simLoading && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
                      <BookOpen className="w-12 h-12 mb-4" />
                      <p className="text-[10px] uppercase tracking-widest">INITIALIZE A NEW SCENARIO TO BEGIN TRAINING.</p>
                    </div>
                  )}

                  {currentSimImage && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative aspect-video overflow-hidden border border-cad-border bg-black"
                    >
                      <img src={currentSimImage} alt="Scenario Visual" className="w-full h-full object-cover grayscale contrast-125" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <ImageIcon className="w-3 h-3 text-cad-green" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-cad-green">AI GENERATED SCENE</span>
                      </div>
                    </motion.div>
                  )}

                  {simHistory.map((item, i) => (
                    <div key={i} className={cn(
                      "p-3 border",
                      item.role === 'user' ? "bg-black/40 border-cad-border ml-8" : "bg-cad-green/5 border-cad-green/30 mr-8"
                    )}>
                      <span className={cn(
                        "text-[9px] font-bold uppercase block mb-2",
                        item.role === 'user' ? "text-cad-muted" : "text-cad-green"
                      )}>
                        {item.role === 'user' ? 'RESPONDER ACTION' : 'SIMULATOR FEEDBACK'}
                      </span>
                      <div className="prose prose-invert prose-xs max-w-none uppercase text-[11px] leading-relaxed">
                        <Markdown>{item.parts[0].text}</Markdown>
                      </div>
                    </div>
                  ))}

                  {simLoading && (
                    <div className="flex items-center gap-3 text-cad-green font-bold text-[10px] animate-pulse uppercase tracking-widest">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      GENERATING SCENARIO DATA...
                    </div>
                  )}
                </div>

                <div className="p-3 bg-black/40 border-t border-cad-border flex gap-3">
                  <input 
                    type="text"
                    value={simInput}
                    onChange={(e) => setSimInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSimAction()}
                    placeholder="DESCRIBE YOUR NEXT ACTION (E.G., 'CHECK PULSE AND START COMPRESSIONS')"
                    className="flex-1 bg-black/60 border border-cad-border px-4 py-2 text-[11px] uppercase focus:outline-none focus:border-cad-green/50 text-white placeholder:text-cad-muted"
                  />
                  <button 
                    onClick={handleSimAction}
                    disabled={simLoading || !simInput.trim()}
                    className="w-10 h-10 bg-cad-green text-black flex items-center justify-center hover:bg-white disabled:opacity-50 border border-cad-green"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {mode === 'REPORT' && (
            <motion.div 
              key="report"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto h-full flex flex-col gap-4 w-full"
            >
              <div className="bg-cad-surface border border-cad-border p-3">
                <h2 className="text-sm font-bold uppercase tracking-widest">HANDOFF REPORT GENERATOR</h2>
                <p className="text-[10px] text-cad-muted uppercase">COMPILE FIELD NOTES INTO PROFESSIONAL DOCUMENTATION</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold uppercase text-cad-muted px-1">FIELD NOTES // INPUT</label>
                  <textarea 
                    value={reportInput}
                    onChange={(e) => setReportInput(e.target.value)}
                    placeholder="ENTER PATIENT HISTORY, VITALS, AND INTERVENTIONS..."
                    className="flex-1 bg-cad-surface border border-cad-border p-4 text-[11px] uppercase resize-none focus:outline-none focus:border-cad-green/50 custom-scrollbar text-white placeholder:text-cad-muted"
                  />
                  <button 
                    onClick={handleGenerateReport}
                    disabled={reportLoading || !reportInput.trim()}
                    className="py-3 bg-cad-green text-black font-bold uppercase tracking-widest hover:bg-white disabled:opacity-50 flex items-center justify-center gap-2 text-[10px] border border-cad-green"
                  >
                    {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    GENERATE REPORT
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold uppercase text-cad-muted px-1">STRUCTURED REPORT // OUTPUT</label>
                  <div className="flex-1 bg-cad-surface border border-cad-border p-4 overflow-y-auto custom-scrollbar relative">
                    {generatedReport ? (
                      <div className="prose prose-invert prose-xs max-w-none uppercase text-[11px] leading-relaxed">
                        <Markdown>{generatedReport}</Markdown>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
                        <FileText className="w-10 h-10 mb-4" />
                        <p className="text-[10px] uppercase tracking-widest">REPORT WILL APPEAR HERE.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SupportAssistant />

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}
