/**
 * Demo build flag and seeded demo mission state.
 *
 * `VITE_DEMO_MODE=true` is set only by the `build:demo` npm script. It is read
 * at module scope so Vite statically replaces `import.meta.env` in production
 * builds and dead-code-eliminates every demo-only path that depends on it —
 * production bundles neither render the badge nor seed the transcript.
 */

/** True only in demo builds (`npm run build:demo`). */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export interface DemoTranscriptEntry {
  role: 'user' | 'model';
  text: string;
}

/**
 * Seeded dispatch transcript so the CAD COMMS panel is never empty on first
 * open. Sample data only — explicitly labeled as simulated, no real PHI.
 */
export const DEMO_MISSION_SEED: DemoTranscriptEntry[] = [
  {
    role: 'model',
    text: 'SIMULATED DISPATCH — Unit 01-A, respond Priority 2: reported cardiac arrest at 45 Maple Ave & 3rd St. EMS agency default, sample scenario.',
  },
  {
    role: 'model',
    text: 'DEMO SAMPLE DATA — no live dispatch and no real PHI. Tap 10-8 (IN) to open an AI field session, or switch modes above.',
  },
];
