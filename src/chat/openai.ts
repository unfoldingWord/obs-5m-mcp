/**
 * Minimal OpenAI chat + tools client (Workers-safe fetch).
 */

export interface OpenAITool {
  type: "function";
  function: { name: string; description: string; parameters: object };
}

export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type OpenAIMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export class OpenAIClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gpt-4.1",
  ) {}

  async generateWithTools(
    messages: OpenAIMessage[],
    tools: OpenAITool[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<{
    content: string | null;
    tool_calls?: OpenAIToolCall[];
    finish_reason: string;
  }> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2048,
    };
    if (tools.length) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `OpenAI error ${response.status}: ${text.slice(0, 400)}`,
      );
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: OpenAIToolCall[];
        };
        finish_reason: string;
      }>;
    };
    const choice = data.choices[0];
    return {
      content: choice?.message?.content ?? null,
      tool_calls: choice?.message?.tool_calls,
      finish_reason: choice?.finish_reason ?? "stop",
    };
  }

  async *generateStream(
    messages: OpenAIMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): AsyncIterable<string> {
    const body = {
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2048,
      stream: true,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      throw new Error(`OpenAI stream error ${response.status}: ${text.slice(0, 400)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") return;
            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string | null } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) yield delta;
            } catch {
              /* ignore */
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
