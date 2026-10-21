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

export type Agency = "EMS" | "FIRE" | "POLICE";

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
    // Voices and the API key live on the server (server/index.ts)
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 1000), agency }),
    });
    if (!res.ok) throw new Error(`TTS failed (${res.status})`);
    const blob = await res.blob();
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
