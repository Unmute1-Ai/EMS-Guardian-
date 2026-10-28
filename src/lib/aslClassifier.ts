// ASL pipeline — stage 5: sign classifier.
//
// Expert 1 of the Mixture-of-Experts design. Takes the 16-dim feature
// vector from aslFeatures.ts and returns a gloss id + a real softmax
// score. Two execution paths:
//
//   • If a TFJS model is wired via setClassifierModel(predict), use it.
//     `predict` must accept the 16-dim feature vector and return raw
//     logits of length GLOSS_LABELS.length.
//   • Otherwise, fall back to a transparent, deterministic heuristic
//     that classifies on finger openness + motion magnitude. This is
//     not training-grade, but it responds to actual hand shape instead
//     of Math.random(), so the UI is a faithful preview of the real
//     pipeline and swapping in a model is a one-liner.

import { ANGLE_COUNT, FEATURE_DIM } from './aslFeatures';

export const GLOSS_LABELS = [
  'HELLO',
  'NEED',
  'HELP',
  'PAIN',
  'CHEST',
  'PATIENT',
  'STABLE',
  'BREATHING',
] as const;

export type Gloss = typeof GLOSS_LABELS[number];

export interface Prediction {
  id: number;
  gloss: Gloss;
  confidence: number; // softmax probability of the picked class, in [0,1]
}

export type ModelPredictFn = (feat: number[]) => number[] | Promise<number[]>;

let modelPredict: ModelPredictFn | null = null;

export function setClassifierModel(fn: ModelPredictFn | null): void {
  modelPredict = fn;
}

export function hasClassifierModel(): boolean {
  return modelPredict !== null;
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map(l => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return sum > 0 ? exps.map(e => e / sum) : exps.map(() => 1 / exps.length);
}

function argmax(xs: number[]): number {
  let best = -Infinity;
  let idx = 0;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > best) {
      best = xs[i];
      idx = i;
    }
  }
  return idx;
}

// Heuristic logits derived from the real feature vector. We bucket each
// gloss by hand openness (closed fist vs flat hand vs mixed) and by motion
// magnitude. Each gloss gets a prototype vector in that 2-D space and the
// logit is the negative squared distance — so argmax picks the nearest
// prototype and softmax gives a usable confidence instead of a constant.
//
// Prototypes: [opennessMean, motionMag]
//   openness is the mean interior-joint angle in radians (0 = fist, π = flat).
//   motionMag is the trajectory magnitude feature (index 14).
const PROTOTYPES: Record<Gloss, [number, number]> = {
  HELLO:     [2.9, 0.08],   // flat hand, light wave
  NEED:      [1.4, 0.03],   // mostly closed, small motion
  HELP:      [2.4, 0.12],   // open-ish, upward motion
  PAIN:      [1.1, 0.02],   // fists, tight
  CHEST:     [2.6, 0.015],  // flat hand, near-static (tap)
  PATIENT:   [1.7, 0.01],   // partial fist, static
  STABLE:    [2.8, 0.005],  // flat, held
  BREATHING: [2.1, 0.06],   // mid-open, moderate motion
};

function heuristicLogits(feat: number[]): number[] {
  let openSum = 0;
  for (let i = 0; i < ANGLE_COUNT; i++) openSum += feat[i];
  const openness = openSum / ANGLE_COUNT;
  const motionMag = feat[ANGLE_COUNT + 2]; // trajectory[2] = |Δc|
  const logits: number[] = [];
  for (const label of GLOSS_LABELS) {
    const [po, pm] = PROTOTYPES[label];
    const do2 = openness - po;
    const dm = (motionMag - pm) * 20; // scale motion into same range as openness (radians)
    logits.push(-(do2 * do2 + dm * dm));
  }
  return logits;
}

export async function classify(feat: number[]): Promise<Prediction> {
  if (feat.length !== FEATURE_DIM) {
    throw new Error(`classify: expected ${FEATURE_DIM} features, got ${feat.length}`);
  }
  const logits = modelPredict ? await modelPredict(feat) : heuristicLogits(feat);
  if (logits.length !== GLOSS_LABELS.length) {
    throw new Error(
      `classify: model returned ${logits.length} logits, expected ${GLOSS_LABELS.length}`,
    );
  }
  const probs = softmax(logits);
  const id = argmax(probs);
  return { id, gloss: GLOSS_LABELS[id], confidence: probs[id] };
}
