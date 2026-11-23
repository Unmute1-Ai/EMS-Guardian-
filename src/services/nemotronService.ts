// NVIDIA Nemotron linguistic bridge for ASL glosses.
//
// The ASL HUD labels this stage "NEMOTRON BRIDGE / NVIDIA Nemotron". Earlier
// implementations routed the call to Gemini despite the label; this module
// actually calls NVIDIA's NIM-hosted Nemotron endpoint so the label matches
// the runtime.
//
// NIM exposes an OpenAI-compatible chat/completions endpoint at
// https://integrate.api.nvidia.com/v1. Auth is a bearer token in the
// Authorization header. The key is baked at build time via vite.config.ts's
// `define` block (same pattern as GEMINI_API_KEY) so it never ships to the
// browser unless a build intentionally includes it.

const NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'nvidia/llama-3.1-nemotron-70b-instruct';

export function hasNvidiaApiKey(): boolean {
  return typeof process.env.NVIDIA_API_KEY === 'string' && process.env.NVIDIA_API_KEY.length > 0;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

async function nemotronChat(system: string, user: string): Promise<string | undefined> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    console.error('nemotronChat: NVIDIA_API_KEY is not set');
    return undefined;
  }
  const model = process.env.NVIDIA_NIM_MODEL || DEFAULT_MODEL;

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  const res = await fetch(`${NIM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 256,
      stream: false,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`nemotronChat: ${res.status} ${res.statusText} ${detail.slice(0, 200)}`);
    return undefined;
  }

  const payload = (await res.json()) as ChatCompletionResponse;
  return payload.choices?.[0]?.message?.content?.trim() || undefined;
}

export async function translateGlosstoEnglish(glosses: string[]): Promise<string | undefined> {
  if (glosses.length === 0) return undefined;
  const system =
    'You are the NVIDIA Nemotron linguistic bridge. Convert ASL Glosses (V-to-G output) into fluent, natural English. Be concise and accurate. Reply with just the English sentence, no preamble.';
  const user = `Translate these ASL glosses into natural, professional English: ${glosses.join(' ')}`;
  return nemotronChat(system, user);
}

export async function translateEnglishtoASL(text: string): Promise<string | undefined> {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const system =
    'You are the NVIDIA Nemotron linguistic bridge. Convert English text into ASL Glosses for an avatar to perform. Use standard ASL syntax (Time-Topic-Comment). Reply with just the gloss sequence in UPPERCASE separated by single spaces, no preamble.';
  const user = `Convert this English sentence into ASL Glosses: ${trimmed}`;
  return nemotronChat(system, user);
}
