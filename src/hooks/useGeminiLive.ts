import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useGeminiLive(customInstruction?: string) {
  const [status, setStatus] = useState<ConnectionState>('disconnected');
  const [transcript, setTranscript] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const connect = useCallback(async () => {
    if (status === 'connected') return;
    
    setStatus('connecting');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    try {
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: customInstruction || `You are Guardian EMS AI, a high-performance tactical assistant for 911 EMTs and Paramedics. 
          Your primary directive is Responder Safety and Patient Care.
          
          SCENE ANALYSIS & SAFETY:
          - Continuously analyze the visual feed for hazards: traffic, downed power lines, fire, hazardous materials, or aggressive bystanders.
          - If a hazard is detected, interrupt immediately with a clear "SAFETY ALERT" and specific instructions.
          - Remind the responder of appropriate PPE (Gloves, Mask, Eye Pro) based on the scene context (e.g., blood, respiratory symptoms).
          
          PROTOCOL GUIDANCE:
          - Provide concise BLS/ALS protocol guidance.
          - Use medical terminology correctly.
          - Prioritize life-saving interventions (MARCH, ABCs).
          
          COMMUNICATION:
          - Be extremely concise. Use "Responder" to address the user.
          - You can hear and see everything in real-time.`,
        },
        callbacks: {
          onopen: () => {
            setStatus('connected');
            console.log("Connected to Gemini Live");
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn) {
              const part = message.serverContent.modelTurn.parts[0];
              if (part?.inlineData?.data) {
                playAudio(part.inlineData.data);
              }
              if (part?.text) {
                setTranscript(prev => [...prev, { role: 'model', text: part.text! }]);
              }
            }

            if (message.serverContent?.interrupted) {
              setIsInterrupted(true);
              stopAudio();
            }

            if (message.serverContent?.turnComplete) {
              setIsInterrupted(false);
            }
          },
          onclose: () => {
            setStatus('disconnected');
            console.log("Disconnected from Gemini Live");
          },
          onerror: (err) => {
            setStatus('error');
            console.error("Gemini Live Error:", err);
          }
        }
      });

      sessionRef.current = session;
    } catch (err) {
      setStatus('error');
      console.error("Failed to connect:", err);
    }
  }, [status]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const sendAudio = useCallback((base64Data: string) => {
    if (sessionRef.current && status === 'connected') {
      sessionRef.current.sendRealtimeInput({
        media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
      });
    }
  }, [status]);

  const sendVideoFrame = useCallback((base64Data: string) => {
    if (sessionRef.current && status === 'connected') {
      sessionRef.current.sendRealtimeInput({
        media: { data: base64Data, mimeType: 'image/jpeg' }
      });
    }
  }, [status]);

  const playAudio = async (base64Data: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pcmData = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768.0;
    }

    const buffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);

    const startTime = Math.max(audioContextRef.current.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
  };

  const stopAudio = () => {
    // In a real implementation, we'd keep track of active sources to stop them
    nextStartTimeRef.current = 0;
  };

  return {
    status,
    connect,
    disconnect,
    sendAudio,
    sendVideoFrame,
    transcript,
    isInterrupted
  };
}
