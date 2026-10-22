// Copies MediaPipe Hands runtime files into public/ so the app never needs a CDN.
import { cpSync, mkdirSync } from "node:fs";
const dest = "public/mediapipe/hands";
mkdirSync(dest, { recursive: true });
cpSync("node_modules/@mediapipe/hands", dest, {
  recursive: true,
  filter: (src) => !/(package\.json|README\.md|index\.d\.ts)$/.test(src),
});
console.log(`MediaPipe assets -> ${dest}`);
