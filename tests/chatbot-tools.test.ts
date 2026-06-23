import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { OllamaProvider } from "../lib/chatbot/providers/ollama";
import type { GameContextSnapshot } from "../lib/chatbot/types";
import {
  canExecuteToolWithoutContext,
  executeChatTool,
  getChatToolDefinitions,
} from "../lib/chatbot/tools/registry";

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

function readGuideEmbeddingVector(predicate: (record: {
  games?: string[];
  parentSection?: string;
  section?: string;
}) => boolean) {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        "lib/pokemon/knowledge/walkthrough-embeddings.manifest.json"
      ),
      "utf8"
    )
  ) as {
    model: string;
    dimensions: number;
    vectorFile: string;
    records: Array<{
      index: number;
      games?: string[];
      parentSection?: string;
      section?: string;
    }>;
  };
  const record = manifest.records.find(predicate);
  assert.ok(record, "expected guide embedding record to exist");
  const vectors = fs.readFileSync(
    path.join(process.cwd(), "lib/pokemon/knowledge", manifest.vectorFile)
  );
  const vector: number[] = [];
  for (let index = 0; index < manifest.dimensions; index += 1) {
    vector.push(
      vectors.readFloatLE((record.index * manifest.dimensions + index) * 4)
    );
  }
  return { model: manifest.model, vector };
}

test("move reference returns local move data and PokeAPI provenance", async () => {
  const provider = new OllamaProvider();
  const result = await provider.executeTool(
    "get_move_reference",
    { moveName: "Thunder Punch", game: "Crystal" },
    crystalContext
  );

  assert.equal(result.name, "Thunder Punch");
  assert.equal(result.type, "electric");
  assert.equal(result.appliesTo, "crystal");
  assert.deepEqual(result.source, {
    kind: "pokeapi",
    name: "PokeAPI local snapshot",
    url: "https://pokeapi.co/api/v2/move/thunder-punch",
    scope: "crystal",
  });
});

test("shared registry exposes reference tools that work without game state", () => {
  const names = getChatToolDefinitions().map((tool) => tool.function.name);

  assert.ok(names.includes("get_species"));
  assert.ok(names.includes("get_type_matchup"));
  assert.ok(names.includes("get_evolution"));
  assert.ok(names.includes("get_learnset"));
  assert.ok(names.includes("get_encounters"));
  assert.ok(names.includes("get_item"));
  assert.ok(names.includes("get_item_location"));
  assert.equal(canExecuteToolWithoutContext("get_species"), true);
  assert.equal(canExecuteToolWithoutContext("get_learnset"), true);
  assert.equal(canExecuteToolWithoutContext("get_encounters"), true);
  assert.equal(canExecuteToolWithoutContext("get_item"), true);
  assert.equal(canExecuteToolWithoutContext("get_item_location"), true);
  assert.equal(canExecuteToolWithoutContext("get_inventory_overview"), false);

  const result = executeChatTool("get_species", { species: "Bulbasaur" });
  assert.equal(result.ok, true);
  assert.equal(result.name, "Bulbasaur");
  assert.deepEqual(result.types, ["grass", "poison"]);
});

test("type matchup applies generation-specific rules and dual-type multipliers", () => {
  const gen1Ghost = executeChatTool("get_type_matchup", {
    attackingType: "ghost",
    defenderSpecies: "Alakazam",
    generation: 1,
  });
  assert.equal(gen1Ghost.multiplier, 0);

  const electricVsGyarados = executeChatTool("get_type_matchup", {
    move: "Thunderbolt",
    defenderSpecies: "Gyarados",
    game: "Crystal",
  });
  assert.equal(electricVsGyarados.multiplier, 4);
  assert.equal(electricVsGyarados.effectiveness, "super-effective");

  const groundVsGen1Magnemite = executeChatTool("get_type_matchup", {
    attackingType: "ground",
    defenderSpecies: "Magnemite",
    game: "Yellow",
  });
  assert.equal(groundVsGen1Magnemite.multiplier, 2);
});

