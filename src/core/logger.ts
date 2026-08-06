export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  code?: string;
  tool?: string;
  requestId?: string;
  message: string;
  ts: string;
  [key: string]: unknown;
}

function emit(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === "error" || entry.level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(message: string, ctx?: Omit<LogEntry, "level" | "message" | "ts">): void {
    emit({ level: "debug", message, ts: new Date().toISOString(), ...ctx });
  },
  info(message: string, ctx?: Omit<LogEntry, "level" | "message" | "ts">): void {
    emit({ level: "info", message, ts: new Date().toISOString(), ...ctx });
  },
  warn(message: string, ctx?: Omit<LogEntry, "level" | "message" | "ts">): void {
    emit({ level: "warn", message, ts: new Date().toISOString(), ...ctx });
  },
  error(message: string, ctx?: Omit<LogEntry, "level" | "message" | "ts">): void {
    emit({ level: "error", message, ts: new Date().toISOString(), ...ctx });
  },
};
