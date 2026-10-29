/**
 * Audit thread tools.
 *
 *   npm run audit:keygen -- <dir>                     writes audit-signing.pem (0600) + audit-public.pem
 *   npm run audit:verify -- <thread.jsonl> <public.pem>   exit 0 = intact, 1 = broken, 2 = usage
 */
import fs from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { parseThread, verifyThread } from "./audit";

const [cmd, ...args] = process.argv.slice(2);

if (cmd === "keygen") {
  const dir = args[0] || ".";
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const priv = path.join(dir, "audit-signing.pem");
  const pub = path.join(dir, "audit-public.pem");
  if (fs.existsSync(priv)) {
    console.error(`${priv} already exists; refusing to overwrite a signing key`);
    process.exit(2);
  }
  fs.writeFileSync(priv, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  fs.writeFileSync(pub, publicKey.export({ type: "spki", format: "pem" }));
  console.log(`Signing key: ${priv}  (set AUDIT_SIGNING_KEY_FILE to this; keep it off the log pipeline)`);
  console.log(`Public key:  ${pub}   (give this to whoever audits)`);
} else if (cmd === "verify") {
  const [file, pubFile] = args;
  if (!file || !pubFile) {
    console.error("usage: audit:verify -- <thread.jsonl> <public.pem>");
    process.exit(2);
  }
  let receipts;
  try {
    receipts = parseThread(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`BROKEN: ${file} is not a readable thread (${(e as Error).message})`);
    process.exit(1);
  }
  const r = verifyThread(receipts, fs.readFileSync(pubFile, "utf8"));
  // tsconfig isn't strict, so narrow with `in` rather than on `ok`.
  if ("why" in r) {
    console.error(`BROKEN at seq ${r.seq}: ${r.why}`);
    process.exit(1);
  }
  console.log(`OK: ${r.count} receipts, unbroken and signed.`);
} else {
  console.error("usage: audit-cli keygen <dir> | verify <thread.jsonl> <public.pem>");
  process.exit(2);
}
