import { GoogleGenAI, Type } from "@google/genai";
import { parseFingerspellResponse } from '../lib/fingerspell';
import type { FingerspellPayload } from '../lib/fingerspell';

// Constructed on first use: without a baked key (e.g. a demo build before keys
// are injected) the SDK throws at construction — eagerly that takes the whole
// app down at module-evaluation time. With a key present, behavior is
// identical; without one, AI calls reject cleanly and the field UI stays up.
let aiInstance: GoogleGenAI | null = null;

function getAi(): GoogleGenAI {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiInstance;
}

// Static build-time define (see vite.config.ts): true in builds made with a
// key, false otherwise. ASL mode uses it to pick the real fingerspelling
// path vs the offline heuristic preview.
export function hasGeminiApiKey(): boolean {
  return typeof process.env.GEMINI_API_KEY === 'string' && process.env.GEMINI_API_KEY.length > 0;
}

export async function generateSimulatorScenario(userAction?: string, history: any[] = []) {
  const prompt = userAction 
    ? `The trainee did: "${userAction}". Continue the EMS simulation. Provide feedback on their action and describe the next state of the patient. Include a visual description for an image generation.`
    : `Start a new realistic EMS emergency scenario. Describe the scene and the patient's initial presentation. Include a visual description for an image generation.`;

  const response = await getAi().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [...history, { role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: "You are an EMS Training Simulator. Provide realistic scenarios. Your responses should be structured with 'Feedback', 'Scenario Update', and 'Visual Prompt'.",
    }
  });

  return response;
}

export async function generateImage(prompt: string) {
  const response = await getAi().models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ parts: [{ text: `EMS training scene: ${prompt}. Professional, realistic, medical context.` }] }],
    config: {
      imageConfig: {
        aspectRatio: "16:9",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}

export async function generateHandoffReport(input: string) {
  const response = await getAi().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: `Generate a professional EMS handoff report based on these notes: ${input}` }] }],
    config: {
      systemInstruction: "You are an expert EMS documentation assistant. Format the report using standard SOAP or MIST format. Be professional and concise.",
    }
  });

  return response.text;
}

export async function translateGlosstoEnglish(glosses: string[]) {
  const response = await getAi().models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: 'user', parts: [{ text: `Translate these ASL glosses into natural, professional English: ${glosses.join(' ')}` }] }],
    config: {
      systemInstruction: "You are the NVIDIA Nemotron linguistic bridge. Convert ASL Glosses (V-to-G output) into fluent, natural English. Be concise and accurate.",
    }
  });

  return response.text;
}

export async function translateEnglishtoASL(text: string) {
  const response = await getAi().models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: 'user', parts: [{ text: `Convert this English sentence into ASL Glosses: ${text}` }] }],
    config: {
      systemInstruction: "You are the NVIDIA Nemotron linguistic bridge. Convert English text into ASL Glosses for an avatar to perform. Use standard ASL syntax (Time-Topic-Comment).",
    }
  });

  return response.text;
}

export async function findClosestHospital(lat: number, lng: number) {
  const response = await getAi().models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Find the closest hospitals with emergency rooms to my current location. List their names, addresses, and estimated travel time if possible.",
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lng
          }
        }
      }
    },
  });
  return response;
}

export async function getCrossStreets(lat: number, lng: number) {
  const response = await getAi().models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Identify the closest major cross streets to these coordinates. Return ONLY the cross streets in the format 'STREET A & STREET B'.",
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lng
          }
        }
      }
    },
  });
  return response.text;
}

// --- ASL fingerspelling (the real recognition path for ASL mode) ------------

const FINGERSPELL_MODEL = 'gemini-2.5-flash';

const FINGERSPELL_SYSTEM_PROMPT = [
  'You read ASL fingerspelling from a single video frame of one hand.',
  'Identify which letter A-Z the hand is fingerspelling.',
  'Reply only with JSON: {"letter": "X", "confidence": 0.93}.',
  '"letter" is one uppercase letter, or "" when no clearly fingerspelled handshape is visible.',
  '"confidence" is your certainty in the identification, from 0 to 1.',
  'J and Z are drawn with motion, not held: if the handshape and pose match the start or middle of a J or Z, report it with proportionally lower confidence.',
].join(' ');

// Reads one captured camera frame (any image data URL) and returns the
// recognized letter + confidence, or null when the frame shows no
// fingerspelled handshape or the response cannot be trusted. Throws on
// transport/API errors so callers can log them.
export async function recognizeFingerspell(frameDataUrl: string): Promise<FingerspellPayload | null> {
  const base64 = frameDataUrl.replace(/^data:[^,]+,/, '');
  const response = await getAi().models.generateContent({
    model: FINGERSPELL_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: 'Read the fingerspelled letter in this frame.' },
      ],
    }],
    config: {
      systemInstruction: FINGERSPELL_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          letter: {
            type: Type.STRING,
            description: 'Single uppercase A-Z letter, or "" when no fingerspelled handshape is visible',
          },
          confidence: {
            type: Type.NUMBER,
            description: 'Certainty in the identification, from 0 to 1',
          },
        },
        required: ['letter', 'confidence'],
      },
    },
  });

  const raw = response.text;
  if (!raw) {
    console.error('recognizeFingerspell: Gemini returned an empty response');
    return null;
  }

  const payload = parseFingerspellResponse(raw);
  if (!payload) {
    console.error('recognizeFingerspell: unparseable response:', raw.slice(0, 200));
    return null;
  }
  return payload;
}
