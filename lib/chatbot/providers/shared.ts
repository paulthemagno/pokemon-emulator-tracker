import type {
  ChatMessage,
  ChatSource,
  GameContextSnapshot,
} from '../types';
import type { ChatToolDefinition } from '../tools/registry';

export type ToolRegistry = typeof import('../tools/registry');

let toolRegistryPromise: Promise<ToolRegistry> | null = null;

const DEBUG_JSON_PREVIEW_CHARS = 2000;

export function areChatToolsEnabled(): boolean {
  return process.env.CHAT_ENABLE_TOOLS !== 'false';
}

export async function loadChatToolRegistry(
  log?: (message: string) => void
): Promise<ToolRegistry> {
  if (!toolRegistryPromise) {
    const startedAt = Date.now();
    log?.('Loading chatbot tool registry...');
    toolRegistryPromise = import('../tools/registry').then((registry) => {
      log?.(`Chatbot tool registry loaded in ${Date.now() - startedAt}ms`);
      return registry;
    });
  }
  return toolRegistryPromise;
}

export const DEFAULT_CHAT_SYSTEM_PROMPT = `You are a Pokémon gameplay co-pilot.
Use only provided state or tool results. Do not invent data.
Give one concrete next action with brief tactical reason.
If data is missing, ask a specific follow-up question.
Keep answers concise and practical.`;

export const CHAT_TOOL_POLICY = `Tool policy:
- For factual Pokemon gameplay questions, use a local tool before answering unless the user is only asking a conversational or configuration question.
- If the user explicitly names a game, that game overrides the loaded save/live context for reference questions.
- Use get_encounters for "where can I find/catch this Pokemon", wild encounter, fishing, surfing, grass, cave, or location availability questions.
- Use search_game_guidance for game progression, location, puzzle, walkthrough, and "how do I continue" questions, even when no save is loaded.
- Include the game argument when the user names a game.
- The guide index uses canonical English source names. Keep query as the original user question. Use canonicalQuery as a concise English rewrite of the user's information need using official source names and only entities/objectives present in the question.
- Do not put solution details in canonicalQuery or keywords unless the user already mentioned them.
- Use official English aliases that help source matching, but do not introduce a different game, location, character, team, or objective than the user's current question.
- After a tool error or an empty guidance result, correct the tool arguments once if they were clearly incomplete. If no source-backed match is found and you still know the answer, you may answer from general knowledge, but explicitly say that no local source-backed match was found and that you are using your own knowledge. Do not invent citations.
- For successful guidance results, use the returned matches first and preserve version-specific limitations.
- A successful general guidance result does not require save-state tools. Answer it directly without requesting trainer, story, party, Pokedex, or inventory state.`;

export const TOOL_RESULT_SYNTHESIS_PROMPT = `Answer the original Pokémon question using only the successful tool results below.
Tool calling is disabled for this synthesis step.
Reply in the same language as the original question.
Do not mix languages.
For encounter results, include the encounter method and a few relevant locations when available.
If the useful tool results are insufficient, say exactly what is missing instead of inventing data.
Do not include a sources, citations, links, or references section. The application renders sources separately.`;

export const RETAINED_KNOWLEDGE_PROMPT = `Use the retained verified Pokémon knowledge to answer the follow-up.
Reply in the user's language and do not invent facts.
Do not include a sources, citations, links, or references section. The application renders sources separately.
If the retained knowledge is insufficient or unrelated, reply with exactly NEED_TOOL.`;

export function withRetainedKnowledge(message: ChatMessage): string {
  return message.role === 'assistant' && message.knowledgeContext
    ? `${message.content}\n\n[Verified knowledge retained from earlier tool calls]\n${message.knowledgeContext}`
    : message.content;
}

export function getRetainedKnowledge(history: ChatMessage[]): string[] {
  return history
    .map((message) => message.knowledgeContext)
    .filter((value): value is string => Boolean(value))
    .slice(-3);
}

export function formatIdentityContext(context?: GameContextSnapshot): string {
  if (!context) {
    return '';
  }
  const lines = [
    '',
    'Known active game identity:',
    context.gameTitle ? `- Game: ${context.gameTitle}` : undefined,
    context.trainerName ? `- Trainer: ${context.trainerName}` : undefined,
    context.location ? `- Current location: ${context.location}` : undefined,
  ].filter(Boolean);
  return `\n\n${lines.join('\n')}`;
}

