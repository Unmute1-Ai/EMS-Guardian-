/**
 * Server-side authentication (NIST 800-53 IA-2, AC-3; HIPAA §164.312(a)(1), (d)).
 *
 * Every /api request must carry an OIDC access token from the agency identity
 * provider (Entra ID / Login.gov / Okta / Keycloak). The token is verified here
 * against the IdP's published keys; the browser never sees a shared secret.
 *
 * Typical deployment: an OIDC-aware proxy (oauth2-proxy, ALB OIDC, Istio) signs the
 * user in with PIV/CAC or phishing-resistant MFA and forwards
 * `Authorization: Bearer <token>` to this server.
 */
import type express from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const ISSUER = process.env.OIDC_ISSUER;
const AUDIENCE = process.env.OIDC_AUDIENCE;
const REQUIRED_ROLE = process.env.OIDC_REQUIRED_ROLE; // optional, e.g. "argus-responder"
const ROLES_CLAIM = process.env.OIDC_ROLES_CLAIM || "roles";

export const authConfigured = Boolean(ISSUER && AUDIENCE);
const PROD = process.env.NODE_ENV === "production" || process.argv.includes("--production");
// Local development without an IdP stays usable; production must configure OIDC or opt out explicitly.
export const authDisabled = process.env.AUTH_DISABLED === "true" || (!PROD && !ISSUER && !process.env.COMPLIANCE_MODE);

const jwks = ISSUER
  ? createRemoteJWKSet(new URL(process.env.OIDC_JWKS_URI || `${ISSUER.replace(/\/$/, "")}/.well-known/jwks.json`))
  : null;

export interface AuthedRequest extends express.Request {
  user?: { sub: string; roles: string[] };
}

function rolesOf(p: JWTPayload): string[] {
  const v = (p as Record<string, unknown>)[ROLES_CLAIM];
  return Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split(" ") : [];
}

export const requireAuth: express.RequestHandler = async (req, res, next) => {
  if (authDisabled) return next();
  if (!jwks || !ISSUER || !AUDIENCE) return res.status(503).json({ error: "Sign-in is not configured on the server" });

  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Sign in required" });

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["RS256", "PS256", "ES256"], // no HS*/none
      clockTolerance: 30,
    });
    const roles = rolesOf(payload);
    if (REQUIRED_ROLE && !roles.includes(REQUIRED_ROLE)) return res.status(403).json({ error: "Not authorized for Argus" });
    (req as AuthedRequest).user = { sub: String(payload.sub), roles };
    next();
  } catch {
    res.status(401).json({ error: "Sign-in expired or invalid" });
  }
};
