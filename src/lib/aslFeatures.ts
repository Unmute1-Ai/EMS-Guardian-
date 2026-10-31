// ASL pipeline — stage 3: feature extraction.
// Produces a 16-dim vector from a window of MediaPipe hand landmarks:
//   • 12 joint angles  (3 interior joints x 4 non-thumb fingers)
//   • 4  trajectory features: Δcx, Δcy, |Δc|, hand span
//
// Landmarks follow the MediaPipe Hands index convention (0 = wrist,
// 1-4 = thumb, 5-8 = index, 9-12 = middle, 13-16 = ring, 17-20 = pinky).

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type LandmarkFrame = Landmark[]; // length 21

export const FEATURE_DIM = 16;
export const ANGLE_COUNT = 12;
export const TRAJECTORY_COUNT = 4;

// Finger chains used for the 12 interior-joint angles. The wrist (0) anchors
// each chain; the fingertip is the chain end. The three interior joints are
// at indices 1, 2, 3 of each chain and each has one angle (between the two
// adjacent bones). Thumb is excluded — its MCP geometry is noisier and ASL
// features generalize better without it.
const FINGER_CHAINS: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 5, 6, 7, 8],      // index
  [0, 9, 10, 11, 12],   // middle
  [0, 13, 14, 15, 16],  // ring
  [0, 17, 18, 19, 20],  // pinky
];

function sub(a: Landmark, b: Landmark): [number, number, number] {
  return [a.x - b.x, a.y - b.y, a.z - b.z];
}

function dot(u: [number, number, number], v: [number, number, number]): number {
  return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
}

function norm(u: [number, number, number]): number {
  return Math.sqrt(dot(u, u));
}

// Angle between vectors (prev→joint) and (next→joint), in radians,
// clamped to [0, π]. A straight finger ≈ π; a fully folded joint ≈ 0.
function jointAngle(prev: Landmark, joint: Landmark, next: Landmark): number {
  const a = sub(prev, joint);
  const b = sub(next, joint);
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot(a, b) / (na * nb)));
  return Math.acos(cos);
}

function centroid(pts: LandmarkFrame): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  return [sx / pts.length, sy / pts.length];
}

// Palm span used to normalize trajectory magnitudes against camera distance.
// MCP joints 5 and 17 bracket the palm width in MediaPipe's layout.
function palmSpan(frame: LandmarkFrame): number {
  if (frame.length < 18) return 1;
  const [dx, dy, dz] = sub(frame[5], frame[17]);
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return d > 1e-6 ? d : 1;
}

export function extractAngles(frame: LandmarkFrame): number[] {
  const angles: number[] = [];
  for (const chain of FINGER_CHAINS) {
    for (let j = 1; j <= 3; j++) {
      angles.push(jointAngle(frame[chain[j - 1]], frame[chain[j]], frame[chain[j + 1]]));
    }
  }
  return angles; // length 12
}

// Trajectory features from a short window. Uses the last three frames'
// centroids: velocity = c[t] - c[t-2] averaged over 2 steps, normalized by
// palm span of the most recent frame so distance from camera cancels out.
export function extractTrajectory(window: LandmarkFrame[]): number[] {
  if (window.length === 0) return [0, 0, 0, 1];
  const last = window[window.length - 1];
  const span = palmSpan(last);

  if (window.length < 3) {
    return [0, 0, 0, span];
  }

  const c0 = centroid(window[window.length - 3]);
  const c2 = centroid(last);
  const dx = (c2[0] - c0[0]) / 2 / span;
  const dy = (c2[1] - c0[1]) / 2 / span;
  const mag = Math.sqrt(dx * dx + dy * dy);
  return [dx, dy, mag, span];
}

export function buildFeatureVector(window: LandmarkFrame[]): number[] {
  if (window.length === 0) return new Array(FEATURE_DIM).fill(0);
  const angles = extractAngles(window[window.length - 1]);
  const traj = extractTrajectory(window);
  return angles.concat(traj); // length 16
}
