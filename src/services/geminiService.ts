import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateSimulatorScenario(userAction?: string, history: any[] = []) {
  const prompt = userAction 
    ? `The trainee did: "${userAction}". Continue the EMS simulation. Provide feedback on their action and describe the next state of the patient. Include a visual description for an image generation.`
    : `Start a new realistic EMS emergency scenario. Describe the scene and the patient's initial presentation. Include a visual description for an image generation.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [...history, { role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: "You are an EMS Training Simulator. Provide realistic scenarios. Your responses should be structured with 'Feedback', 'Scenario Update', and 'Visual Prompt'.",
    }
  });

  return response;
}

export async function generateImage(prompt: string) {
  const response = await ai.models.generateContent({
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
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: `Generate a professional EMS handoff report based on these notes: ${input}` }] }],
    config: {
      systemInstruction: "You are an expert EMS documentation assistant. Format the report using standard SOAP or MIST format. Be professional and concise.",
    }
  });

  return response.text;
}

export async function translateGlosstoEnglish(glosses: string[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: 'user', parts: [{ text: `Translate these ASL glosses into natural, professional English: ${glosses.join(' ')}` }] }],
    config: {
      systemInstruction: "You are the NVIDIA Nemotron linguistic bridge. Convert ASL Glosses (V-to-G output) into fluent, natural English. Be concise and accurate.",
    }
  });

  return response.text;
}

export async function translateEnglishtoASL(text: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: 'user', parts: [{ text: `Convert this English sentence into ASL Glosses: ${text}` }] }],
    config: {
      systemInstruction: "You are the NVIDIA Nemotron linguistic bridge. Convert English text into ASL Glosses for an avatar to perform. Use standard ASL syntax (Time-Topic-Comment).",
    }
  });

  return response.text;
}

export async function findClosestHospital(lat: number, lng: number) {
  const response = await ai.models.generateContent({
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
  const response = await ai.models.generateContent({
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
