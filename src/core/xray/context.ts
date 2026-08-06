import { AsyncLocalStorage } from "node:async_hooks";
import { XraySession, type TraceEvent } from "./traceEvents.js";

const storage = new AsyncLocalStorage<XraySession>();

export function runWithXray<T>(
  session: XraySession,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(session, fn);
}

export function currentXray(): XraySession | undefined {
  return storage.getStore();
}

export function xrayPush(event: TraceEvent): void {
  storage.getStore()?.push(event);
}
