import React, { useState, useEffect, useRef } from 'react';
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
  Navigation
} from 'lucide-react';
import Markdown from 'react-markdown';
import { WebcamView } from './components/WebcamView';
import { ASLTranslator } from './components/ASLTranslator';
import { LanguageTranslator } from './components/LanguageTranslator';
import { MapView } from './components/MapView';
import { SupportAssistant } from './components/SupportAssistant';
import { useGeminiLive } from './hooks/useGeminiLive';
import { generateSimulatorScenario, generateImage, generateHandoffReport, getCrossStreets } from './services/geminiService';
import { cn } from './lib/utils';

type AppMode = 'FIELD' | 'TRAINING' | 'REPORT' | 'ASL' | 'TRANSLATOR';
type MissionStatus = 'EN_ROUTE' | 'ON_SCENE';

export default function App() {
  const [mode, setMode] = useState<AppMode>('FIELD');
  const [missionStatus, setMissionStatus] = useState<MissionStatus>('EN_ROUTE');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Field Assistant State
  const { status, connect, disconnect, sendAudio, sendVideoFrame, transcript: fieldTranscript } = useGeminiLive();
  const [isFieldActive, setIsFieldActive] = useState(false);
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
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans flex flex-col">
      {/* Top Navigation Rail */}
      <nav className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0D0D0D] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center shadow-lg shadow-emerald-900/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight uppercase">Guardian EMS</h1>
            <p className="text-[10px] text-white/40 font-mono leading-none">Tactical Medical Suite v3.0</p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
          {[
            { id: 'FIELD', icon: Stethoscope, label: 'Field' },
            { id: 'TRANSLATOR', icon: Globe, label: 'Translate' },
            { id: 'TRAINING', icon: BookOpen, label: 'Training' },
            { id: 'REPORT', icon: FileText, label: 'Report' },
            { id: 'ASL', icon: Languages, label: 'ASL' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setMode(item.id as AppMode)}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                mode === item.id ? "bg-emerald-600 text-white shadow-lg" : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-3 h-3" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <Clock className="w-3 h-3 text-emerald-500" />
            <span className="text-xs font-mono">{currentTime.toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              status === 'connected' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500"
            )} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/60">
              {status === 'connected' ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </nav>

      <main className="flex-1 p-6 overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {mode === 'FIELD' && (
            <motion.div 
              key="field"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 flex flex-col max-w-[1600px] mx-auto w-full"
            >
              <AnimatePresence mode="wait">
                {missionStatus === 'EN_ROUTE' ? (
                  <motion.div
                    key="map"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="flex-1 min-h-0"
                  >
                    <MapView 
                      location={location} 
                      onArrive={() => {
                        setMissionStatus('ON_SCENE');
                        handleToggleField(); // Auto-initialize AI on arrival
                      }} 
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="on-scene"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="grid grid-cols-12 gap-6 flex-1 min-h-0"
                  >
                    {/* Left Column: Visual Feed */}
                    <div className="col-span-12 lg:col-span-7 space-y-6 flex flex-col">
                      <div className="relative group flex-1 min-h-[400px]">
                        <WebcamView 
                          active={isFieldActive} 
                          onAudio={sendAudio} 
                          onFrame={sendVideoFrame}
                          location={location}
                          className={cn(
                            "w-full h-full transition-all duration-500",
                            hasSafetyAlert ? "ring-4 ring-red-500 ring-offset-4 ring-offset-black" : ""
                          )}
                        />
                        
                        <AnimatePresence>
                          {hasSafetyAlert && (
                            <motion.div
                              initial={{ opacity: 0, y: -20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[90%]"
                            >
                              <div className="bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4 animate-pulse border-2 border-white/20">
                                <AlertCircle className="w-6 h-6 shrink-0" />
                                <div>
                                  <p className="text-xs font-black uppercase tracking-[0.2em]">Safety Alert Detected</p>
                                  <p className="text-[10px] font-mono opacity-80 uppercase">AI Scene Analysis: Immediate Hazard Identified</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="absolute top-6 left-6 flex flex-col gap-2">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
                            <div className={cn("w-2 h-2 rounded-full", isFieldActive ? "bg-emerald-500 animate-pulse" : "bg-white/20")} />
                            <span className="text-[10px] font-mono uppercase tracking-widest">Vision: {isFieldActive ? 'Active' : 'Standby'}</span>
                          </div>
                          {isFieldActive && (
                            <motion.div 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 backdrop-blur-md rounded-lg border border-emerald-500/30"
                            >
                              <Scan className="w-3 h-3 text-emerald-500" />
                              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500">Scene Analysis Running</span>
                            </motion.div>
                          )}
                        </div>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                          <button
                            onClick={handleToggleField}
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
                                <span>END MISSION</span>
                              </>
                            ) : (
                              <>
                                <Mic className="w-5 h-5" />
                                <span>INITIALIZE UNIT</span>
                              </>
                            )}
                          </button>
                          
                          <button 
                            onClick={() => setMissionStatus('EN_ROUTE')}
                            className="p-4 bg-white/5 border border-white/10 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all"
                            title="Return to Navigation"
                          >
                            <Navigation className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { label: 'HEART RATE', value: '72', unit: 'BPM', icon: HeartPulse, color: 'text-rose-500' },
                          { label: 'SPO2', value: '98', unit: '%', icon: Activity, color: 'text-emerald-500' },
                          { label: 'RESPIRATION', value: '16', unit: '/MIN', icon: Scan, color: 'text-blue-500' },
                        ].map((stat) => (
                          <div key={stat.label} className="bg-[#111] border border-white/5 p-4 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-mono text-white/40 tracking-wider uppercase">{stat.label}</span>
                              <stat.icon className={cn("w-4 h-4", stat.color)} />
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold font-mono">{stat.value}</span>
                              <span className="text-[10px] text-white/30 font-mono">{stat.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column: Comms */}
                    <div className="col-span-12 lg:col-span-5 flex flex-col h-full">
                      <div className="flex-1 bg-[#111] border border-white/5 rounded-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold uppercase tracking-widest">Protocol Intelligence</span>
                          </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                          {fieldTranscript.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                              <Activity className="w-12 h-12 mb-4" />
                              <p className="text-sm font-mono">Awaiting field input...</p>
                            </div>
                          ) : (
                            fieldTranscript.map((entry, i) => (
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
                                <span className="text-[10px] font-bold uppercase text-white/40 block mb-1">
                                  {entry.role === 'user' ? 'Responder' : 'Guardian AI'}
                                </span>
                                <p className={entry.role === 'model' ? "text-emerald-50" : "text-white/80"}>
                                  {entry.text}
                                </p>
                              </motion.div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
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
              className="max-w-4xl mx-auto h-full flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">EMS Training Simulator</h2>
                  <p className="text-sm text-white/40">Interactive scenarios with multimodal feedback.</p>
                </div>
                <button 
                  onClick={startNewSimulation}
                  disabled={simLoading}
                  className="px-6 py-2 bg-emerald-600 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50"
                >
                  New Scenario
                </button>
              </div>

              <div className="flex-1 bg-[#111] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {simHistory.length === 0 && !simLoading && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                      <BookOpen className="w-16 h-16 mb-4" />
                      <p>Initialize a new scenario to begin training.</p>
                    </div>
                  )}

                  {currentSimImage && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative aspect-video rounded-xl overflow-hidden border border-white/10"
                    >
                      <img src={currentSimImage} alt="Scenario Visual" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-4 left-4 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-mono uppercase tracking-widest">AI Generated Scene</span>
                      </div>
                    </motion.div>
                  )}

                  {simHistory.map((item, i) => (
                    <div key={i} className={cn(
                      "p-4 rounded-xl",
                      item.role === 'user' ? "bg-white/5 border-l-2 border-white/20" : "bg-emerald-500/5 border-l-2 border-emerald-500"
                    )}>
                      <span className="text-[10px] font-bold uppercase text-white/40 block mb-2">
                        {item.role === 'user' ? 'Your Action' : 'Simulator'}
                      </span>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <Markdown>{item.parts[0].text}</Markdown>
                      </div>
                    </div>
                  ))}

                  {simLoading && (
                    <div className="flex items-center gap-3 text-emerald-500 font-mono text-xs animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      GENERATING SCENARIO DATA...
                    </div>
                  )}
                </div>

                <div className="p-4 bg-black/40 border-t border-white/5 flex gap-4">
                  <input 
                    type="text"
                    value={simInput}
                    onChange={(e) => setSimInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSimAction()}
                    placeholder="Describe your next action (e.g., 'Check pulse and start compressions')"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                  <button 
                    onClick={handleSimAction}
                    disabled={simLoading || !simInput.trim()}
                    className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
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
              className="max-w-3xl mx-auto h-full flex flex-col gap-6"
            >
              <div>
                <h2 className="text-xl font-bold">Handoff Report Generator</h2>
                <p className="text-sm text-white/40">Compile field notes into professional documentation.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden">
                <div className="flex flex-col gap-4">
                  <label className="text-[10px] font-bold uppercase text-white/40">Field Notes</label>
                  <textarea 
                    value={reportInput}
                    onChange={(e) => setReportInput(e.target.value)}
                    placeholder="Enter patient history, vitals, and interventions..."
                    className="flex-1 bg-[#111] border border-white/5 rounded-2xl p-6 text-sm resize-none focus:outline-none focus:border-emerald-500/50 custom-scrollbar"
                  />
                  <button 
                    onClick={handleGenerateReport}
                    disabled={reportLoading || !reportInput.trim()}
                    className="py-4 bg-emerald-600 rounded-xl font-bold uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {reportLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                    Generate Report
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  <label className="text-[10px] font-bold uppercase text-white/40">Structured Report</label>
                  <div className="flex-1 bg-[#111] border border-white/5 rounded-2xl p-6 overflow-y-auto custom-scrollbar relative">
                    {generatedReport ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <Markdown>{generatedReport}</Markdown>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                        <FileText className="w-12 h-12 mb-4" />
                        <p className="text-xs">Report will appear here.</p>
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