export function formatGameContext(context: GameContextSnapshot): string {
  return JSON.stringify(
    {
      trainerName: context.trainerName,
      gameTitle: context.gameTitle,
      location: context.location,
      badges: context.badges,
      party: context.partyPokemonDetailed ?? context.partyPokemon,
      pokedex: {
        seen: context.pokedexSeen,
        owned: context.pokedexOwned,
      },
      inventory: context.inventory.slice(0, 30),
      progressFacts: context.progressFacts ?? [],
    },
    null,
    2
  );
}

export function parseToolArguments(rawArgs: unknown): Record<string, unknown> {
  if (!rawArgs) {
    return {};
  }
  if (typeof rawArgs === 'string') {
    try {
      const parsed = JSON.parse(rawArgs);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof rawArgs === 'object' && !Array.isArray(rawArgs)) {
    return rawArgs as Record<string, unknown>;
  }
  return {};
}

export function stringifyForChatDebug(value: unknown): string {
  try {
    const text = JSON.stringify(value, (key, entry) => {
      if (key === '_queryEmbedding' && Array.isArray(entry)) {
        return `[${entry.length} embedding values]`;
      }
      return entry;
    });
    if (!text) {
      return String(value);
    }
    return text.length > DEBUG_JSON_PREVIEW_CHARS
      ? `${text.slice(0, DEBUG_JSON_PREVIEW_CHARS)}...[truncated]`
      : text;
  } catch {
    return String(value);
  }
}

export function logToolProviderEvent(provider: string, message: string): void {
  console.log(`[${provider} DEBUG][TOOLS] ${message}`);
}

export function logToolProviderAvailableTools(
  provider: string,
  tools: ChatToolDefinition[]
): void {
  logToolProviderEvent(
    provider,
    `Available tools: ${tools.map((tool) => tool.function.name).join(', ')}`
  );
}

export function logToolCallDebug(
  provider: string,
  name: string,
  args: Record<string, unknown>,
  result: Record<string, unknown>,
  options: {
    normalizedArgs?: Record<string, unknown>;
    duplicate?: boolean;
  } = {}
): void {
  logToolProviderEvent(provider, `CALL ${name || '<empty-name>'}`);
  console.log(`[${provider} DEBUG][TOOLS] args:`, stringifyForChatDebug(args));
  if (options.normalizedArgs) {
    console.log(
      `[${provider} DEBUG][TOOLS] normalized args:`,
      stringifyForChatDebug(options.normalizedArgs)
    );
  }
  if (options.duplicate) {
    logToolProviderEvent(provider, 'duplicate: true');
  }
  console.log(`[${provider} DEBUG][TOOLS] result:`, stringifyForChatDebug(result));
}

export function getToolCallSignature(
  name: string,
  args: Record<string, unknown>
): string {
  const stableArgs = Object.fromEntries(
    Object.entries(args)
      .filter(([key]) => !key.startsWith('_'))
      .sort(([left], [right]) => left.localeCompare(right))
  );
  return JSON.stringify({ name, args: stableArgs });
}

export function duplicateToolCallResult(name: string): Record<string, unknown> {
  const message =
    'Duplicate tool call with identical arguments. Use the previous tool result, change the arguments, or answer the user.';
  return {
    ok: false,
    error: message,
    tool: name,
    sources: [],
    limitations: [],
    confidence: 'unresolved',
    errorDetail: {
      code: 'DUPLICATE_TOOL_CALL',
      message,
    },
  };
}

export function missingGameContextToolResult(name: string): Record<string, unknown> {
  const message = 'This tool requires a loaded save or live game state.';
  return {
    ok: false,
    error: message,
    tool: name,
    sources: [],
    limitations: [],
    confidence: 'unresolved',
    errorDetail: {
      code: 'INVALID_ARGUMENT',
      message,
    },
  };
}

export function getToolResultData(
  result: Record<string, unknown>
): Record<string, unknown> {
  return result.data && typeof result.data === 'object'
    ? (result.data as Record<string, unknown>)
    : {};
}

export function stripSourceMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripSourceMetadata(entry));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (
      key === 'sources' ||
      key === 'source' ||
      key === 'sourceRefs' ||
      key === 'url' ||
      key === 'displayName' ||
      key === 'siteName' ||
      key === 'icon' ||
      key === 'logoUrl'
    ) {
      continue;
    }
    result[key] = stripSourceMetadata(nestedValue);
  }
  return result;
}

export function stripSourceMetadataFromString(value: string): unknown {
  try {
    return stripSourceMetadata(JSON.parse(value));
  } catch {
    return value;
  }
}

