import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Existing knowledge loaders resolve their data files relative to the repository.
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));

async function main() {
  const { callMcpTool, getMcpTools } = await import('../lib/chatbot/mcp');
  const endpoint = new URL('/api/mcp/context', process.env.POKEMON_TRACKER_URL ?? 'http://127.0.0.1:3000');
  if (endpoint.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) {
    throw new Error('POKEMON_TRACKER_URL must be a local HTTP URL.');
  }
  const server = new Server({ name: 'pokemon-tracker', version: '0.1.0' }, {
    capabilities: { tools: {} },
    instructions: 'Read-only Pokemon companion. Tools use the game selected in the most recently focused tracker tab: uploaded save or live emulator. Inspect state.source and filename. File snapshots do not expire by age; live tools reject cached snapshots by default. Keep the tracker page open. Do not describe file or stale data as current emulator memory. Use English canonical names. Reference tools accept game=emerald etc. No LLM API key is needed. Move base values have known historical-version limitations.',
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getMcpTools() }));
  server.setRequestHandler(CallToolRequestSchema, async request => callMcpTool(
    request.params.name, request.params.arguments ?? {}, async () => {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      if (!response.ok) throw new Error(`Tracker returned HTTP ${response.status}`);
      return response.json();
    },
  ));
  await server.connect(new StdioServerTransport());
}

main().catch(error => { console.error('[pokemon-mcp]', error); process.exitCode = 1; });
