/**
 * API server tests: sign-in, input validation, boundary controls, compliance modes.
 * Run: npm test   (Node's built-in test runner via tsx; no network, no AI keys needed)
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import os from "node:os";
import nodePath from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT, type KeyLike } from "jose";
import { parseThread, verifyThread } from "./audit";

const auditDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "api-audit-"));
const auditFile = nodePath.join(auditDir, "thread.jsonl");
const auditKeys = generateKeyPairSync("ed25519");

let base = "";
let idp: http.Server, api: http.Server;
let key: KeyLike, otherKey: KeyLike, issuer = "";
const AUD = "argus-api";

async function token(o: { aud?: string; exp?: number; roles?: string[]; k?: KeyLike } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ roles: o.roles ?? ["argus-responder"] })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(issuer).setAudience(o.aud ?? AUD).setSubject("medic-42")
    .setIssuedAt(now - 60).setExpirationTime(o.exp ?? now + 600)
    .sign(o.k ?? key);
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

before(async () => {
  const kp = await generateKeyPair("RS256");
  key = kp.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(kp.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  idp = http.createServer((_q, r) => { r.setHeader("content-type", "application/json"); r.end(JSON.stringify({ keys: [jwk] })); });
  await new Promise<void>((r) => idp.listen(0, r));
  issuer = `http://127.0.0.1:${(idp.address() as AddressInfo).port}`;

  Object.assign(process.env, { OIDC_ISSUER: issuer, OIDC_AUDIENCE: AUD, OIDC_REQUIRED_ROLE: "argus-responder" });
  delete process.env.AUTH_DISABLED;
  delete process.env.GEMINI_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  process.env.AUDIT_LOG_PATH = auditFile;
  process.env.AUDIT_SIGNING_KEY = auditKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const { app } = await import("./index");
  api = app.listen(0);
  await new Promise((r) => api.once("listening", r));
  base = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});

after(() => { api?.close(); idp?.close(); });

test("health is public and reports configuration", async () => {
  const r = await fetch(base + "/health");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).auth, "oidc");
});

test("readiness fails when AI is not configured", async () => {
  const r = await fetch(base + "/ready");
  assert.equal(r.status, 503);
  assert.ok((await r.json()).problems.includes("AI not configured"));
});

test("API rejects requests without a token", async () => {
  assert.equal((await post("/api/ai/handoff", { input: "x" })).status, 401);
});

test("valid token passes sign-in", async () => {
  const r = await post("/api/ai/handoff", { input: "x" }, { Authorization: `Bearer ${await token()}` });
  assert.equal(r.status, 502); // past auth; fails only because no AI is configured in tests
  assert.match((await r.json()).error, /not set on the server/);
});

test("expired, wrong-audience and forged tokens are rejected", async () => {
  const now = Math.floor(Date.now() / 1000);
  for (const t of [await token({ exp: now - 300 }), await token({ aud: "other-app" }), await token({ k: otherKey })]) {
    assert.equal((await post("/api/ai/handoff", {}, { Authorization: `Bearer ${t}` })).status, 401);
  }
});

test("token without the required role is forbidden", async () => {
  assert.equal((await post("/api/ai/handoff", {}, { Authorization: `Bearer ${await token({ roles: [] })}` })).status, 403);
});

test("cross-site browser requests are blocked", async () => {
  const r = await post("/api/ai/handoff", {}, { Origin: "https://evil.example", Authorization: `Bearer ${await token()}` });
  assert.equal(r.status, 403);
});

test("out-of-range coordinates are a 400", async () => {
  const r = await post("/api/ai/cross-streets", { lat: 999, lng: 0 }, { Authorization: `Bearer ${await token()}` });
  assert.equal(r.status, 400);
});

test("cloud TTS unavailable returns 503 so the device voice takes over", async () => {
  const r = await post("/api/tts", { text: "Unit is 10-8" }, { Authorization: `Bearer ${await token()}` });
  assert.equal(r.status, 503);
});

test("oversized bodies are refused", async () => {
  const r = await post("/api/ai/handoff", { input: "x".repeat(300_000) }, { Authorization: `Bearer ${await token()}` });
  assert.equal(r.status, 413);
});

test("COMPLIANCE_MODE=hipaa refuses to start when misconfigured", () => {
  const r = spawnSync(process.execPath, ["--import", "tsx", "server/index.ts", "--production"], {
    env: { ...process.env, COMPLIANCE_MODE: "hipaa", OIDC_ISSUER: "", OIDC_AUDIENCE: "", GEMINI_API_KEY: "x", TRUST_PROXY: "" },
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refused to start/);
  assert.match(r.stderr, /Vertex AI/);
});

test("offline handoff template keeps the medic's notes verbatim", async () => {
  const { offlineHandoffReport } = await import("../src/services/geminiService");
  const out = offlineHandoffReport("Pt 54M, CP since 0700, ASA given");
  assert.match(out, /OFFLINE DRAFT/);
  assert.match(out, /Pt 54M, CP since 0700, ASA given/);
  assert.match(out, /\*\*M - /);
});

test("malformed Origin headers are a 403, not a server error", async () => {
  for (const origin of ["null", "not a url"]) {
    const r = await post("/api/ai/handoff", {}, { Origin: origin, Authorization: `Bearer ${await token()}` });
    assert.equal(r.status, 403, origin);
  }
});

test("every API call, including denials, lands on the signed audit thread without the body", async () => {
  const marker = "PT-NAME-JANE-DOE-DOB-1970";
  await post("/api/ai/handoff", { input: marker });                        // 401: no token
  await post("/api/ai/handoff", { input: marker }, { Authorization: `Bearer ${await token({ roles: [] })}` }); // 403
  await new Promise((r) => setTimeout(r, 50)); // receipts are written on response finish
  const text = fs.readFileSync(auditFile, "utf8");
  assert.ok(!text.includes(marker), "request bodies must never reach the audit thread");
  const receipts = parseThread(text);
  assert.deepEqual(verifyThread(receipts, auditKeys.publicKey), { ok: true, count: receipts.length });
  const statuses = receipts.filter((r) => r.evt === "api" && r.data.path === "/api/ai/handoff").map((r) => r.data.status);
  assert.ok(statuses.includes(401) && statuses.includes(403), JSON.stringify(statuses));
  assert.ok(receipts.some((r) => r.data.user === "medic-42"), "signed-in user is recorded");
});
