/**
 * Tamper-evident audit thread (AU-9, AU-10, AU-5).
 *
 * Every audit event becomes a receipt that carries the hash of the receipt before it
 * and an Ed25519 signature over its own hash. Editing, deleting, reordering or
 * re-signing any line breaks verification. Request bodies are never recorded (PHI).
 *
 * Receipts are written to AUDIT_LOG_PATH (append + fsync) when set, and always to
 * stdout as one JSON line so the existing log pipeline keeps working.
 *
 * Verify a file:  npm run audit:verify -- <thread.jsonl> <public-key.pem>
 *
 * Tamper-EVIDENT, not tamper-proof: someone with the signing key and the file can
 * rewrite history. Keep the private key out of the log pipeline's reach, and keep the
 * public key (printed at startup) with whoever audits.
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type AuditValue = string | number | boolean | null;
export type AuditData = Record<string, AuditValue>;

export interface Receipt {
  seq: number;
  ts: string;
  evt: string;
  data: AuditData;
  prev: string;
  hash: string;
  sig: string;
}

export const GENESIS = "0".repeat(64);

/** Canonical bytes: fixed field order, data keys sorted, so the hash never depends on JSON key order. */
function canonical(r: Pick<Receipt, "seq" | "ts" | "evt" | "data" | "prev">): string {
  const data = Object.keys(r.data).sort().map((k) => [k, r.data[k]]);
  return JSON.stringify(["ems-guardian/audit/v1", r.seq, r.ts, r.evt, data, r.prev]);
}

export function hashOf(r: Pick<Receipt, "seq" | "ts" | "evt" | "data" | "prev">): string {
  return createHash("sha256").update(canonical(r)).digest("hex");
}

export type VerifyResult = { ok: true; count: number } | { ok: false; seq: number; why: string };

/** Verify a whole thread, from its first receipt, against the auditor's copy of the public key. */
export function verifyThread(receipts: Receipt[], publicKey: KeyObject | string): VerifyResult {
  const key = typeof publicKey === "string" ? createPublicKey(publicKey) : publicKey;
  let prev = GENESIS;
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    if (r.seq !== i) return { ok: false, seq: r.seq ?? i, why: "sequence gap or reorder" };
    if (r.prev !== prev) return { ok: false, seq: r.seq, why: "previous-hash link broken" };
    if (hashOf(r) !== r.hash) return { ok: false, seq: r.seq, why: "contents edited after signing" };
    let good = false;
    try {
      good = verify(null, Buffer.from(r.hash), key, Buffer.from(r.sig, "base64"));
    } catch {
      good = false;
    }
    if (!good) return { ok: false, seq: r.seq, why: "signature does not match" };
    prev = r.hash;
  }
  return { ok: true, count: receipts.length };
}

export function parseThread(text: string): Receipt[] {
  return text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Receipt);
}

/** Read only the tail of the file to find the last receipt (threads grow large). */
function lastReceipt(file: string): Receipt | null {
  if (!fs.existsSync(file)) return null;
  const size = fs.statSync(file).size;
  if (size === 0) return null;
  const fd = fs.openSync(file, "r");
  try {
    let span = Math.min(size, 64 * 1024);
    for (;;) {
      const buf = Buffer.alloc(span);
      fs.readSync(fd, buf, 0, span, size - span);
      const lines = buf.toString("utf8").split("\n").filter((l) => l.trim());
      // A partial read's first line may be cut off, so the last line is only
      // trustworthy once at least one full line precedes it, or the whole file is read.
      if (lines.length > 1 || span === size) {
        return lines.length ? (JSON.parse(lines[lines.length - 1]) as Receipt) : null;
      }
      span = Math.min(size, span * 4);
    }
  } finally {
    fs.closeSync(fd);
  }
}

export class AuditThread {
  private prev = GENESIS;
  private seq = 0;
  private fd: number | null = null;
  /** False after a write failure; strict deployments stop serving the API (AU-5). */
  healthy = true;

  constructor(
    private readonly key: KeyObject,
    private readonly file: string | null = null,
    private readonly echo: (line: string) => void = (l) => console.log(l),
  ) {
    if (key.asymmetricKeyType !== "ed25519") throw new Error("AUDIT_SIGNING_KEY must be an Ed25519 private key");
    if (file) {
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true, mode: 0o700 });
      const last = lastReceipt(file);
      if (last) {
        const pub = createPublicKey(key);
        let continues = false;
        try {
          continues = hashOf(last) === last.hash && verify(null, Buffer.from(last.hash), pub, Buffer.from(last.sig, "base64"));
        } catch {
          continues = false;
        }
        if (!continues) {
          throw new Error(
            `audit thread ${file} was signed by a different key or its last line was altered; ` +
              "point AUDIT_LOG_PATH at a new file when rotating keys, and investigate the old one",
          );
        }
        this.prev = last.hash;
        this.seq = last.seq + 1;
      }
      this.fd = fs.openSync(file, "a", 0o600);
    }
  }

  publicKeyPem(): string {
    return createPublicKey(this.key).export({ type: "spki", format: "pem" }).toString();
  }

  record(evt: string, data: AuditData = {}): Receipt {
    const base = { seq: this.seq, ts: new Date().toISOString(), evt, data, prev: this.prev };
    const hash = hashOf(base);
    const sig = sign(null, Buffer.from(hash), this.key).toString("base64");
    const r: Receipt = { ...base, hash, sig };
    const line = JSON.stringify(r);
    if (this.fd !== null) {
      try {
        fs.writeSync(this.fd, line + "\n");
        fs.fsyncSync(this.fd);
      } catch (err) {
        this.healthy = false;
        console.error(JSON.stringify({ ts: new Date().toISOString(), evt: "audit_write_failed", error: String((err as Error)?.message || err) }));
        throw err;
      }
    }
    this.prev = hash;
    this.seq += 1;
    this.echo(line);
    return r;
  }

  close(): void {
    if (this.fd !== null) fs.closeSync(this.fd);
    this.fd = null;
  }
}

/**
 * AUDIT_SIGNING_KEY       Ed25519 private key, PEM (or AUDIT_SIGNING_KEY_FILE: path to it)
 * AUDIT_LOG_PATH          append-only thread file; unset = stdout only
 * Strict compliance modes refuse to start without a persistent key and a file.
 */
export function auditFromEnv(strict: boolean): { thread: AuditThread; ephemeral: boolean; problems: string[] } {
  const problems: string[] = [];
  let pem = process.env.AUDIT_SIGNING_KEY?.replace(/\\n/g, "\n");
  if (!pem && process.env.AUDIT_SIGNING_KEY_FILE) pem = fs.readFileSync(process.env.AUDIT_SIGNING_KEY_FILE, "utf8");
  const file = process.env.AUDIT_LOG_PATH || null;
  if (strict && !pem) problems.push("AUDIT_SIGNING_KEY (or AUDIT_SIGNING_KEY_FILE) is required: an Ed25519 private key for the audit thread");
  if (strict && !file) problems.push("AUDIT_LOG_PATH is required: the append-only audit thread file");
  const key = pem ? createPrivateKey(pem) : generateKeyPairSync("ed25519").privateKey;
  return { thread: new AuditThread(key, file), ephemeral: !pem, problems };
}
