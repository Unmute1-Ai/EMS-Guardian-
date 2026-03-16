import React, { useRef, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';

interface WebcamViewProps {
  onFrame: (base64Frame: string) => void;
  onAudio: (base64Audio: string) => void;
  active: boolean;
  className?: string;
  location?: { lat: number; lng: number; crossStreets: string | null; accuracy: number | null } | null;
}

export function WebcamView({ onFrame, onAudio, active, className, location }: WebcamViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

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
      if (videoRef.current && canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
          context.drawImage(videoRef.current, 0, 0, 320, 240);
          const base64Frame = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
          onFrame(base64Frame);
        }
      }
    }, 1000); // 1 FPS for vision context

    return () => clearInterval(interval);
  }, [active, onFrame]);

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-black border border-white/10 shadow-2xl", className)}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover grayscale brightness-90 contrast-110"
      />
      <canvas ref={canvasRef} width={320} height={240} className="hidden" />
      
      {/* HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none border-[20px] border-transparent border-t-white/5 border-b-white/5">
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-mono text-white/50 tracking-widest uppercase">Live Stream // Field Unit 01</span>
        </div>
        <div className="absolute bottom-4 right-4 text-[10px] font-mono text-white/30 text-right">
          {location && location.lat !== 0 ? (
            <>
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="opacity-50">GPS ACCURACY: {getAccuracyLabel(location.accuracy)}</span>
                <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]", getAccuracyColor(location.accuracy))} />
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
  );
}
