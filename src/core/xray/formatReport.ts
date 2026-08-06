import type { TimedTraceEvent } from "./traceEvents.js";

function indent(text: string, prefix = "  "): string {
  return text
    .split("\n")
    .map((line) => (line.length ? prefix + line : line))
    .join("\n");
}

function fmtJson(value: unknown, maxChars = 8_000): string {
  try {
    const raw = JSON.stringify(value, null, 2) ?? String(value);
    if (raw.length <= maxChars) return raw;
    return `${raw.slice(0, maxChars)}\n… [truncated ${raw.length - maxChars} chars]`;
  } catch {
    return String(value);
  }
}

function formatEvent(ev: TimedTraceEvent): string {
  const lines: string[] = [`[+${ev.t}ms] ${ev.type}`];
  if (ev.type === "tool_call") {
    lines.push(
      indent(
        `ok=${ev.ok} ms=${ev.ms}` +
          (ev.summary ? ` summary=${ev.summary}` : "") +
          (ev.cacheStatus ? ` cache=${ev.cacheStatus}` : "") +
          (ev.downstreamApiCalls != null
            ? ` downstream=${ev.downstreamApiCalls}`
            : ""),
      ),
    );
    lines.push(indent("params:"));
    lines.push(indent(fmtJson(ev.params), "    "));
    if (ev.error) lines.push(indent(`ERROR: ${ev.error}`));
    if (ev.resultSnapshot !== undefined) {
      lines.push(indent("resultSnapshot:"));
      lines.push(indent(fmtJson(ev.resultSnapshot), "    "));
    }
  } else if (ev.type === "dcs_fetch") {
    lines.push(
      indent(
        `${ev.kind} status=${ev.status} cache=${ev.cache} ms=${ev.ms}`,
      ),
    );
    lines.push(indent(ev.url));
  } else if (ev.type === "cache") {
    lines.push(indent(`${ev.hit ? "HIT" : "MISS"} ${ev.key}`));
  } else if (ev.type === "done_trace") {
    lines.push(indent(`totalMs=${ev.totalMs}`));
  }
  return lines.join("\n");
}

/**
 * Plain-text X-ray report (pasteable), same role as TH MCP formatXrayReport.
 */
export function formatXrayReport(
  events: TimedTraceEvent[],
  opts?: {
    tool?: string;
    url?: string;
    generatedAt?: Date;
  },
): string {
  const generatedAt = (opts?.generatedAt ?? new Date()).toISOString();
  const tools = events.filter((e) => e.type === "tool_call");
  const failed = tools.filter((e) => e.type === "tool_call" && !e.ok);
  const dcs = events.filter((e) => e.type === "dcs_fetch");

  const out: string[] = [
    "obs-5m-mcp — X-ray debug report",
    "==============================",
    `generatedAt: ${generatedAt}`,
    opts?.url ? `url: ${opts.url}` : "",
    opts?.tool ? `tool: ${opts.tool}` : "",
    `events: ${events.length}`,
    `tools: ${tools.length} (failed: ${failed.length})`,
    `dcsFetches: ${dcs.length}`,
    "",
    "--- events ---",
    "",
  ];

  for (const ev of events) {
    out.push(formatEvent(ev));
    out.push("");
  }

  return out.filter((l, i) => !(l === "" && out[i - 1] === "")).join("\n");
}
