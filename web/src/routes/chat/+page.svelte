<script lang="ts">
	/**
	 * Ezer chat for OBS Five Movements — same UI shell as Translation Helps
	 * (ChatDock + feed + X-ray), with OBS skillChat router underneath.
	 */
	import { tick, onMount } from 'svelte';
	import Zap from 'lucide-svelte/icons/zap';
	import AgentBadge from '$lib/components/ui/AgentBadge.svelte';
	import ChatDock from '$lib/components/chat/ChatDock.svelte';
	import SessionSidePanel from '$lib/components/ui/SessionSidePanel.svelte';
	import { withBase } from '$lib/paths.js';
	import { renderMarkdown, stripHiddenMarkers } from '$lib/renderMarkdown.js';
	import {
		studySession,
		setLanguagePair,
		setWorkflowMode,
		setSessionRole,
		resetSession
	} from '$lib/stores/studySession.js';
	import { parseWorkflowMode, type WorkflowMode } from '$lib/obs/workflowMode.js';
	import { parseSessionRole, type SessionRole } from '$lib/obs/sessionRole.js';

	interface ToolCallTrace {
		tool: string;
		params?: Record<string, unknown>;
		latencyMs?: number;
		ok: boolean;
		error?: string;
		summary?: string;
	}

	interface Message {
		role: 'user' | 'assistant';
		content: string;
		latencyMs?: number;
		model?: string;
		toolCalls?: ToolCallTrace[];
		mode?: 'compose' | 'error';
	}

	let messages: Message[] = [];
	let input = '';
	let isLoading = false;
	let model = 'gpt-4.1';
	let xrayEnabled = false;
	let xrayOpen = false;
	let xrayReport = '';
	let xrayEventCount = 0;
	let resourcesOpen = true;
	let feedEl: HTMLElement | null = null;

	$: session = $studySession;
	$: workflowMode = session.workflowMode;
	$: sessionRole = session.role;
	$: sourceLanguage = session.language;
	$: language = session.targetLanguage;
	$: story = session.story;

	const languages = [
		{ code: 'en', name: 'English' },
		{ code: 'id', name: 'Indonesian' }
	];

	onMount(() => {
		try {
			const raw = localStorage.getItem('obs_chat_prefs');
			if (raw) {
				const p = JSON.parse(raw) as {
					model?: string;
					xray?: boolean;
					story?: number;
					language?: string;
					mode?: string;
					role?: string;
				};
				if (p.model) model = p.model;
				if (typeof p.xray === 'boolean') xrayEnabled = p.xray;
				if (p.story) studySession.setStory(p.story);
				if (p.language) setLanguagePair(p.language, p.language);
				if (p.mode) setWorkflowMode(parseWorkflowMode(p.mode));
				if (p.role) setSessionRole(parseSessionRole(p.role));
			}
		} catch {
			/* ignore */
		}
		void tick().then(() => requestIntroGreeting());
	});

	/** Stream Ezer's intro (TH-style intent=intro; no user bubble). */
	async function requestIntroGreeting() {
		if (isLoading || messages.length) return;
		isLoading = true;
		const t0 = Date.now();
		messages = [{ role: 'assistant', content: '' }];
		try {
			const res = await fetch(withBase('/api/chat'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					intent: 'intro',
					messages: [],
					model,
					debug: xrayEnabled,
					language: sourceLanguage,
					story,
					mode: workflowMode,
					workflowMode: workflowMode,
					role: sessionRole
				})
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			await consumeSse(res, 0, t0);
			if (!messages[0]?.content) {
				messages[0] = {
					role: 'assistant',
					content:
						sessionRole === 'member'
							? 'Hi — I am Ezer (helper). I help group members study Open Bible Stories with the Five Movements. Which story (1–50, or by title) would you like to study?'
							: 'Hi — I am Ezer (helper). I help trainers and group leaders facilitate Five Movements sessions. Which story (1–50, or by title) will your group start with?',
					mode: 'compose',
					latencyMs: Date.now() - t0,
					model
				};
				messages = messages;
			}
		} catch (err) {
			messages = [
				{
					role: 'assistant',
					content:
						(sessionRole === 'member'
							? 'Hi — I am Ezer (helper). Which story (1–50, or by title) would you like to study?'
							: 'Hi — I am Ezer (helper). Which story (1–50, or by title) will your group start with?') +
						(err instanceof Error ? `\n\n_(Intro stream unavailable: ${err.message})_` : ''),
					mode: 'compose'
				}
			];
		} finally {
			isLoading = false;
			await scrollToBottom();
		}
	}

	function applyMeta(data: Record<string, unknown>) {
		if (typeof data.setStory === 'number' && data.setStory >= 1 && data.setStory <= 50) {
			studySession.setStory(data.setStory);
		}
		if (typeof data.setWorkflowMode === 'string') {
			setWorkflowMode(parseWorkflowMode(data.setWorkflowMode));
		}
		if (typeof data.setRole === 'string') {
			setSessionRole(parseSessionRole(data.setRole));
		}
		if (data.setPart === null) {
			studySession.setPart(null);
		} else if (typeof data.setPart === 'string') {
			studySession.setPart(data.setPart);
		}
	}

	async function consumeSse(res: Response, assistantIdx: number, t0: number) {
		const reader = res.body?.getReader();
		if (!reader) throw new Error('No response stream');
		const decoder = new TextDecoder();
		let buffer = '';
		let assembled = '';
		let toolCalls: ToolCallTrace[] = [];

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const parts = buffer.split('\n\n');
			buffer = parts.pop() || '';
			for (const part of parts) {
				const lines = part.split('\n');
				let event = 'message';
				let dataLine = '';
				for (const line of lines) {
					if (line.startsWith('event:')) event = line.slice(6).trim();
					if (line.startsWith('data:')) dataLine += line.slice(5).trim();
				}
				if (!dataLine) continue;
				let data: Record<string, unknown>;
				try {
					data = JSON.parse(dataLine) as Record<string, unknown>;
				} catch {
					continue;
				}
				if (event === 'meta') {
					applyMeta(data);
				}
				if (event === 'token') {
					assembled += String(data.text || data.delta || '');
					messages[assistantIdx] = {
						...messages[assistantIdx],
						content: assembled
					};
					messages = messages;
					await scrollToBottom();
				}
				if (event === 'done') {
					if (typeof data.response === 'string' && data.response) {
						assembled = data.response;
					}
					const rawTools = data.toolCalls as
						| Array<{ name: string; ok: boolean; ms?: number; summary?: string }>
						| undefined;
					toolCalls = (rawTools || []).map((t) => ({
						tool: t.name,
						ok: t.ok,
						latencyMs: t.ms,
						summary: t.summary
					}));
					if (typeof data.xrayReport === 'string' && data.xrayReport) {
						xrayReport = data.xrayReport;
						xrayEventCount = Array.isArray(data.xray) ? data.xray.length : toolCalls.length;
						if (xrayEnabled) xrayOpen = true;
					}
					if (typeof data.part === 'string') studySession.setPart(data.part);
					if (typeof data.story === 'number') studySession.setStory(data.story);
					if (typeof data.workflowMode === 'string') {
						setWorkflowMode(parseWorkflowMode(data.workflowMode));
					}
					messages[assistantIdx] = {
						role: 'assistant',
						content: assembled,
						latencyMs: Date.now() - t0,
						model,
						toolCalls,
						mode: data.mode === 'error' ? 'error' : 'compose'
					};
					messages = messages;
				}
				if (event === 'error') {
					messages[assistantIdx] = {
						role: 'assistant',
						content: `Error: ${String(data.message || 'unknown')}`,
						mode: 'error'
					};
					messages = messages;
				}
			}
		}
	}

	function persistPrefs() {
		localStorage.setItem(
			'obs_chat_prefs',
			JSON.stringify({
				model,
				xray: xrayEnabled,
				story,
				language: sourceLanguage,
				mode: workflowMode,
				role: sessionRole
			})
		);
	}

	$: model, xrayEnabled, story, sourceLanguage, workflowMode, sessionRole, persistPrefs();

	async function scrollToBottom() {
		await tick();
		if (feedEl) feedEl.scrollTop = feedEl.scrollHeight;
	}

	function outboundHistory(): Array<{ role: string; content: string }> {
		return messages
			.filter((m) => m.role === 'user' || m.role === 'assistant')
			.filter((m) => m.mode !== 'error')
			// Drop in-progress empty assistant placeholders so history ends on a user turn.
			.filter((m) => !(m.role === 'assistant' && !m.content?.trim()))
			.map((m) => ({ role: m.role, content: m.content }));
	}

	async function sendMessage(text?: string, opts?: { workflowModeExplicit?: boolean }) {
		const content = (text ?? input).trim();
		if (!content || isLoading) return;
		input = '';
		const userMsg: Message = { role: 'user', content };
		messages = [...messages, userMsg];
		await scrollToBottom();
		isLoading = true;
		const t0 = Date.now();
		const history = outboundHistory();
		const assistantIdx = messages.length;
		messages = [...messages, { role: 'assistant', content: '' }];

		try {
			const res = await fetch(withBase('/api/chat'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: history,
					model,
					debug: xrayEnabled,
					language: sourceLanguage,
					story,
					mode: workflowMode,
					workflowMode,
					workflowModeExplicit: opts?.workflowModeExplicit === true,
					role: sessionRole,
					part: session.part
				})
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
			}
			await consumeSse(res, assistantIdx, t0);
		} catch (err) {
			messages[assistantIdx] = {
				role: 'assistant',
				content: `Error: ${err instanceof Error ? err.message : String(err)}`,
				mode: 'error'
			};
			messages = messages;
		} finally {
			isLoading = false;
			await scrollToBottom();
		}
	}

	function handleQuickAction(prompt: string) {
		sendMessage(prompt);
	}

	function handleSelectPart(part: string) {
		studySession.setPart(part);
		sendMessage(
			`Open part=${part} for OBS story ${story} (language ${sourceLanguage}) using fetch_obs_study_manual. Facilitate with the exact content returned.`
		);
	}

	function clearChat() {
		messages = [];
		xrayReport = '';
		xrayEventCount = 0;
		xrayOpen = false;
		void requestIntroGreeting();
	}

	function htmlFor(content: string): string {
		return renderMarkdown(stripHiddenMarkers(content));
	}
