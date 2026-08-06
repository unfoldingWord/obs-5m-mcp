import { listLanguagesTool } from "./tools/listLanguages.js";
import { listResourcesTool } from "./tools/listResources.js";
import { listCollectionsTool } from "./tools/listCollections.js";
import { listStoriesTool } from "./tools/listStories.js";
import { getFrameworkTool } from "./tools/getFramework.js";
import { getStoryTool } from "./tools/getStory.js";
import { getMovementTool } from "./tools/getMovement.js";
import { getDevotionalTool } from "./tools/getDevotional.js";
import { getStudyGuideTool } from "./tools/getStudyGuide.js";
import { fetchObsStudyManualTool } from "./tools/fetchObsStudyManual.js";
import { getPdfTool } from "./tools/getPdf.js";
import { searchContentTool } from "./tools/searchContent.js";
import type { ToolModule, AnyZodSchema } from "./tools/shared.js";

export const MCP_TOOLS: ToolModule<AnyZodSchema>[] = [
  listLanguagesTool,
  listResourcesTool,
  listCollectionsTool,
  listStoriesTool,
  getFrameworkTool,
  fetchObsStudyManualTool,
  getStoryTool,
  getMovementTool,
  getDevotionalTool,
  getStudyGuideTool,
  getPdfTool,
  searchContentTool,
];

export const TOOL_REGISTRY = Object.fromEntries(
  MCP_TOOLS.map((t) => [t.name, t]),
) as Record<string, ToolModule<AnyZodSchema>>;
