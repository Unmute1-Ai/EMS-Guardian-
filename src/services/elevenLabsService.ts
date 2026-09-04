/**
 * ElevenLabs Voice Service
 * High-quality TTS for alerts, status changes, and reports
 * Uses Flash model for lowest latency (~75ms)
 *
 * Agency voices:
 * - EMS: calm, clear medical voice
 * - FIRE: strong command voice
 * - POLICE: steady tactical voice
 */

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export type Agency = "EMS" | "FIRE" | "POLICE";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY || (import.meta as any).env?.VITE_ELEVENLABS_API_KEY,
});

// Replace these with your preferred voice IDs from the ElevenLabs dashboard
const VOICES: Record<Agency, string> = {
  EMS: "pNInz6obpgDQGcFmaJgB", // calm, clear medical
  FIRE: "EXAVITQu4vr4xnSDxMaL", // strong command
  POLICE: "21m00Tcm4TlvDq8ikWAM", // steady tactical
};

let currentAudio: HTMLAudioElement | null = null;

/**
 * Speak text using the agency-specific voice.
 * Automatically stops any currently playing speech.
 */
export async function speak(text: string, agency: Agency = "EMS"): Promise<void> {
  if (!text.trim()) return;

  // Stop any existing playback
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    const audioStream = await client.textToSpeech.stream(VOICES[agency], {
      text: text.slice(0, 1000), // safety limit
      modelId: "eleven_flash_v2_5", // lowest latency
      outputFormat: "mp3_44100_128",
    });

    // Convert stream to blob and play
    const chunks: Uint8Array[] = [];
    for await (const chunk of audioStream) {
      if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      }
    }

    const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);

    currentAudio = new Audio(url);
    currentAudio.volume = 0.9;

    await currentAudio.play();

    currentAudio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
    };
  } catch (err) {
    console.error("ElevenLabs speak error:", err);
  }
}

/** Quick helpers for common first-responder phrases */
export const announce = {
  agencySelected: (agency: Agency) =>
    speak(`${agency} selected. Guardian online.`, agency),

  statusInService: (agency: Agency) =>
    speak("Unit is 10-8, in service.", agency),

  statusOutOfService: (agency: Agency) =>
    speak("Unit is 10-7, out of service.", agency),

  safetyAlert: (message: string, agency: Agency) =>
    speak(`Safety alert. ${message}`, agency),

  mayday: (agency: Agency = "FIRE") =>
    speak("Mayday, Mayday, Mayday. Firefighter down.", agency),
};
