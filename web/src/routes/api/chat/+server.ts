/**
 * POST /api/chat — same SSE contract as Translation Helps chat,
 * backed by OBS Five Movements in-process tool loop (not scripture harness).
 */

import type { RequestHandler } from './$types';
import { handleChatRequest } from '$chat/chatHandler.js';
import type { Env } from '../../../mcp-env';

function platformEnv(platform: App.Platform | undefined): Env {
	const env = (platform?.env ?? {}) as Env;
	return env;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	return handleChatRequest(request, platformEnv(platform));
};

export const OPTIONS: RequestHandler = async ({ request, platform }) => {
	return handleChatRequest(request, platformEnv(platform));
};
