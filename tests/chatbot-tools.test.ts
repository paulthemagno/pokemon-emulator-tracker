import assert from "node:assert/strict";
import test from "node:test";
import { OllamaProvider } from "../lib/chatbot/providers/ollama";
import type { GameContextSnapshot } from "../lib/chatbot/types";

const crystalContext: GameContextSnapshot = {
  trainerName: "Kris",
  location: "Goldenrod City",
  money: 1200,
  playtime: { hours: 4, minutes: 10, seconds: 0 },
  badges: 2,
  partyPokemon: [],
  partyPokemonDetailed: [],
  pokedexSeen: 20,
  pokedexOwned: 8,
  pokedexSeenList: [],
  pokedexCaughtList: [],
  inventory: [],
  gameTitle: "Pokémon CRYSTAL",
  timestamp: 0,
};

test("move reference returns local move data and PokeAPI provenance", () => {
  const provider = new OllamaProvider();
  const result = provider.executeTool(
    "get_move_reference",
    { moveName: "Thunder Punch", game: "Crystal" },
    crystalContext
  );

  assert.equal(result.name, "Thunder Punch");
  assert.equal(result.type, "electric");
  assert.equal(result.appliesTo, "crystal");
  assert.deepEqual(result.source, {
    kind: "pokeapi",
    name: "PokeAPI",
    url: "https://pokeapi.co/api/v2/move/thunder-punch",
  });
});

test("game guidance search stays scoped to the loaded game and includes sources", () => {
  const provider = new OllamaProvider();
  const result = provider.executeTool(
    "search_game_guidance",
    { query: "radio tower", limit: 3 },
    crystalContext
  );

  assert.equal(result.game, "Pokemon Crystal");
  assert.ok(Array.isArray(result.matches));
  assert.ok((result.matches as unknown[]).length > 0);
  assert.ok(Array.isArray(result.generalGuideSources));
  assert.ok((result.generalGuideSources as unknown[]).length >= 2);
});

test("Ollama requests preserve image history and can disable thinking", async () => {
  const originalFetch = globalThis.fetch;
  let chatBody: Record<string, unknown> | undefined;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/tags")) {
      return Response.json({ models: [{ name: "vision-test" }] });
    }

    chatBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      message: {
        role: "assistant",
        content: "Image received.",
      },
    });
  };

  try {
    const provider = new OllamaProvider();
    await provider.initialize({
      endpoint: "http://127.0.0.1:11434",
      modelName: "vision-test",
      thinking: false,
    });

    await provider.sendMessage(
      "What was in the previous image?",
      [
        {
          role: "user",
          content: "Inspect this.",
          timestamp: 1,
          attachments: [
            {
              kind: "image",
              name: "screen.png",
              mediaType: "image/png",
              data: "aW1hZ2U=",
            },
          ],
        },
      ]
    );

    assert.equal(chatBody?.think, false);
    const messages = chatBody?.messages as Array<{ images?: string[] }>;
    assert.deepEqual(messages[1].images, ["aW1hZ2U="]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
