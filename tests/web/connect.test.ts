import { describe, expect, it } from "vitest";
import { CLIENTS, cursorDeeplink, vscodeDeeplink } from "../../web/src/lib/connect/clients.js";

const URL_ = "https://x/mcp";

describe("install links", () => {
  it("encodes the server URL for Cursor", () => {
    const link = new URL(cursorDeeplink(URL_));
    expect(link.protocol).toBe("cursor:");
    expect(link.searchParams.get("name")).toBe("obs-tf");
    expect(JSON.parse(atob(link.searchParams.get("config")!))).toEqual({ url: URL_ });
  });

  it("encodes the server URL for VS Code", () => {
    const link = new URL(vscodeDeeplink(URL_));
    expect(link.href).toContain("vscode.dev/redirect/mcp/install");
    expect(JSON.parse(link.searchParams.get("config")!)).toEqual({ type: "http", url: URL_ });
  });
});

describe("CLIENTS", () => {
  it("covers each client with the endpoint in every snippet", () => {
    const clients = CLIENTS(URL_);
    expect(clients.map((c) => c.id)).toEqual([
      "claude-code",
      "claude",
      "cursor",
      "vscode",
      "codex",
      "bt-servant",
      "other",
    ]);
    for (const c of clients) {
      for (const tab of c.tabs) expect(tab.code, `${c.id} ${tab.label}`).toContain(URL_);
    }
    expect(clients.find((c) => c.id === "bt-servant")!.tabs).toEqual([]);
    expect(clients.find((c) => c.id === "claude-code")!.tabs[0].code).toBe(
      `claude mcp add --transport http obs-tf ${URL_}`,
    );
    expect(clients.find((c) => c.id === "codex")!.tabs[0].code).toBe(`codex mcp add obs-tf --url ${URL_}`);
  });
});
