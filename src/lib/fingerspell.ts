// Fingerspelling recognition logic — pure, no DOM, no network.
//
// The Gemini recognition path in the ASL translator treats the camera as a
// stream of per-frame samples. Three small pieces make that stream usable:
//
//   parseFingerspellResponse  — trusts model output only after Zod validation
//     (the model can wrap JSON in prose or fences, or hallucinate shapes).
//   createFingerspellAccumulator — majority-vote smoothing over a sliding
//     window so one noisy frame never lands in the word buffer, plus a repeat
//     cooldown so holding a handshape is the double-letter gesture.
//   createRecognitionGate — at most one recognition in flight; frames that
//     arrive while one is running are dropped, never queued.

import { z } from 'zod';

const fingerspellPayloadSchema = z.object({
  letter: z.string(),
  confidence: z.number(),
});

// Explicit type (not z.infer) so the contract stays required props regardless
// of Zod version inference quirks; the schema is the runtime guard.
export type FingerspellPayload = {
  letter: string;
  confidence: number;
};

// Pull the first JSON object out of a raw model response. Handles bare JSON,
// markdown-fenced JSON, and JSON embedded in surrounding prose.
function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

// Returns a normalized payload — `letter` is one uppercase A-Z letter or ''
// when the model saw no fingerspelled handshape — or null when the response
// cannot be trusted at all. Junk the model invents ("1", "AB", "HELLO") is
// rejected wholesale: a half-trusted letter is worse than a dropped frame, and
// junk must not be laundered into the no-handshape sentinel.
export function parseFingerspellResponse(raw: string): FingerspellPayload | null {
  const json = extractJsonObject(raw);
  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  const result = fingerspellPayloadSchema.safeParse(parsed);
  if (!result.success) return null;

  const letter = result.data.letter.trim().toUpperCase();
  if (letter !== '' && !isFingerspellLetter(letter)) return null;

  const confidence = Math.min(1, Math.max(0, result.data.confidence));
  return { letter, confidence };
}

export interface FingerSample {
  letter: string; // 'A'–'Z', or '' for "no fingerspelled handshape this frame"
  confidence: number; // model confidence for the frame, in [0,1]
}

export interface CommittedLetter {
  letter: string;
  confidence: number; // mean confidence of the frames that formed the quorum
}

export interface FingerspellAccumulator {
  // Feed one frame's sample. Returns the letter that committed on this
  // sample, or null when no new letter was committed.
  add(sample: FingerSample): CommittedLetter | null;
  reset(): void;
}

export interface AccumulatorOptions {
  // Sliding-window size and identical-letter quorum before a letter commits.
  windowSize?: number; // default 4
  quorum?: number; // default 3
  // Commits of the same letter must be at least this far apart (ms). A
  // deliberate hold is the double-letter gesture; anything closer together is
  // deduplicated as re-recognition of the same gesture.
  repeatCooldownMs?: number; // default 1500
  // Frames below this confidence vote as "no handshape" (a gap in the window).
  minSampleConfidence?: number; // default 0.5
  now?: () => number; // injectable clock for tests
}

const isFingerspellLetter = (letter: string): boolean => /^[A-Z]$/.test(letter);

export function createFingerspellAccumulator(options: AccumulatorOptions = {}): FingerspellAccumulator {
  const windowSize = options.windowSize ?? 4;
  const quorum = Math.max(2, Math.min(options.quorum ?? 3, windowSize));
  const repeatCooldownMs = options.repeatCooldownMs ?? 1500;
  const minSampleConfidence = options.minSampleConfidence ?? 0.5;
  const now = options.now ?? Date.now;

  let window: (FingerSample | null)[] = [];
  let lastCommitted: string | null = null;
  let lastCommitAt = -Infinity;

  return {
    add(sample: FingerSample): CommittedLetter | null {
      const votes = isFingerspellLetter(sample.letter) && sample.confidence >= minSampleConfidence;
      window.push(votes ? { letter: sample.letter, confidence: sample.confidence } : null);
      if (window.length > windowSize) window = window.slice(-windowSize);

      // Tally the window. A letter commits when it has `quorum` agreeing
      // frames; its confidence is the mean over those frames.
      const tally = new Map<string, { count: number; confidenceSum: number }>();
      for (const sampleOrGap of window) {
        if (sampleOrGap === null) continue;
        const entry = tally.get(sampleOrGap.letter) ?? { count: 0, confidenceSum: 0 };
        entry.count += 1;
        entry.confidenceSum += sampleOrGap.confidence;
        tally.set(sampleOrGap.letter, entry);
      }

      let best: { letter: string; count: number; confidenceSum: number } | null = null;
      for (const [letter, entry] of tally) {
        if (entry.count < quorum) continue;
        if (!best || entry.count > best.count) {
          best = { letter, count: entry.count, confidenceSum: entry.confidenceSum };
        }
      }
      if (!best) return null;

      const at = now();
      if (best.letter === lastCommitted && at - lastCommitAt < repeatCooldownMs) return null;

      lastCommitted = best.letter;
      lastCommitAt = at;
      window = [];
      return { letter: best.letter, confidence: best.confidenceSum / best.count };
    },

    reset(): void {
      window = [];
      lastCommitted = null;
      lastCommitAt = -Infinity;
    },
  };
}

export interface RecognitionGate {
  // True when the caller owns the single recognition slot.
  tryAcquire(): boolean;
  release(): void;
}

export function createRecognitionGate(): RecognitionGate {
  let inFlight = false;
  return {
    tryAcquire(): boolean {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    release(): void {
      inFlight = false;
    },
  };
}
