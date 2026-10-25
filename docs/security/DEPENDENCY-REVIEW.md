# Dependency Review: 2026-10-25

Scope: `package.json` / `package-lock.json`. Supports NIST SP 800-218 PW.4 and SP 800-53 SA-22 / SR-3 / RA-5.
CI repeats the automated parts on every change: `npm audit` gate, dependency-review on PRs, SBOM, weekly Dependabot.

## Result
| Check | Before | After |
|---|---|---|
| Known vulnerabilities (all deps) | 2 high, 1 moderate | **0** |
| Unused packages | 13 | **0** |
| Production package tree | ~289 | **217** |
| Build tools shipped in the image | yes (TypeScript, Vite, Tailwind…) | **no** (`npm prune --omit=dev` in Dockerfile) |
| Licenses needing review | 2 unknown | **0** |

## Vulnerabilities fixed
| Package | Severity | Issue | Fix |
|---|---|---|---|
| `body-parser` (via Express) | High | DoS via trailing bytes after a compressed body | In-range update |
| `zod` | High | Memory exhaustion on oversized collections | Removed (unused) |
| `qs` (via Express) | Moderate | DoS in `stringify` | In-range update |

## Removed (not imported anywhere)
`@radix-ui/react-alert-dialog`, `react-dialog`, `react-dropdown-menu`, `react-tabs`, `react-toast` ·
`bcryptjs`, `crypto-js` (only used by the deleted fake-security modules) · `pino`, `pino-pretty` · `react-use` · `zod` ·
`@types/bcryptjs`, `@types/crypto-js` · `autoprefixer`, `postcss` (Tailwind v4's Vite plugin doesn't need them).

## Regrouped
- To **devDependencies** (build-time only): `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`
- To **dependencies** (runs the server in production): `tsx`

## Runtime dependencies kept (17)
| Package | Why | License |
|---|---|---|
| `express`, `express-rate-limit`, `helmet` | API server, rate limits, security headers | MIT |
| `jose` | OIDC token verification | MIT |
| `dotenv` | Config loading | BSD-2-Clause |
| `@google/genai` | Gemini (AI Studio / Vertex AI) | Apache-2.0 |
| `tsx` | Runs the TypeScript server | MIT |
| `react`, `react-dom`, `react-markdown`, `motion`, `lucide-react`, `clsx`, `tailwind-merge` | Frontend (bundled at build) | MIT / ISC |
| `@mediapipe/hands`, `camera_utils`, `drawing_utils` | On-device hand tracking (self-hosted, offline) | Apache-2.0 |

## Licenses
The whole tree is permissive (MIT, ISC, Apache-2.0, BSD, 0BSD, BlueOak, Unlicense, CC0), with one exception: **`lightningcss` (MPL-2.0)**. It's a build-time CSS tool pulled in by Tailwind; its code is not in the shipped app, and MPL-2.0 is file-level copyleft, so there are no obligations for Argus. No GPL / AGPL anywhere.

## Major upgrades available (deliberately not taken now)
Each is a breaking release. Take them one at a time, on their own PR, after the pilot starts.
| Package | Current → latest | Note |
|---|---|---|
| `@google/genai` | 1.x → 2.x | API changes; re-test Live + Vertex |
| `express` | 4 → 5 | Routing / error-handling changes |
| `helmet` | 7 → 8 | Header defaults change; re-check CSP |
| `express-rate-limit` | 7 → 8 | Config shape |
| `jose` | 5 → 6 | ESM/types; re-run auth tests |
| `vite` | 6 → 8, `@vitejs/plugin-react` 5 → 6 | Build tooling |
| `typescript` | 5.8 → 7 | New compiler; check type errors |
| `lucide-react` 0.x → 1.x, `motion` 12 → 14 | UI; visual check |

## Follow-ups
- Frontend-only libraries (React, MediaPipe, etc.) still install in the production image even though they're already bundled into `dist/`. Moving them to devDependencies would shrink the image further. Low risk; do it once the build is stable in CI.
- Commit `npm install-scripts` approvals (esbuild, protobufjs) so local installs are as locked down as CI's `--ignore-scripts`.
