/**
 * X-ray / pipeline transparency for obs-5m-mcp tool calls.
 * Mirrors translation-helps-mcp debug traces (tool + chat tool-calling loops).
 */

export type TraceEvent =
  | {
      type: "tool_call";
      name: string;
      params: Record<string, unknown>;
      summary?: string;
      resultSnapshot?: unknown;
      ms: number;
      ok: boolean;
      error?: string;
      cacheStatus?: string;
      downstreamApiCalls?: number;
    }
  | {
      type: "dcs_fetch";
      url: string;
      status: number;
      ms: number;
      cache: "hit" | "miss" | "bypass";
      kind: "story" | "transclusion" | "catalog" | "other";
    }
  | {
      type: "cache";
      key: string;
      hit: boolean;
    }
  | {
      type: "done_trace";
      totalMs: number;
    };

export type TimedTraceEvent = TraceEvent & { t: number };

export class XraySession {
  readonly startedAt = Date.now();
  readonly events: TimedTraceEvent[] = [];

  push(event: TraceEvent): void {
    this.events.push({ ...event, t: Date.now() - this.startedAt });
  }

  done(): TimedTraceEvent[] {
    this.push({ type: "done_trace", totalMs: Date.now() - this.startedAt });
    return this.events;
  }
}