</script>

<svelte:head>
	<title>Ezer · OBS Five Movements</title>
</svelte:head>

<div class="flex flex-col bg-slate-950 text-slate-100" style="height: var(--vvh, 100dvh)">
	<header
		class="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur"
	>
		<div class="min-w-0 flex-1">
			<h1 class="text-sm font-semibold tracking-tight text-white">Ezer</h1>
			<p class="truncate text-[11px] text-slate-500">
				Helper for OBS Five Movements · formation for translation communities
				<a class="ml-1 text-sky-400 hover:underline" href={withBase('/docs')}>Docs</a>
			</p>
		</div>
		<button
			type="button"
			class="hidden rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-sky-500 lg:inline-flex"
			class:border-sky-500={resourcesOpen}
			class:text-sky-200={resourcesOpen}
			on:click={() => (resourcesOpen = !resourcesOpen)}
		>
			Session
		</button>
	</header>

	<div class="flex min-h-0 flex-1">
		<div class="flex min-w-0 flex-1 flex-col">
			<div bind:this={feedEl} class="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
				{#each messages as msg, i (i)}
					<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div
							class="max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[85%]
								{msg.role === 'user'
								? 'bg-sky-950/80 text-sky-50'
								: 'border border-slate-800 bg-slate-900/80 text-slate-100'}"
						>
							{#if msg.role === 'assistant'}
								<div class="mb-1.5 flex items-center gap-1.5">
									<AgentBadge agent="guide" />
									{#if msg.model}
										<span class="text-[10px] text-slate-500">{msg.model}</span>
									{/if}
									{#if msg.latencyMs}
										<span class="text-[10px] text-slate-600">{msg.latencyMs}ms</span>
									{/if}
								</div>
								<div class="prose-chat">{@html htmlFor(msg.content)}</div>
								{#if msg.toolCalls?.length}
									<div class="mt-2 border-t border-slate-800 pt-1.5 text-[10px] text-slate-500">
										Tools:
										{#each msg.toolCalls as t}
											<span class="mr-1.5 inline-flex items-center gap-0.5">
												<Zap size={10} />
												{t.tool}{t.ok ? '' : '✗'}
											</span>
										{/each}
									</div>
								{/if}
							{:else}
								<div class="whitespace-pre-wrap">{msg.content}</div>
							{/if}
						</div>
					</div>
				{/each}
				{#if isLoading}
					<div class="text-center text-xs text-amber-300/90">Working…</div>
				{/if}
			</div>

			{#if xrayOpen && xrayEnabled && xrayReport}
				<div class="max-h-56 shrink-0 overflow-auto border-t border-slate-800 bg-slate-950">
					<div class="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
						<span class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase"
							>X-ray</span
						>
						<button
							type="button"
							class="text-[11px] text-slate-500 hover:text-white"
							on:click={() => (xrayOpen = false)}>Close</button
						>
					</div>
					<pre class="whitespace-pre-wrap p-3 font-mono text-[10px] leading-relaxed text-slate-400"
						>{xrayReport}</pre
					>
				</div>
			{/if}

			<ChatDock
				bind:input
				bind:model
				{language}
				{sourceLanguage}
				{languages}
				{isLoading}
				hasMessages={messages.length > 0}
				xrayActive={xrayOpen}
				{xrayEnabled}
				{xrayEventCount}
				resourceCount={11}
				{resourcesOpen}
				{workflowMode}
				{sessionRole}
				{story}
				on:send={() => sendMessage()}
				on:quickAction={(e) => handleQuickAction(e.detail)}
				on:toggleXray={() => {
					xrayEnabled = !xrayEnabled;
					xrayOpen = xrayEnabled && Boolean(xrayReport);
				}}
				on:clearChat={clearChat}
				on:resetSession={() => {
					resetSession();
					clearChat();
				}}
				on:openResources={() => (resourcesOpen = !resourcesOpen)}
				on:workflowModeChange={(e) => setWorkflowMode(e.detail as WorkflowMode)}
				on:sessionRoleChange={(e) => {
					setSessionRole(e.detail as SessionRole);
					void sendMessage(
						e.detail === 'member'
							? 'I am joining as a group member. Help me participate in the Five Movements study.'
							: 'I am the group leader / trainer. Help me facilitate the Five Movements session.',
						{ workflowModeExplicit: true }
					);
				}}
				on:sourceLanguageChange={(e) => setLanguagePair(e.detail, language)}
				on:languageChange={(e) => setLanguagePair(sourceLanguage, e.detail)}
			/>
		</div>

		<!-- Desktop session panel (replaces TH scripture/TN/TW side panel) -->
		{#if resourcesOpen}
			<div class="hidden min-h-0 w-[min(100%,20rem)] shrink-0 lg:block">
				<SessionSidePanel
					{story}
					language={sourceLanguage}
					mode={workflowMode}
					activePart={session.part}
					open={true}
					on:close={() => (resourcesOpen = false)}
					on:selectPart={(e) => handleSelectPart(e.detail)}
					on:selectStory={(e) => studySession.setStory(e.detail)}
				/>
			</div>
		{/if}
	</div>

	<!-- Mobile session sheet -->
	{#if resourcesOpen}
		<div class="fixed inset-0 z-40 bg-black/50 lg:hidden" on:click={() => (resourcesOpen = false)} on:keydown={() => {}} role="presentation"></div>
		<div class="fixed inset-y-0 right-0 z-50 w-[min(100%,20rem)] lg:hidden">
			<SessionSidePanel
				{story}
				language={sourceLanguage}
				mode={workflowMode}
				activePart={session.part}
				open={true}
				on:close={() => (resourcesOpen = false)}
				on:selectPart={(e) => {
					handleSelectPart(e.detail);
					resourcesOpen = false;
				}}
				on:selectStory={(e) => studySession.setStory(e.detail)}
			/>
		</div>
	{/if}
</div>
