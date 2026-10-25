/**
 * EMS Guardian API server.
 * Holds the Gemini and ElevenLabs keys so they never ship in the browser bundle,
 * and serves the built SPA from dist/ in production.
 */
import "./env";

import path from "path";
import { pathToFileURL } from "url";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Modality } from "@google/genai";
import * as gemini from "./gemini";
import { requireAuth, authConfigured, authDisabled, type AuthedRequest } from "./auth";

const PROD = process.env.NODE_ENV === "production" || process.argv.includes("--production");

/*
 * COMPLIANCE_MODE = "hipaa" | "fedramp" makes the server refuse unsafe configurations
 * at startup (fail closed) instead of discovering them in an audit.
 *  hipaa:   sign-in required; Gemini only via Vertex AI (covered by Google Cloud BAA);
 *           ElevenLabs only if ELEVENLABS_BAA=true (enterprise BAA on file).
 *  fedramp: everything in hipaa, plus no non-FedRAMP processors: ElevenLabs is off
 *           (spoken alerts use the device voice); Gemini Live is off.
 */
const MODE = (process.env.COMPLIANCE_MODE || "").toLowerCase();
const STRICT = MODE === "hipaa" || MODE === "fedramp";
export const ttsAllowed =
  Boolean(process.env.ELEVENLABS_API_KEY) && MODE !== "fedramp" && (MODE !== "hipaa" || process.env.ELEVENLABS_BAA === "true");
const liveAllowed = MODE !== "fedramp" && !gemini.usingVertex; // ephemeral Live tokens are an AI Studio feature
if (STRICT) {
  const problems: string[] = [];
  if (authDisabled) problems.push("AUTH_DISABLED must not be set");
  if (!authConfigured) problems.push("OIDC_ISSUER and OIDC_AUDIENCE are required");
  if (!gemini.usingVertex && gemini.geminiConfigured) problems.push("Gemini must use Vertex AI (GOOGLE_GENAI_USE_VERTEXAI=true), not an AI Studio key");
  if (!process.env.TRUST_PROXY) problems.push("TRUST_PROXY must be set (TLS terminates at the proxy)");
  if (problems.length) {
    console.error(`COMPLIANCE_MODE=${MODE} refused to start:\n - ${problems.join("\n - ")}`);
    process.exit(1);
  }
}
if (PROD && !STRICT && (authDisabled || !authConfigured)) {
  console.warn("WARNING: /api is running without sign-in. Demo / synthetic data only.");
}
const PORT = Number(PROD ? process.env.PORT || 3000 : process.env.API_PORT || 8787);
const app = express();

// Behind nginx/ingress, rate limits must key on the client IP, not the proxy's (SC-5).
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
app.disable("x-powered-by");

// SC-7 / SI-10: strict CSP. wasm-unsafe-eval is required by MediaPipe; Gemini Live uses wss.
app.use(
  helmet({
    // Always on: in dev, Vite serves the pages, so this only covers API responses.
    contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "wss://generativelanguage.googleapis.com"],
            workerSrc: ["'self'", "blob:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(express.json({ limit: "256kb" }));

// AU-2 / AU-3: one structured line per API call, including denials. Never logs request bodies (may contain PHI).
app.use("/api", (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      JSON.stringify({ ts: new Date().toISOString(), evt: "api", method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start, ip: req.ip, user: (req as AuthedRequest).user?.sub ?? null }),
    );
  });
  next();
});

// AC-4: only our own pages may call the API from a browser (blocks cross-site use of the proxy).
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean));
app.use("/api", (req, res, next) => {
  const origin = req.get("origin");
  if (!origin) return next(); // same-origin fetches / non-browser clients behind auth at the edge
  const host = req.get("host");
  if (ALLOWED_ORIGINS.has(origin) || (host && new URL(origin).host === host)) return next();
  res.status(403).json({ error: "Origin not allowed" });
});

app.use("/api", rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));
// Live tokens are the most expensive capability; tighter limit.
app.use("/api/ai/live-token", rateLimit({ windowMs: 60_000, limit: 6, standardHeaders: true, legacyHeaders: false }));
// IA-2 / AC-3: every API call needs a verified sign-in (set AUTH_DISABLED=true only for local demos).
app.use("/api", requireAuth);

const asyncRoute =
  (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response) =>
    fn(req, res).catch((err) => {
      // Structured JSON: user input never becomes a format string or a forged log line (CWE-134/117)
      console.error(JSON.stringify({ ts: new Date().toISOString(), evt: "api_error", path: req.path, error: String(err?.message || err) }));
      // SI-11: don't echo upstream error detail to clients; config errors are safe to surface.
      const msg = String(err?.message || "");
      if (msg === "bad-coords") return res.status(400).json({ error: "lat/lng out of range" });
      res.status(502).json({ error: /is not set on the server/.test(msg) ? msg : "AI service unavailable" });
    });

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const coords = (body: any) => {
  const lat = num(body?.lat), lng = num(body?.lng);
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) throw new Error("bad-coords");
  return { lat, lng };
};
// SI-10: the client may only send plain text turns; drops spoofed system/tool parts and caps size.
const cleanHistory = (h: unknown) =>
  (Array.isArray(h) ? h : [])
    .slice(-20)
    .map((t: any) => ({
      role: t?.role === "model" ? "model" : "user",
      parts: [{ text: str(t?.parts?.[0]?.text, 4000) }],
    }))
    .filter((t) => t.parts[0].text);

