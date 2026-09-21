/**
 * Local Vite has no Wrangler platform.env. Load OPENAI_API_KEY from
 * process.env or the worker `.dev.vars` next to the monorepo root.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Env } from "../../mcp-env";

let cached: Record<string, string> | null = null;

function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function loadLocalSecrets(): Record<string, string> {
  if (cached) return cached;
  const candidates = [
    resolve(process.cwd(), ".dev.vars"),
    resolve(process.cwd(), "..", ".dev.vars"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    cached = parseDotEnv(readFileSync(file, "utf8"));
    return cached;
  }
  cached = {};
  return cached;
}

export function resolveChatEnv(platformEnv: Env): Env {
  const local = loadLocalSecrets();
  return {
    ...local,
    ...platformEnv,
    OPENAI_API_KEY:
      platformEnv.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      local.OPENAI_API_KEY,
    PUBLIC_BASE_URL:
      platformEnv.PUBLIC_BASE_URL ||
      process.env.PUBLIC_BASE_URL ||
      local.PUBLIC_BASE_URL ||
      "http://127.0.0.1:8174",
  };
}