export function compactToolResultForModel(
  result: Record<string, unknown>
): Record<string, unknown> {
  const data = getToolResultData(result);
  const compactData = { ...data };

  compactArrayFieldForModel(compactData, 'entries', 12);
  compactArrayFieldForModel(compactData, 'matches', 8);
  compactArrayFieldForModel(compactData, 'locationSummaries', 24);

  return stripSourceMetadata({
    ok: result.ok,
    tool: result.tool,
    gameProfile: result.gameProfile,
    summary: compactData.summary,
    answerPolicy: compactData.answerPolicy,
    data: compactData,
    limitations: result.limitations,
  }) as Record<string, unknown>;
}

export function formatToolResultForModel(
  toolName: string,
  result: Record<string, unknown>
): string {
  return `Latest tool result "${toolName}" succeeded. If this result contains enough information to answer the user's question, answer directly from it. Do not ask for fields already present in the tool result, such as game, species, item, location, method, or summary.

${JSON.stringify(compactToolResultForModel(result))}`;
}

export function compactArrayFieldForModel(
  data: Record<string, unknown>,
  fieldName: string,
  limit: number
): void {
  const value = data[fieldName];
  if (!Array.isArray(value) || value.length <= limit) {
    return;
  }

  data[fieldName] = value.slice(0, limit);
  data[`${fieldName}Total`] = value.length;
  data[`${fieldName}Omitted`] = value.length - limit;
}

export function normalizeSources(value: unknown): ChatSource[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((source): ChatSource | undefined => {
      if (!source || typeof source !== 'object') {
        return undefined;
      }
      const record = source as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name : 'Source';
      const kind = typeof record.kind === 'string' ? record.kind : 'reference';
      const url = typeof record.url === 'string' ? record.url : undefined;
      const scope = typeof record.scope === 'string' ? record.scope : undefined;
      const displayName =
        typeof record.displayName === 'string' ? record.displayName : undefined;
      const siteName = typeof record.siteName === 'string' ? record.siteName : undefined;
      const icon = typeof record.icon === 'string' ? record.icon : undefined;
      const logoUrl = typeof record.logoUrl === 'string' ? record.logoUrl : undefined;
      return {
        kind,
        name,
        ...(url ? { url } : {}),
        ...(scope ? { scope } : {}),
        ...(displayName ? { displayName } : {}),
        ...(siteName ? { siteName } : {}),
        ...(icon ? { icon } : {}),
        ...(logoUrl ? { logoUrl } : {}),
      };
    })
    .filter((source): source is ChatSource => Boolean(source))
    .filter(
      (source, index, all) =>
        !source.url ||
        all.findIndex((candidate) => candidate.url === source.url) === index
    )
    .slice(0, 8);
}

export function extractRetainedSources(retainedKnowledge: string[]): ChatSource[] {
  for (const retained of [...retainedKnowledge].reverse()) {
    try {
      const parsed = JSON.parse(retained) as { sources?: unknown };
      const sources = normalizeSources(parsed.sources);
      if (sources.length > 0) {
        return sources;
      }
    } catch {
      // Ignore old retained snippets that were not JSON.
    }
  }
  return [];
}

export function buildKnowledgeContext(
  tool: string,
  result: Record<string, unknown>
): string {
  const resultData = getToolResultData(result);
  return JSON.stringify({
    tool,
    game: resultData.game,
    gameProfile: result.gameProfile,
    data: result.data,
    sources: result.sources,
    limitations: result.limitations,
  });
}

export function buildToolLoopKnowledgeContext(
  originalQuestion: unknown,
  successfulToolResults: Array<{ tool: string; result: Record<string, unknown> }>
): string {
  return JSON.stringify({
    originalQuestion,
    toolResults: compactSuccessfulToolResults(successfulToolResults),
  });
}

export function compactSuccessfulToolResults(
  successfulToolResults: Array<{ tool: string; result: Record<string, unknown> }>
): Array<Record<string, unknown>> {
  return successfulToolResults.map(({ tool, result }) => {
    const resultData = getToolResultData(result);
    return {
      tool,
      game: resultData.game,
      gameProfile: result.gameProfile,
      data: result.data,
      sources: result.sources,
      limitations: result.limitations,
    };
  });
}

export async function getToolDefinitions(): Promise<ChatToolDefinition[]> {
  return (await loadChatToolRegistry()).getChatToolDefinitions();
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context?: GameContextSnapshot
): Promise<Record<string, unknown>> {
  return (await loadChatToolRegistry()).executeChatTool(toolName, args, context);
}
