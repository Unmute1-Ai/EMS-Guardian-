/**
 * Audit thread tests: real files on disk, real Ed25519, real server process for the
 * startup checks. No mocks.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { AuditThread, parseThread, verifyThread } from "./audit";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "audit-test-"));
const quiet = () => {};
const keypair = () => generateKeyPairSync("ed25519");
const pem = (k: ReturnType<typeof keypair>["privateKey"]) => k.export({ type: "pkcs8", format: "pem" }).toString();

function sampleThread() {
  const dir = tmp();
  const file = path.join(dir, "thread.jsonl");
  const { privateKey, publicKey } = keypair();
  const t = new AuditThread(privateKey, file, quiet);
  t.record("start", { port: 3000 });
  t.record("api", { method: "POST", path: "/ai/handoff", status: 401, user: null });
  t.record("api", { method: "POST", path: "/ai/handoff", status: 200, user: "medic-42" });
  t.record("shutdown", { signal: "SIGTERM" });
  t.close();
  return { dir, file, privateKey, publicKey, text: fs.readFileSync(file, "utf8") };
}

test("an untouched thread verifies", () => {
  const { text, publicKey } = sampleThread();
  assert.deepEqual(verifyThread(parseThread(text), publicKey), { ok: true, count: 4 });
});

test("the thread file is private to the server user", () => {
  const { file } = sampleThread();
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test("hiding a denial by editing it is caught", () => {
  const { text, publicKey } = sampleThread();
  const edited = text.replace('"status":401', '"status":200');
  assert.notEqual(edited, text);
  const r = verifyThread(parseThread(edited), publicKey);
  assert.deepEqual(r, { ok: false, seq: 1, why: "contents edited after signing" });
});

test("deleting or reordering lines is caught", () => {
  const { text, publicKey } = sampleThread();
  const lines = text.trim().split("\n");
  const dropped = [lines[0], ...lines.slice(2)].join("\n");
  assert.equal(verifyThread(parseThread(dropped), publicKey).ok, false);
  const swapped = [lines[0], lines[2], lines[1], lines[3]].join("\n");
  assert.equal(verifyThread(parseThread(swapped), publicKey).ok, false);
  const truncatedHead = lines.slice(1).join("\n");
  assert.equal(verifyThread(parseThread(truncatedHead), publicKey).ok, false);
});

test("a forger who re-signs with their own key is caught", () => {
  const { text, publicKey } = sampleThread();
  const forger = keypair();
  // Rebuild the whole thread with every denial flipped to 200, signed by the forger.
  const lines: string[] = [];
  const forged = new AuditThread(forger.privateKey, null, (l) => lines.push(l));
  for (const r of parseThread(text)) forged.record(r.evt, { ...r.data, status: 200 });
  assert.equal(verifyThread(parseThread(lines.join("\n")), publicKey).ok, false);
  assert.equal(verifyThread(parseThread(lines.join("\n")), forger.publicKey).ok, true);
});

test("a restart continues the same chain", () => {
  const { file, privateKey, publicKey } = sampleThread();
  const t = new AuditThread(privateKey, file, quiet);
  t.record("start", { port: 3000 });
  t.close();
  const r = verifyThread(parseThread(fs.readFileSync(file, "utf8")), publicKey);
  assert.deepEqual(r, { ok: true, count: 5 });
});

test("a restart with a different key refuses instead of forking the chain", () => {
  const { file } = sampleThread();
  assert.throws(() => new AuditThread(keypair().privateKey, file, quiet), /signed by a different key/);
});

test("a restart after the last line was altered refuses", () => {
  const { file, privateKey, text } = sampleThread();
  fs.writeFileSync(file, text.replace('"signal":"SIGTERM"', '"signal":"SIGKILL"'));
  assert.throws(() => new AuditThread(privateKey, file, quiet), /altered/);
});

test("the tail reader finds the last receipt in a large thread", () => {
  const dir = tmp();
  const file = path.join(dir, "big.jsonl");
  const { privateKey, publicKey } = keypair();
  const t = new AuditThread(privateKey, file, quiet);
  for (let i = 0; i < 1500; i++) t.record("api", { method: "GET", path: `/x/${"p".repeat(40)}`, status: 200, user: "u" });
  t.close();
  assert.ok(fs.statSync(file).size > 64 * 1024);
  const t2 = new AuditThread(privateKey, file, quiet);
  t2.record("start", {});
  t2.close();
  assert.deepEqual(verifyThread(parseThread(fs.readFileSync(file, "utf8")), publicKey), { ok: true, count: 1501 });
});

test("non-Ed25519 keys are refused", () => {
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  assert.throws(() => new AuditThread(rsa, null, quiet), /Ed25519/);
});

test("verify CLI: exit 0 on intact, 1 on tampered", () => {
  const { dir, file, publicKey, text } = sampleThread();
  const pub = path.join(dir, "pub.pem");
  fs.writeFileSync(pub, publicKey.export({ type: "spki", format: "pem" }));
  const run = () => spawnSync(process.execPath, ["--import", "tsx", "server/audit-cli.ts", "verify", file, pub], { encoding: "utf8", timeout: 60_000 });
  let r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK: 4 receipts/);
  fs.writeFileSync(file, text.replace('"medic-42"', '"medic-99"'));
  r = run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /BROKEN at seq 2: contents edited/);
});

test("COMPLIANCE_MODE=hipaa refuses to start without a persistent audit key and file", () => {
  const r = spawnSync(process.execPath, ["--import", "tsx", "server/index.ts", "--production"], {
    env: { ...process.env, COMPLIANCE_MODE: "hipaa", AUDIT_SIGNING_KEY: "", AUDIT_SIGNING_KEY_FILE: "", AUDIT_LOG_PATH: "" },
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /AUDIT_SIGNING_KEY/);
  assert.match(r.stderr, /AUDIT_LOG_PATH/);
});

test("server refuses to start on a thread signed by another key", () => {
  const { file } = sampleThread();
  const r = spawnSync(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: { ...process.env, COMPLIANCE_MODE: "", AUDIT_SIGNING_KEY: pem(keypair().privateKey), AUDIT_LOG_PATH: file, API_PORT: "0" },
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /signed by a different key/);
});

test("public key printed by the server verifies its receipts", () => {
  const { privateKey } = keypair();
  const t = new AuditThread(privateKey, null, quiet);
  const pub = createPublicKey(t.publicKeyPem());
  const lines: string[] = [];
  const t2 = new AuditThread(privateKey, null, (l) => lines.push(l));
  t2.record("start", {});
  assert.equal(verifyThread(parseThread(lines.join("\n")), pub).ok, true);
});
