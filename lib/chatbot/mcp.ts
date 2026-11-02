import { canExecuteToolWithoutContext, executeChatTool, getChatToolDefinitions } from './tools/registry';
import type { GameContextSnapshot } from './types';

type GameSnapshot = { success: boolean; source?: 'file' | 'live'; game?: string; filename?: string | null;
  stale?: boolean; updatedAt?: number; context?: GameContextSnapshot; error?: string;
  sessionId?: string | null; receivedAt?: number; browserConnected?: boolean };

export function getMcpTools() {
  return getChatToolDefinitions().map(({ function: tool }) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: {
      ...tool.parameters,
      properties: {
        ...(tool.parameters.properties as Record<string, unknown>),
        allowStale: { type: 'boolean', description: 'Explicitly allow cached live data. Default false; inspect live metadata before treating it as current.' },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }));
}

export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  fetchSelection: () => Promise<GameSnapshot>,
  now?: number,
) {
  const reply = (payload: Record<string, unknown>, isError = false) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
    structuredContent: payload,
    isError,
  });
  if (!getChatToolDefinitions().some(t => t.function.name === name)) {
    return reply({ ok: false, error: `Unknown tool: ${name}` }, true);
  }
  const { allowStale, ...toolArgs } = args;
  const reference = canExecuteToolWithoutContext(name);
  const requiresContext = !reference || (name === 'get_item_location' && toolArgs.obtainedOnly === true);
  let snapshot: GameSnapshot | undefined;
  let connectionError: string | undefined;
  // Even reference tools can use selected inventory (e.g. obtainedOnly). Failure
  // to fetch context must not prevent independent reference lookups offline.
  try { snapshot = await fetchSelection(); }
  catch (error) { connectionError = error instanceof Error ? error.message : String(error); }
  const updatedAt = snapshot?.updatedAt;
  const observedAt = now ?? Date.now();
  const ageSeconds = typeof updatedAt === 'number' ? Math.max(0, (observedAt - updatedAt) / 1000) : null;
  const usable = snapshot?.success === true && Boolean(snapshot.context) && Boolean(snapshot.source);
  const stale = snapshot?.source === 'live' && (snapshot.stale === true || ageSeconds === null || ageSeconds > 5);
  const state = { available: usable, source: snapshot?.source ?? null, filename: snapshot?.filename ?? null,
    browserConnected: snapshot?.browserConnected ?? null,
    sessionId: snapshot?.sessionId ?? null, receivedAt: snapshot?.receivedAt ?? null,
    stale, updatedAt: updatedAt ?? null, ageSeconds,
    error: connectionError ?? snapshot?.error ?? null };
  if (requiresContext && (!usable || (stale && allowStale !== true))) {
    return reply({ ok: false, error: usable
      ? 'Live state is cached. Resume mGBA and retry, or explicitly set allowStale=true to inspect the last snapshot.'
      : 'No selected game state. Open or focus the tracker and load a save or start live mode.', state }, true);
  }
  const context = usable && (!stale || allowStale === true) ? structuredClone(snapshot!.context!) : undefined;
  if (context) {
    context.timestamp = updatedAt ?? observedAt;
  }
  // Cached game identity may scope reference data, but must not supply live player facts.
  if (reference && !toolArgs.game && usable) toolArgs.game = snapshot!.game ?? snapshot!.context!.gameTitle;
  const result = executeChatTool(name, toolArgs, context);
  return reply({ ...result, state, ...((reference || ['get_pokemon_details', 'get_game_state'].includes(name)) ? {
    knowledgeWarning: 'Existing local move power/accuracy tables are not fully version-specific. Verify historical values before damage calculations.',
  } : {}) }, !result.ok);
}
