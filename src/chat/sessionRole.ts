/**
 * Session role angle — who Ezer is helping (orthogonal to Study/Translate/Check).
 * - leader: trainer / group facilitator leading a Five Movements session
 * - member: participant in the group
 */

export type SessionRole = "leader" | "member";

export const SESSION_ROLES: SessionRole[] = ["leader", "member"];

export function parseSessionRole(value: unknown): SessionRole {
  return value === "member" ? "member" : "leader";
}

export function sessionRolePromptBias(role: SessionRole): string {
  if (role === "member") {
    return [
      "Session role: GROUP MEMBER (participant).",
      "Help this person take part in a Five Movements group — understand the story, think through the study questions, prepare reflections, and practice answering.",
      "Do not coach them as if they are facilitating the whole group.",
      "Invite personal engagement; keep answers proportional; prefer one question or prompt at a time.",
      "When opening a part, present the exact study questions so they can work through them as a participant.",
    ].join(" ");
  }
  return [
    "Session role: GROUP LEADER / TRAINER (facilitator).",
    "Help this person lead a Five Movements group well — pacing, which questions to ask aloud, when to listen, when to move to the next part.",
    "Prefer facilitator framing: “Ask the group…”, “Invite 2–3 responses…”, “Then open…”.",
    "Give short facilitation tips (timing, inclusion, don’t answer for the group) alongside exact study questions from tools.",
    "Do not dump the whole manual; open one part at a time and suggest how to run that slice live.",
  ].join(" ");
}

export function sessionRoleIntroHint(role: SessionRole): string {
  if (role === "member") {
    return "They are joining as a group member. Ask which story they want to study, then offer to walk through Community Study or Movement 1 with them as a participant.";
  }
  return "They are joining as a group leader/trainer. Ask which story their group will study, then offer to help them facilitate Community Study or Movement 1.";
}