// Readiness: can this instance serve real traffic? (load balancers route on this; /health is liveness)
let ready = true;
app.get("/ready", (_req, res) => {
  const problems: string[] = [];
  if (!ready) problems.push("shutting down");
  if (PROD && !authDisabled && !authConfigured) problems.push("sign-in not configured");
  if (!gemini.geminiConfigured) problems.push("AI not configured");
  res.status(problems.length ? 503 : 200).json({ ready: !problems.length, problems });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, mode: MODE || "demo", auth: authDisabled ? "disabled" : authConfigured ? "oidc" : "unconfigured", gemini: gemini.geminiConfigured ? (gemini.usingVertex ? "vertex" : "ai-studio") : false, tts: ttsAllowed, live: liveAllowed });
});

// ---------------- Gemini ----------------
app.post("/api/ai/scenario", asyncRoute(async (req, res) => {
  const history = cleanHistory(req.body.history);
  const r = await gemini.generateSimulatorScenario(str(req.body.action) || undefined, history);
  res.json({ text: r.text ?? "" });
}));

app.post("/api/ai/image", asyncRoute(async (req, res) => {
  res.json({ image: await gemini.generateImage(str(req.body.prompt, 1000)) });
}));

app.post("/api/ai/handoff", asyncRoute(async (req, res) => {
  res.json({ text: await gemini.generateHandoffReport(str(req.body.input, 8000)) });
}));

app.post("/api/ai/gloss-to-english", asyncRoute(async (req, res) => {
  const glosses = Array.isArray(req.body.glosses) ? req.body.glosses.map((g: unknown) => str(g, 64)).slice(0, 100) : [];
  res.json({ text: await gemini.translateGlosstoEnglish(glosses) });
}));

app.post("/api/ai/english-to-asl", asyncRoute(async (req, res) => {
  res.json({ text: await gemini.translateEnglishtoASL(str(req.body.text, 2000)) });
}));

app.post("/api/ai/hospitals", asyncRoute(async (req, res) => {
  const { lat, lng } = coords(req.body);
  const r = await gemini.findClosestHospital(lat, lng);
  res.json({ text: r.text ?? "", groundingMetadata: r.candidates?.[0]?.groundingMetadata ?? null });
}));

app.post("/api/ai/cross-streets", asyncRoute(async (req, res) => {
  const { lat, lng } = coords(req.body);
  res.json({ text: await gemini.getCrossStreets(lat, lng) });
}));

// Short-lived, single-use token so the browser can open a Gemini Live socket without the real key.
app.post("/api/ai/live-token", asyncRoute(async (_req, res) => {
  if (!liveAllowed) return res.status(501).json({ error: "Live sessions are disabled in this compliance mode" });
  const now = Date.now();
  const token = await gemini.getAI().authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(now + 30 * 60_000).toISOString(),
      newSessionExpireTime: new Date(now + 60_000).toISOString(),
      httpOptions: { apiVersion: "v1alpha" },
    },
  });
  res.json({ token: token.name, modality: Modality.AUDIO });
}));

// ---------------- ElevenLabs TTS ----------------
const VOICES: Record<string, string> = {
  EMS: "pNInz6obpgDQGcFmaJgB",
  FIRE: "EXAVITQu4vr4xnSDxMaL",
  POLICE: "21m00Tcm4TlvDq8ikWAM",
};
// Plain REST call: the ElevenLabs SDK adds ~50s of startup time for one endpoint.
app.post("/api/tts", asyncRoute(async (req, res) => {
  // 503 makes the browser fall back to the on-device voice (no PHI leaves the device)
  if (!ttsAllowed) return res.status(503).json({ error: "Cloud voice unavailable; using device voice" });
  const text = str(req.body.text, 1000).trim();
  if (!text) return res.status(400).json({ error: "text required" });
  const voice = VOICES[str(req.body.agency)] ?? VOICES.EMS;
  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
    },
  );
  if (!upstream.ok || !upstream.body) throw new Error(`ElevenLabs ${upstream.status}`);
  res.setHeader("Content-Type", "audio/mpeg");
  const reader = upstream.body.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) res.write(r.value);
  res.end();
}));

// Last-resort error handler: JSON only, never a stack trace (SI-11).
app.use("/api", (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = Number(err?.status || err?.statusCode) || 500;
  if (status >= 500) console.error(JSON.stringify({ ts: new Date().toISOString(), evt: "api_unhandled", error: String(err?.message || err) }));
  res.status(status).json({ error: status === 413 ? "Request too large" : status < 500 ? "Bad request" : "Server error" });
});

// ---------------- Static SPA (production) ----------------
if (PROD) {
  const dist = path.resolve("dist");
  // Pages and assets get their own (looser) limit: a field device loads ~20 files on first visit.
  app.use(rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  // sw.js must revalidate so field devices pick up new versions
  app.get("/sw.js", (_req, res) => res.set("Cache-Control", "no-cache").sendFile(path.join(dist, "sw.js")));
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

export { app };

// Start only when run directly (tests import the app without listening).
const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const server = app.listen(PORT, () => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), evt: "start", port: PORT, mode: MODE || "demo", auth: authDisabled ? "disabled" : "oidc", gemini: gemini.usingVertex ? "vertex" : gemini.geminiConfigured ? "ai-studio" : "off", tts: ttsAllowed }));
  });
  // Graceful shutdown: stop taking new requests, let in-flight ones finish (rolling deploys, CP-10).
  let stopping = false;
  const shutdown = (sig: string) => {
    if (stopping) return;
    stopping = true;
    ready = false;
    console.log(JSON.stringify({ ts: new Date().toISOString(), evt: "shutdown", signal: sig }));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
