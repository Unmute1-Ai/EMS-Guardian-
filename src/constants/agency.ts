/**
 * Agency configuration for First Responder Guardian
 * EMS | FIRE | POLICE
 */

export type Agency = "EMS" | "FIRE" | "POLICE";

export const AGENCY_CONFIG = {
  EMS: {
    label: "EMS",
    glow: "shadow-[0_0_50px_rgba(239,68,68,0.5)] ring-1 ring-red-500/30",
    accent: "text-red-400",
    bg: "bg-red-500",
    border: "border-red-500",
    buttonActive: "bg-red-500 text-black border-red-500",
  },
  FIRE: {
    label: "FIRE",
    glow: "shadow-[0_0_50px_rgba(249,115,22,0.5)] ring-1 ring-orange-500/30",
    accent: "text-orange-400",
    bg: "bg-orange-500",
    border: "border-orange-500",
    buttonActive: "bg-orange-500 text-black border-orange-500",
  },
  POLICE: {
    label: "POLICE",
    glow: "shadow-[0_0_50px_rgba(59,130,246,0.5)] ring-1 ring-blue-500/30",
    accent: "text-blue-400",
    bg: "bg-blue-500",
    border: "border-blue-500",
    buttonActive: "bg-blue-500 text-black border-blue-500",
  },
} as const;

export function getSystemPrompt(agency: Agency): string {
  const base =
    "You are Guardian AI, a tactical assistant for first responders. Be extremely concise. Prioritize responder safety.";

  if (agency === "EMS") {
    return `${base} You support Paramedics and EMTs. Focus on patient assessment, ABCs, MARCH algorithm, clinical protocols, and clear medical handoff language.`;
  }
  if (agency === "FIRE") {
    return `${base} You support Firefighters. Focus on scene size-up, fire behavior, accountability (PAR), mayday procedures, hazmat recognition, and ICS structure.`;
  }
  return `${base} You support Police officers. Focus on officer safety, scene control, de-escalation language, subject descriptions, and tactical awareness. Never recommend use of force.`;
}
