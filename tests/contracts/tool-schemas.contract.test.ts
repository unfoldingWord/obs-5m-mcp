/**
 * Contract tests for MCP tool schemas (mirrors translation-helps-mcp).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { MCP_TOOLS, TOOL_REGISTRY } from "../../src/mcp/toolRegistry.js";

function toolByName(name: string) {
  const t = TOOL_REGISTRY[name];
  expect(t).toBeDefined();
  return t!;
}

function schemaShape(toolName: string): Record<string, z.ZodTypeAny> {
  const schema = toolByName(toolName).inputSchema;
  if (schema instanceof z.ZodEffects) {
    return (schema.innerType() as z.ZodObject<z.ZodRawShape>).shape;
  }
  return (schema as z.ZodObject<z.ZodRawShape>).shape;
}

describe("Tool module contracts", () => {
  for (const tool of MCP_TOOLS) {
    describe(tool.name, () => {
      it("has a string name", () => {
        expect(typeof tool.name).toBe("string");
        expect(tool.name.length).toBeGreaterThan(0);
      });

      it("has a description", () => {
        expect(typeof tool.description).toBe("string");
        expect(tool.description.length).toBeGreaterThan(10);
      });

      it("has an inputSchema with a .shape", () => {
        expect(tool.inputSchema).toBeDefined();
        const shape =
          tool.inputSchema instanceof z.ZodEffects
            ? (tool.inputSchema.innerType() as z.ZodObject<z.ZodRawShape>).shape
            : (tool.inputSchema as z.ZodObject<z.ZodRawShape>).shape;
        expect(shape).toBeDefined();
      });

      it("has annotations with readOnlyHint and title", () => {
        expect(tool.annotations).toBeDefined();
        expect(tool.annotations.readOnlyHint).toBe(true);
        expect(typeof tool.annotations.title).toBe("string");
      });

      it("has a handler function", () => {
        expect(typeof tool.handler).toBe("function");
      });

      it("has an outputSchema (ZodRawShape) if defined", () => {
        if (tool.outputSchema !== undefined) {
          expect(typeof tool.outputSchema).toBe("object");
          for (const [key, val] of Object.entries(tool.outputSchema)) {
            expect(
              val instanceof z.ZodType,
              `outputSchema.${key} should be a ZodType`,
            ).toBe(true);
          }
        }
      });
    });
  }
});

describe("Tool name uniqueness", () => {
  it("all tool names are unique", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes fetch_obs_study_manual (#36)", () => {
    expect(TOOL_REGISTRY.fetch_obs_study_manual).toBeDefined();
  });
});

describe("Key param requirements", () => {
  it("fetch_obs_study_manual requires reference", () => {
    const shape = schemaShape("fetch_obs_study_manual");
    expect(shape.reference).toBeDefined();
    expect(shape.reference instanceof z.ZodOptional).toBe(false);
  });

  it("list_resources requires language", () => {
    const shape = schemaShape("list_resources");
    expect(shape.language).toBeDefined();
  });

  it("get_movement requires story and movement", () => {
    const shape = schemaShape("get_movement");
    expect(shape.story).toBeDefined();
    expect(shape.movement).toBeDefined();
  });

  it("search_content requires query", () => {
    const shape = schemaShape("search_content");
    expect(shape.query).toBeDefined();
  });

  it("get_pdf requires story", () => {
    const shape = schemaShape("get_pdf");
    expect(shape.story).toBeDefined();
  });
});