test("evolution lookup uses the local snapshot and respects game generation", () => {
  const result = executeChatTool("get_evolution", {
    species: "Golbat",
    game: "Crystal",
  });
  const evolvesTo = result.evolvesTo as Array<{
    to: string;
    details: Array<{ trigger?: string; summary?: string }>;
  }>;

  assert.equal(result.ok, true);
  assert.ok(evolvesTo.some((edge) => edge.to === "Crobat"));
  assert.ok(
    evolvesTo.some((edge) =>
      edge.details.some((detail) => detail.trigger === "level-up")
    )
  );
  assert.ok(
    evolvesTo.some((edge) =>
      edge.details.some((detail) =>
        detail.summary?.includes("at least 160 happiness")
      )
    )
  );
});

test("learnset lookup uses the local snapshot and checks game-specific move availability", () => {
  const result = executeChatTool("get_learnset", {
    species: "Pikachu",
    game: "Yellow",
    move: "Thunderbolt",
  });

  assert.equal(result.ok, true);
  assert.equal(result.game, "yellow");
  assert.equal(result.learnsMove, true);
  assert.equal((result.requestedMove as { name: string }).name, "Thunderbolt");
  assert.ok(
    (result.entries as Array<{ method: string }>).some(
      (entry) => entry.method === "level-up" || entry.method === "machine"
    )
  );
});

test("learnset lookup filters level-up moves by level and requires a game", () => {
  const result = executeChatTool("get_learnset", {
    species: "Marshtomp",
    game: "Emerald",
    methods: ["level-up"],
    levelMax: 20,
  });

  assert.equal(result.ok, true);
  assert.ok((result.entries as Array<{ level?: number }>).length > 0);
  assert.ok(
    (result.entries as Array<{ level?: number }>).every(
      (entry) => typeof entry.level === "number" && entry.level <= 20
    )
  );

  const missingGame = executeChatTool("get_learnset", {
    species: "Pikachu",
    move: "Thunderbolt",
  });
  const errorDetail = missingGame.errorDetail as { code?: string } | undefined;
  assert.equal(missingGame.ok, false);
  assert.equal(errorDetail?.code, "AMBIGUOUS_GAME");
});

test("item lookup returns local metadata and version-scoped aliases", () => {
  const result = executeChatTool("get_item", {
    item: "Exp. Share",
    game: "Crystal",
  });
  const entries = result.entries as Array<{
    name: string;
    flavorText?: string;
    profiles: string[];
  }>;

  assert.equal(result.ok, true);
  assert.equal(result.game, "crystal");
  assert.ok(entries.some((entry) => entry.name === "Exp. Share"));
  assert.ok(entries.some((entry) => entry.profiles.includes("crystal")));
  assert.ok(entries.some((entry) => /Exp|experience|battle/i.test(entry.flavorText ?? "")));
});

test("item location lookup retrieves reviewed walkthrough sections", () => {
  const result = executeChatTool("get_item_location", {
    item: "Mach Bike",
    game: "Emerald",
    canonicalQuery: "Mach Bike location Pokemon Emerald",
    limit: 3,
  });
  const matches = result.matches as Array<{
    description: string;
    sourceRefs: string[];
  }>;

  assert.equal(result.ok, true);
  assert.equal(result.game, "emerald");
  assert.ok(matches.length > 0);
  assert.ok(
    matches.some((match) => /Mach Bike|Bike Shop|Rydel/i.test(match.description))
  );
  assert.ok(matches.some((match) => match.sourceRefs.some((url) => url.includes("bulbapedia"))));
});

test("encounter lookup uses the local snapshot and filters by species, location, and method", () => {
  const result = executeChatTool("get_encounters", {
    species: "Ralts",
    game: "Emerald",
    location: "Route 102",
    method: "walk",
  });
  const entries = result.entries as Array<{
    species: string;
    locationArea: string;
    method: string;
    minLevel: number;
    maxLevel: number;
  }>;
  const locationSummaries = result.locationSummaries as Array<{
    locationArea: string;
    methods: string[];
    levelRanges: string[];
  }>;

  assert.equal(result.ok, true);
  assert.equal(result.game, "emerald");
  assert.match(String(result.summary), /Ralts.*emerald/i);
  assert.ok(entries.length > 0);
  assert.ok(entries.every((entry) => entry.species === "Ralts"));
  assert.ok(entries.every((entry) => entry.locationArea.includes("route-102")));
  assert.ok(entries.every((entry) => entry.method === "walk"));
  assert.ok(entries.some((entry) => entry.minLevel <= entry.maxLevel));
  assert.ok(locationSummaries.length > 0);
  assert.ok(locationSummaries.some((entry) => entry.locationArea.includes("route-102")));
  assert.ok(locationSummaries.some((entry) => entry.methods.includes("walk")));
});

