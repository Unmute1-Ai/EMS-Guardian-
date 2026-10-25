/**
 * Browser-side Gemini client. All calls go through the EMS Guardian API server
 * (server/index.ts), which holds the API key.
 */

/** Session expired: reload once so the sign-in proxy (oauth2-proxy / ALB OIDC) sends the user to the IdP. */
function signInAgain() {
  try {
    // At most one reload per minute, so a broken sign-in can't cause a reload loop
    const last = Number(sessionStorage.getItem("argus-reauth") || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem("argus-reauth", String(Date.now()));
  } catch { /* storage blocked: still try once */ }
  location.reload();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/ai/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) signInAgain();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `AI request failed (${res.status})`);
  return data as T;
}

export function generateSimulatorScenario(userAction?: string, history: any[] = []) {
  return post<{ text: string }>("scenario", { action: userAction, history });
}

export async function generateImage(prompt: string) {
  return (await post<{ image: string | null }>("image", { prompt })).image;
}

export async function generateHandoffReport(input: string) {
  try {
    if (!navigator.onLine) throw new Error("offline");
    return (await post<{ text: string }>("handoff", { input })).text;
  } catch {
    return offlineHandoffReport(input);
  }
}

/** Deterministic MIST handoff used when the AI service is unreachable. */
export function offlineHandoffReport(input: string): string {
  const now = new Date().toLocaleString();
  return [
    "## EMS HANDOFF (MIST) - OFFLINE DRAFT",
    `*Generated on-device at ${now}. AI service unavailable; verify before transfer.*`,
    "",
    "**M - Mechanism / Medical complaint:** _",
    "**I - Injuries / Illness findings:** _",
    "**S - Signs (vitals):** BP _ / HR _ / RR _ / SpO2 _ / GCS _",
    "**T - Treatment given:** _",
    "",
    "### Field notes (verbatim)",
    input.trim(),
  ].join("\n");
}

export async function translateGlosstoEnglish(glosses: string[]) {
  return (await post<{ text: string }>("gloss-to-english", { glosses })).text;
}

export async function translateEnglishtoASL(text: string) {
  return (await post<{ text: string }>("english-to-asl", { text })).text;
}

export function findClosestHospital(lat: number, lng: number) {
  return post<{ text: string; groundingMetadata: any }>("hospitals", { lat, lng });
}

export async function getCrossStreets(lat: number, lng: number) {
  return (await post<{ text: string }>("cross-streets", { lat, lng })).text;
}

export async function getLiveToken(): Promise<string> {
  return (await post<{ token: string }>("live-token", {})).token;
}
