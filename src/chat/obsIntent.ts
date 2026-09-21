/**
 * Lightweight OBS turn intents — thicker than a bare agentic loop,
 * thinner than Translation Helps' full scripture/quiz path router.
 */

export type ObsIntent =
  | { kind: "framework" }
  | { kind: "lesson" }
  | { kind: "part"; part: string }
  | { kind: "story"; story: number }
  | { kind: "mode"; mode: "study" | "translate" | "check" }
  | { kind: "role"; role: "leader" | "member" }
  | { kind: "open" };

const PART_ALIASES: Array<{ re: RegExp; part: string }> = [
  { re: /\b(community study|community devotion|devotional)\b/i, part: "community" },
  { re: /\b(story frames?|panel text)\b/i, part: "frames" },
  { re: /\b(key idea|creedal verse|story intro)\b/i, part: "intro" },
  { re: /\b(movement\s*1|observe|observation questions|biblical interpretation)\b/i, part: "movement1" },
  { re: /\b(movement\s*2|discuss|discourse questions|theological dialogue)\b/i, part: "movement2" },
  { re: /\b(draft(ing)?|translation draft)\b/i, part: "drafting" },
  { re: /\b(movement\s*3|journal|personal reflection)\b/i, part: "movement3" },
  { re: /\b(team check|quality check|checking questions)\b/i, part: "checking" },
  { re: /\b(movement\s*4|ministry practice|serve the church)\b/i, part: "movement4" },
  { re: /\b(movement\s*5|missional|outreach|evangelism)\b/i, part: "movement5" },
  { re: /\b(conclusion|wrap[- ]?up)\b/i, part: "conclusion" },
];

const FRAMEWORK_RE =
  /\b(what are (the )?five movements|five movements|how (do|should) (we|i) study|what is (this|obs|formation)|explain (the )?(framework|movements)|formation plan)\b/i;

const LESSON_RE =
  /\b(whole|full|entire|complete)\s+(lesson|study|manual|session)|compile\s+(the\s+)?(lesson|study)|formatted\s+lesson|all\s+(the\s+)?(movements|parts)|print\s+(the\s+)?(lesson|study)|show\s+(me\s+)?(the\s+)?(full|whole)\s+(lesson|study)\b/i;

const MODE_RE =
  /\b(?:switch to|go to|change to|set)\s+(study|translate|check|draft|serve)(?:\s+mode)?\b/i;

const ROLE_RE =
  /\b(?:i(?:'m| am)|joining as|help me as|switch to|as)\s+(?:(?:a|the|an)\s+)?(?:group\s+)?(leader|trainer|facilitator|member|participant)\b/i;

export function detectObsIntent(message: string): ObsIntent {
  const text = message.trim();
  if (!text) return { kind: "open" };

  if (FRAMEWORK_RE.test(text) && !/\bpart\s*=/i.test(text) && !LESSON_RE.test(text)) {
    return { kind: "framework" };
  }

  if (LESSON_RE.test(text) && !/\bpart\s*=/i.test(text)) {
    return { kind: "lesson" };
  }

  const roleMatch = ROLE_RE.exec(text);
  if (roleMatch) {
    const raw = roleMatch[1]?.toLowerCase();
    if (raw === "member" || raw === "participant") return { kind: "role", role: "member" };
    if (raw === "leader" || raw === "trainer" || raw === "facilitator") {
      return { kind: "role", role: "leader" };
    }
  }

  const modeMatch = MODE_RE.exec(text);
  if (modeMatch) {
    const raw = modeMatch[1]?.toLowerCase();
    if (raw === "study") return { kind: "mode", mode: "study" };
    if (raw === "translate" || raw === "draft") return { kind: "mode", mode: "translate" };
    if (raw === "check" || raw === "serve") return { kind: "mode", mode: "check" };
  }

  // Explicit part= wins
  const partEq = /\bpart\s*=\s*(intro|frames|community|movement[1-5]|drafting|checking|conclusion)\b/i.exec(
    text,
  );
  if (partEq) {
    return { kind: "part", part: partEq[1].toLowerCase() };
  }

  // Story change: "story 3", "OBS 12", "open story 5"
  const storyMatch =
    /\b(?:obs|story)\s+(\d{1,2})\b/i.exec(text) ||
    /\bopen\s+(?:obs\s+)?(\d{1,2})\b/i.exec(text);
  if (storyMatch) {
    const n = Number.parseInt(storyMatch[1], 10);
    if (n >= 1 && n <= 50) {
      // If also clearly asking for a part, prefer part with that story via open+prompt
      for (const { re, part } of PART_ALIASES) {
        if (re.test(text) && part !== "$1") {
          return { kind: "part", part };
        }
      }
      return { kind: "story", story: n };
    }
  }

  for (const { re, part } of PART_ALIASES) {
    if (part === "$1") continue;
    if (re.test(text)) return { kind: "part", part };
  }

  return { kind: "open" };
}

export function partFacilitationInstruction(
  part: string,
  story: number,
  language: string,
  role: "leader" | "member" = "leader",
): string {
  const framing =
    role === "member"
      ? `Frame for a group MEMBER: help them work through this part personally; invite their own answers; do not run facilitator-only tips.`
      : `Frame for a GROUP LEADER: present exact questions they can ask aloud; add 1–2 short facilitation tips (pacing, listening); do not answer for the group.`;
  return (
    `Open OBS session part "${part}" for story ${story} (language ${language}). ` +
    `Call fetch_obs_study_manual with reference="${story}", language="${language}", part="${part}", format="md". ` +
    `${framing} ` +
    `Use the markdown in content — quote exact questions. End with one clear next step.` +
    (part === "movement1"
      ? ` Keep the words “observation” and “question” visible when you introduce the part.`
      : "")
  );
}
