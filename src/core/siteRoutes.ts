import { VERSION, SERVER_NAME } from "./version.js";
import { apiDiscoveryJson } from "./discovery.js";
import { buildLlmsTxt } from "./llmsTxt.js";

const REDIRECTS: Record<string, string> = {
  "/chat": "/try",
  "/chat/": "/try",
  "/debug": "/try?tab=tools",
};

/**
 * Site routes the Worker answers itself. Returns null for everything the
 * static site (ASSETS) should serve.
 */
export function handleSiteRoute(request: Request, baseUrl: string): Response | null {
  const url = new URL(request.url);
  const base = baseUrl.replace(/\/$/, "");
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const target = REDIRECTS[url.pathname];
  if (target) return Response.redirect(`${base}${target}`, 301);

  if (url.pathname === "/llms.txt") {
    return new Response(buildLlmsTxt(base), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const accept = request.headers.get("Accept") ?? "";
  const wantsJson = accept.includes("application/json") && !accept.includes("text/html");
  if (url.pathname === "/api" || (url.pathname === "/" && wantsJson)) {
    return Response.json(apiDiscoveryJson(base, VERSION, SERVER_NAME), {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
  return null;
}
