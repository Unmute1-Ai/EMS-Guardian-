import React, { useRef, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';

export interface Hazard {
  type: string;
  box: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  confidence: number;
}

interface WebcamViewProps {
  onFrame: (base64Frame: string) => void;
  onAudio: (base64Audio: string) => void;
  active: boolean;
  className?: string;
  location?: { lat: number; lng: number; crossStreets: string | null; accuracy: number | null } | null;
  hazards?: Hazard[];
}

export function WebcamView({ onFrame, onAudio, active, className, location, hazards }: WebcamViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

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

  useEffect(() => {
    if (!active) {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      return;
    }

    async function setupStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: 15 },
          audio: true
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Setup Audio Capture
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
        const source = audioContextRef.current.createMediaStreamSource(stream);
        processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

        processorRef.current.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
          }
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          onAudio(base64Audio);
        };

        source.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);

      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    }

    setupStream();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [active, onAudio]);

  // Capture Video Frames
  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
          context.drawImage(videoRef.current, 0, 0, 320, 240);
          const base64Frame = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
          onFrame(base64Frame);
        }
      }
    }, 500); // Increased from 1000ms to 500ms (2 FPS) for lower latency vision

    return () => clearInterval(interval);
  }, [active, onFrame]);

  return (
    <div className={cn("relative overflow-hidden rounded-none bg-black border border-cad-border shadow-2xl font-mono", className)}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover contrast-125"
      />
      <canvas ref={canvasRef} width={320} height={240} className="hidden" />
      
      {/* HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none border-[1px] border-cad-border/20">
        {/* Corner Brackets */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cad-green/40" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cad-green/40" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cad-green/40" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cad-green/40" />

        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/40 px-2 py-0.5 border border-cad-border">
          <div className="w-1.5 h-1.5 rounded-none bg-cad-red animate-pulse" />
          <span className="text-[9px] font-bold text-white/80 tracking-widest uppercase">REC // UNIT 01-A</span>
        </div>

        <div className="absolute bottom-3 right-3 text-[9px] text-right space-y-0.5">
          {location && location.lat !== 0 ? (
            <div className="bg-black/40 p-2 border border-cad-border">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="text-cad-muted uppercase tracking-tighter">GPS: {getAccuracyLabel(location.accuracy)}</span>
                <div className={cn("w-1.5 h-1.5", getAccuracyColor(location.accuracy))} />
              </div>
              <div className="text-cad-cyan uppercase tracking-tighter">X-ST: {location.crossStreets || 'LOCATING...'}</div>
              <div className="text-cad-muted opacity-50 tracking-tighter">LAT: {location.lat.toFixed(4)} | LON: {location.lng.toFixed(4)}</div>
            </div>
          ) : (
            <div className="bg-black/40 px-2 py-1 border border-cad-border text-cad-amber animate-pulse">
              INITIALIZING TACTICAL GPS...
            </div>
          )}
        </div>

        {/* Center Crosshair */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-8 h-[1px] bg-cad-green" />
          <div className="h-8 w-[1px] bg-cad-green" />
        </div>

        {/* Hazard Overlays */}
        {hazards?.map((hazard, index) => (
          <div
            key={index}
            className="absolute border-2 border-cad-red bg-cad-red/10 pointer-events-none flex flex-col"
            style={{
              top: `${hazard.box[0] / 10}%`,
              left: `${hazard.box[1] / 10}%`,
              width: `${(hazard.box[3] - hazard.box[1]) / 10}%`,
              height: `${(hazard.box[2] - hazard.box[0]) / 10}%`,
            }}
          >
            <div className="bg-cad-red text-white text-[8px] font-bold px-1 uppercase self-start whitespace-nowrap">
              {hazard.type} ({Math.round(hazard.confidence * 100)}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