test("Italian game names in the user query override the loaded save context for guidance", () => {
  const result = executeChatTool(
    "search_game_guidance",
    {
      query: "dove trovo Wailmer in Smeraldo?",
      canonicalQuery: "Wailmer encounter location Pokemon Emerald",
      game: "Pokemon Crystal",
      limit: 2,
    },
    crystalContext
  );

  assert.equal(result.ok, true);
  assert.equal(result.gameProfile, "emerald");
  assert.equal(result.requestedGame, "emerald");
});

test("state tools fail explicitly without a loaded game", () => {
  const result = executeChatTool("get_inventory_overview", {});

  assert.equal(result.ok, false);
  assert.equal(result.error, "This tool requires a loaded save or live game state.");
});

test("game guidance search stays scoped to the loaded game and includes sources", async () => {
  const provider = new OllamaProvider();
  const result = await provider.executeTool(
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

test("general guidance works without a save using a clean canonical walkthrough query", () => {
  const result = executeChatTool("search_game_guidance", {
    query: "How do I clear Mirage Tower in Pokemon Emerald?",
    canonicalQuery: "Mirage Tower Pokemon Emerald walkthrough",
    keywords: ["Mirage Tower"],
    game: "Pokemon Emerald",
  });
  const matches = result.matches as Array<{
    event: string;
    knowledgeProfile: string;
    actionHint?: string;
    steps?: string[];
    sourceRefs?: string[];
    audited: boolean;
  }>;

  assert.equal(result.ok, true);
  assert.equal(result.canonicalQuery, "Mirage Tower Pokemon Emerald walkthrough");
  assert.ok(
    matches.some(
      (match) =>
        match.event === "GUIDE_MIRAGE_TOWER" &&
        match.knowledgeProfile === "emerald-en" &&
        match.audited
    )
  );
  const guide = matches.find((match) => match.event === "GUIDE_MIRAGE_TOWER");
  assert.match(guide?.actionHint ?? "", /Mach Bike/);
  assert.ok(guide?.steps?.some((step) => /Rock Smash/.test(step)));
  assert.ok(
    matches.some(
      (match) =>
        match.event.includes("WALKTHROUGH_PART_8_Mirage Tower") &&
        match.sourceRefs?.some((url: string) =>
          url.includes("Pok%C3%A9mon_Emerald/Part_8#Mirage_Tower")
        )
    )
  );
  const sources = result.sources as Array<{
    displayName?: string;
    siteName?: string;
    icon?: string;
    url?: string;
  }>;
  assert.ok(
    sources.some(
      (source) =>
        source.siteName === "Bulbapedia" &&
        source.icon === "B" &&
        source.displayName?.includes("Pokémon Emerald Part 8 - Mirage Tower")
    )
  );
  assert.ok(
    sources.some(
      (source) =>
        source.siteName === "PRET" &&
        source.icon === "GH" &&
        source.displayName?.includes("pokeemerald")
    )
  );
});

test("general guidance can be explicitly scoped without a loaded save", () => {
  const result = executeChatTool("search_game_guidance", {
    query: "Mirage Tower",
    game: "Pokemon Emerald",
  });

  assert.equal(result.ok, true);
  assert.equal(result.gameProfile, "emerald");
  assert.deepEqual(result.matchedProfiles, ["emerald-en"]);
});

test("walkthrough guidance returns the correct Emerald fossil revivals", () => {
  const result = executeChatTool("search_game_guidance", {
    query: "What do I get from the Root Fossil and Claw Fossil in Pokemon Emerald?",
    canonicalQuery: "Pokemon Emerald Root Fossil Claw Fossil revival",
    keywords: ["Root Fossil", "Claw Fossil"],
    game: "Pokemon Emerald",
    limit: 8,
  });
  const matches = result.matches as Array<{
    event: string;
    description?: string;
    steps?: string[];
  }>;
  const combinedText = matches
    .flatMap((match) => [match.description, ...(match.steps ?? [])])
    .filter(Boolean)
    .join(" ");

  assert.match(combinedText, /Root Fossil (?:is revived into|becomes).*Lileep/i);
  assert.match(combinedText, /Claw Fossil (?:is revived into|turns into).*Anorith/i);
  assert.ok(
    matches.some((match) => match.event.includes("Relic Recovery"))
  );
  assert.doesNotMatch(combinedText, /Omanyte|Tyrunt/);
});

test("walkthrough guidance for Emerald Rayquaza prioritizes Sky Pillar instead of unrelated guides", () => {
  const result = executeChatTool("search_game_guidance", {
    query: "How do I find Rayquaza in Pokemon Emerald?",
    canonicalQuery: "Rayquaza Pokemon Emerald",
    game: "Pokemon Emerald",
    limit: 5,
  });
  const matches = result.matches as Array<{
    event: string;
    description?: string;
    location?: string;
  }>;
  const combinedText = matches
    .flatMap((match) => [match.event, match.location, match.description])
    .filter(Boolean)
    .join(" ");

  assert.equal(result.ok, true);
  assert.doesNotMatch(matches[0]?.event ?? "", /MIRAGE_TOWER/);
  assert.match(combinedText, /Rayquaza/i);
  assert.match(combinedText, /Sky Pillar/i);
});

test("walkthrough guidance uses a provided guide embedding vector in hybrid ranking", () => {
  const { model, vector } = readGuideEmbeddingVector(
    (record) =>
      record.games?.includes("Pokemon Gold and Silver") === true &&
      record.parentSection === "Elite Four" &&
      record.section === "Battle 1"
  );
  const result = executeChatTool("search_game_guidance", {
    query: "components della lega e i loro Pokemon",
    game: "Pokemon Gold",
    limit: 5,
    _queryEmbedding: vector,
    _embeddingModelName: model,
  });
  const matches = result.matches as Array<{
    event: string;
    retrieval?: { embeddingScore?: number; embeddingModel?: string };
  }>;

  assert.equal(result.ok, true);
  assert.equal(result.retrievalMode, "hybrid-lexical-vector");
  assert.equal(result.embeddingModel, model);
  assert.match(matches[0]?.event ?? "", /Battle 1/);
  assert.equal(matches[0]?.retrieval?.embeddingModel, model);
  assert.ok((matches[0]?.retrieval?.embeddingScore ?? 0) > 0.99);
});

test("successful guidance is synthesized in an isolated completion with the resolved game", async () => {
  const originalFetch = globalThis.fetch;
  const chatBodies: Array<Record<string, unknown>> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/tags")) {
      return Response.json({ models: [{ name: "guide-test" }] });
    }

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    chatBodies.push(body);
    if (chatBodies.length === 1) {
      return Response.json({
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              function: {
                name: "search_game_guidance",
                arguments: {
                  query: "How do I clear Mirage Tower in Pokemon Emerald?",
                  canonicalQuery: "Mirage Tower walkthrough",
                  game: "Pokemon Emerald",
                },
              },
            },
          ],
        },
      });
    }

    return Response.json({
      message: {
        role: "assistant",
        content: "Use the Mach Bike and Rock Smash.",
      },
    });
  };

  try {
    const provider = new OllamaProvider();
    await provider.initialize({
      endpoint: "http://127.0.0.1:11434",
      modelName: "guide-test",
      thinking: false,
    });

    const reply = await provider.sendMessage(
      "How do I clear Mirage Tower in Pokemon Emerald?",
      []
    );

    assert.equal(reply, "Use the Mach Bike and Rock Smash.");
    assert.ok(
      provider
        .getLastSources()
        .some((source) => source.url?.includes("Pok%C3%A9mon_Emerald/Part_8"))
    );
    assert.equal(chatBodies.length, 2);
    assert.ok(chatBodies[1].tools);
    const toolLoopMessages = chatBodies[1].messages as Array<{
      role: string;
      content: string;
    }>;
    assert.match(JSON.stringify(toolLoopMessages), /search_game_guidance/);
    assert.match(JSON.stringify(toolLoopMessages), /Pokemon Emerald/);
    assert.match(JSON.stringify(toolLoopMessages), /Mirage Tower/);
    assert.match(JSON.stringify(toolLoopMessages), /sourceRefs/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("guidance tool result returns one final chunk when streaming is requested", async () => {
  const originalFetch = globalThis.fetch;
  const chatBodies: Array<Record<string, unknown>> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/tags")) {
      return Response.json({ models: [{ name: "guide-stream-test" }] });
    }

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    chatBodies.push(body);
    if (chatBodies.length === 1) {
      return Response.json({
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              function: {
                name: "search_game_guidance",
                arguments: {
                  query: "Mirage Tower",
                  canonicalQuery: "Mirage Tower",
                  game: "Pokemon Emerald",
                },
              },
            },
          ],
        },
      });
    }

    return Response.json({
      message: {
        role: "assistant",
        content: "Usa la Mach Bike.",
      },
    });
  };

  try {
    const provider = new OllamaProvider();
    await provider.initialize({
      endpoint: "http://127.0.0.1:11434",
      modelName: "guide-stream-test",
      thinking: false,
    });

    const chunks: string[] = [];
    const reply = await provider.sendMessage(
      "Mirage Tower",
      [],
      undefined,
      undefined,
      (chunk) => chunks.push(chunk)
    );

    assert.equal(reply, "Usa la Mach Bike.");
    assert.deepEqual(chunks, ["Usa la Mach Bike."]);
    assert.equal(chatBodies[1].stream, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("empty tool-calling final response falls back instead of returning thinking only", async () => {
  const originalFetch = globalThis.fetch;
  const chatBodies: Array<Record<string, unknown>> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/tags")) {
      return Response.json({ models: [{ name: "empty-tool-final-test" }] });
    }

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    chatBodies.push(body);
    if (chatBodies.length === 1) {
      return Response.json({
        message: {
          role: "assistant",
          thinking: "I should answer, but produced no final text.",
          content: "",
        },
      });
    }

    return Response.json({
      message: {
        role: "assistant",
        content: "Use the local guide source or ask a narrower game question.",
      },
    });
  };

  try {
    const provider = new OllamaProvider();
    await provider.initialize({
      endpoint: "http://127.0.0.1:11434",
      modelName: "empty-tool-final-test",
      thinking: true,
    });

    const reply = await provider.sendMessage("How do I continue in Pokemon Emerald?", []);

    assert.match(reply, /local guide source|narrower game/i);
    assert.equal(chatBodies.length, 2);
    assert.ok(chatBodies[0].tools);
    assert.equal(chatBodies[1].tools, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("different follow-up tool calls remain available after a useful tool result", async () => {
  const originalFetch = globalThis.fetch;
  const chatBodies: Array<Record<string, unknown>> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/tags")) {
      return Response.json({ models: [{ name: "follow-up-tool-test" }] });
    }

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    chatBodies.push(body);
    if (chatBodies.length === 1) {
      return Response.json({
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              function: {
                name: "get_encounters",
                arguments: {
                  game: "Emerald",
                  species: "Wailmer",
                },
              },
            },
          ],
        },
      });
    }

    if (chatBodies.length === 2) {
      return Response.json({
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              function: {
                name: "search_game_guidance",
                arguments: {
                  query: "how do i use fishing rods in Pokemon Emerald?",
                  canonicalQuery: "Pokemon Emerald fishing rods",
                  game: "Pokemon Emerald",
                },
              },
            },
          ],
        },
      });
    }

    return Response.json({
      message: {
        role: "assistant",
        content: "Wailmer is available by fishing with the Good Rod or Super Rod.",
      },
    });
  };

  try {
    const provider = new OllamaProvider();
    await provider.initialize({
      endpoint: "http://127.0.0.1:11434",
      modelName: "follow-up-tool-test",
      thinking: false,
    });

    const reply = await provider.sendMessage("Where can I find Wailmer in Emerald?", []);

    assert.match(reply, /Wailmer/);
    assert.equal(chatBodies.length, 3);
    assert.ok(chatBodies[1].tools);
    assert.ok(chatBodies[2].tools);
    assert.match(JSON.stringify(chatBodies[1].messages), /Latest tool result/);
    assert.match(JSON.stringify(chatBodies[1].messages), /Wailmer is available in emerald/);
    assert.match(JSON.stringify(chatBodies[2].messages), /Pokemon Emerald fishing rods/);
    assert.ok(
      provider
        .getLastSources()
        .some((source) => source.url === "https://pokeapi.co/api/v2/pokemon/320")
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("max tool rounds synthesize from collected tool results instead of dropping context", async () => {
  const originalFetch = globalThis.fetch;
  const chatBodies: Array<Record<string, unknown>> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/tags")) {
      return Response.json({ models: [{ name: "tool-loop-test" }] });
    }

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    chatBodies.push(body);
    if (chatBodies.length <= 6) {
      return Response.json({
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              function: {
                name: "get_encounters",
                arguments: {
                  game: "Emerald",
                  species: "Wailmer",
                },
              },
            },
          ],
        },
      });
    }

    return Response.json({
      message: {
        role: "assistant",
        content: "Wailmer is available by fishing in Hoenn.",
      },
    });
  };

  try {
    const provider = new OllamaProvider();
    await provider.initialize({
      endpoint: "http://127.0.0.1:11434",
      modelName: "tool-loop-test",
      thinking: false,
    });

    const reply = await provider.sendMessage("Where can I find Wailmer in Emerald?", []);

    assert.match(reply, /Wailmer/);
    assert.equal(chatBodies.length, 7);
    assert.equal(chatBodies[6].tools, undefined);
    assert.match(JSON.stringify(chatBodies[6].messages), /Tool calling is disabled/);
    assert.doesNotMatch(JSON.stringify(chatBodies[6].messages), /DUPLICATE_TOOL_CALL/);
    assert.match(JSON.stringify(chatBodies[6].messages), /Wailmer is available in emerald/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a guide follow-up uses retained knowledge without another tool call", async () => {
  const originalFetch = globalThis.fetch;
  let chatBody: Record<string, unknown> | undefined;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/tags")) {
      return Response.json({ models: [{ name: "follow-up-test" }] });
    }
    chatBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      message: {
        role: "assistant",
        content:
          "The Root Fossil becomes Lileep; the Claw Fossil becomes Anorith.",
      },
    });
  };

  try {
    const provider = new OllamaProvider();
    await provider.initialize({
      endpoint: "http://127.0.0.1:11434",
      modelName: "follow-up-test",
      thinking: false,
    });
    const reply = await provider.sendMessage(
      "Which Pokemon do I get from the two fossils?",
      [
        {
          role: "assistant",
          content: "Use the Mach Bike to clear Mirage Tower.",
          timestamp: 1,
          knowledgeContext: JSON.stringify({
            game: "Pokemon Emerald",
            matches: [
              {
                steps: [
                  "The Root Fossil is revived into Lileep; the Claw Fossil is revived into Anorith.",
                ],
              },
            ],
          }),
        },
      ]
    );

    assert.match(reply, /Lileep/);
    assert.match(reply, /Anorith/);
    assert.equal(chatBody?.tools, undefined);
    assert.match(JSON.stringify(chatBody?.messages), /retainedKnowledge/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Ollama validation accepts implicit latest model tags", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/api/tags")) {
      return Response.json({
        models: [{ name: "gemma4:latest" }, { name: "embeddinggemma:latest" }],
      });
    }
    return Response.json({ message: { role: "assistant", content: "" } });
  };

  try {
    const provider = new OllamaProvider();
    await provider.initialize({
      endpoint: "http://127.0.0.1:11434",
      modelName: "gemma4",
      embeddingModelName: "embeddinggemma:latest",
      thinking: false,
    });

    assert.equal(provider.isReady(), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
    const toolNames = (
      chatBody?.tools as Array<{ function: { name: string } }>
    ).map((tool) => tool.function.name);
    assert.ok(toolNames.includes("search_game_guidance"));
    assert.ok(toolNames.includes("get_evolution"));
    assert.ok(!toolNames.includes("get_story_context"));
    assert.ok(!toolNames.includes("get_trainer_status"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
