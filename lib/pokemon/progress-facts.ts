import type {
  GameEventProgress,
  GameProgressFact,
  GameProgressFacts,
  GameVersion,
} from "./types";

export interface ProgressFactRawValues {
  playerStarter?: number;
  oaksLabScript?: number;
  hallOfFameCount?: number;
  elmsLabScene?: number;
  radioTower5FScene?: number;
  teamRocketBaseB2FScene?: number;
  teamRocketBaseB3FScene?: number;
  starterMon?: number;
  birchLabState?: number;
  littlerootIntroState?: number;
  petalburgGymState?: number;
  eliteFourState?: number;
  sootopolisState?: number;
}

interface BuildProgressFactsInput {
  generation: number;
  game: GameVersion;
  source: "save" | "live";
  events?: GameEventProgress;
  raw?: ProgressFactRawValues;
}

const SOURCES = {
  gen1Starter: [
    "https://github.com/pret/pokered/blob/3c814341c81307b3193a9ea890ff3a197b09b4e3/ram/wram.asm",
    "https://github.com/pret/pokered/blob/3c814341c81307b3193a9ea890ff3a197b09b4e3/scripts/OaksLab.asm",
  ],
  yellowStarter: [
    "https://github.com/pret/pokeyellow/blob/bfa7170107eea23b89febb60bfb2ce39173bf2e1/ram/wram.asm",
    "https://github.com/pret/pokeyellow/blob/bfa7170107eea23b89febb60bfb2ce39173bf2e1/scripts/OaksLab.asm",
  ],
  gen1OakLab: [
    "https://github.com/pret/pokered/blob/3c814341c81307b3193a9ea890ff3a197b09b4e3/scripts/OaksLab.asm",
    "https://github.com/pret/pokeyellow/blob/bfa7170107eea23b89febb60bfb2ce39173bf2e1/scripts/OaksLab.asm",
  ],
  gen2Elm: [
    "https://github.com/pret/pokecrystal/blob/8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217/ram/wram.asm",
    "https://github.com/pret/pokecrystal/blob/8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217/maps/ElmsLab.asm",
  ],
  gen2Radio: [
    "https://github.com/pret/pokecrystal/blob/8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217/maps/RadioTower5F.asm",
  ],
  gen2RocketBase: [
    "https://github.com/pret/pokecrystal/blob/8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217/maps/TeamRocketBaseB3F.asm",
    "https://github.com/pret/pokecrystal/blob/8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217/maps/TeamRocketBaseB2F.asm",
  ],
  hoenn: [
    "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/include/constants/vars.h",
    "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/LittlerootTown/scripts.inc",
    "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/LittlerootTown_ProfessorBirchsLab/scripts.inc",
  ],
  petalburg: [
    "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/include/constants/vars.h",
    "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/PetalburgCity_Gym/scripts.inc",
  ],
  frlgStarter: [
    "https://github.com/pret/pokefirered/blob/e060ab955b5dc9ac1c4904c2cd141683615cf477/include/constants/vars.h",
    "https://github.com/pret/pokefirered/blob/e060ab955b5dc9ac1c4904c2cd141683615cf477/data/maps/PalletTown_ProfessorOaksLab/scripts.inc",
  ],
  gen1Story: [
    "https://github.com/pret/pokered/blob/3c814341c81307b3193a9ea890ff3a197b09b4e3/constants/event_constants.asm",
    "https://github.com/pret/pokered/blob/3c814341c81307b3193a9ea890ff3a197b09b4e3/scripts/IndigoPlateauLobby.asm",
  ],
  gen2Story: [
    "https://github.com/pret/pokecrystal/blob/8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217/constants/event_flags.asm",
    "https://github.com/pret/pokecrystal/blob/8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217/maps/HallOfFame.asm",
  ],
  hoennStory: [
    "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/include/constants/flags.h",
    "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/src/post_battle_event_funcs.c",
  ],
  frlgStory: [
    "https://github.com/pret/pokefirered/blob/e060ab955b5dc9ac1c4904c2cd141683615cf477/include/constants/flags.h",
    "https://github.com/pret/pokefirered/blob/e060ab955b5dc9ac1c4904c2cd141683615cf477/src/post_battle_event_funcs.c",
  ],
  hoennEliteFour: [
    "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/include/constants/vars.h",
    "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/EverGrandeCity_SidneysRoom/scripts.inc",
    "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/EverGrandeCity_DrakesRoom/scripts.inc",
  ],
  sootopolis: [
    "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/include/constants/vars.h",
    "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/SootopolisCity/scripts.inc",
    "https://github.com/pret/pokeruby/blob/63a8cbf0016b351a4e68f7036fa0b77e23d2f2c1/data/maps/SootopolisCity/scripts.inc",
  ],
} as const;

function flag(events: GameEventProgress | undefined, key: string) {
  return events?.flags.find((entry) => entry.key === key);
}

function isSet(events: GameEventProgress | undefined, key: string): boolean {
  const entry = flag(events, key);
  return entry?.rawSet ?? entry?.completed ?? false;
}

function choiceFact(
  key: string,
  value: string,
  description: string,
  sourceRefs: readonly string[]
): GameProgressFact {
  return {
    key,
    label: "Starter chosen",
    category: "Permanent choice",
    value,
    description,
    sourceRefs: [...sourceRefs],
  };
}

interface StoryMilestone {
  key: string;
  label: string;
}

function storyRouteFact(
  events: GameEventProgress | undefined,
  milestones: StoryMilestone[],
  completeKey: string,
  region: string,
  sourceRefs: readonly string[],
  flexibleFrom?: number,
  completedOverride = false
): GameProgressFact | undefined {
  if (!events) return undefined;

  const completed = milestones.filter((milestone) => isSet(events, milestone.key));
  const missing = milestones.filter((milestone) => !isSet(events, milestone.key));
  const gameClear = completedOverride || isSet(events, completeKey);
  const badgeMilestones = milestones.filter((milestone) => /BEAT_|DEFEATED_/.test(milestone.key));
  const completedBadges = badgeMilestones.filter((milestone) => isSet(events, milestone.key)).length;

  if (gameClear) {
    return {
      key: "main-story-progress",
      label: "Main story",
      category: "Main story progress",
      value: "Main story completed",
      description: `The ${region} Pokémon League completion flag is recorded. Remaining unchecked events belong to optional content, postgame, repeatable encounters, or technical save state.`,
      sourceRefs: [...sourceRefs],
    };
  }

  const next = missing[0];
  const inFlexibleSection = flexibleFrom !== undefined && completed.length >= flexibleFrom;
  const remainingLabels = missing.slice(0, 3).map((milestone) => milestone.label);
  const remainingText = remainingLabels.length > 0 ? remainingLabels.join(", ") : "Pokémon League";

  return {
    key: "main-story-progress",
    label: "Main story",
    category: "Main story progress",
    value: `${completedBadges}/${badgeMilestones.length} major battles recorded`,
    description: inFlexibleSection
      ? `This part of the route allows some objectives to be completed in different orders. Major milestones still not recorded include: ${remainingText}.`
      : next
        ? `The next major milestone not recorded in the normal story route is ${next.label}.`
        : `All listed major battles are recorded; the ${region} Pokémon League completion flag is still missing.`,
    nextStep: next
      ? inFlexibleSection
        ? `Continue with any currently reachable required objective, including ${remainingText}.`
        : `Continue the main route toward this milestone: ${next.label}.`
      : `Enter and complete the ${region} Pokémon League.`,
    sourceRefs: [...sourceRefs],
  };
}

function buildGen1StoryFact(
  events: GameEventProgress | undefined,
  hallOfFameCount?: number
): GameProgressFact | undefined {
  return storyRouteFact(
    events,
    [
      { key: "EVENT_GOT_POKEDEX", label: "receive the Pokédex from Professor Oak" },
      { key: "EVENT_BEAT_BROCK", label: "defeat Brock in Pewter City" },
      { key: "EVENT_BEAT_MISTY", label: "defeat Misty in Cerulean City" },
      { key: "EVENT_BEAT_LT_SURGE", label: "defeat Lt. Surge in Vermilion City" },
      { key: "EVENT_BEAT_ERIKA", label: "defeat Erika in Celadon City" },
      { key: "EVENT_BEAT_KOGA", label: "defeat Koga in Fuchsia City" },
      { key: "EVENT_BEAT_SABRINA", label: "defeat Sabrina in Saffron City" },
      { key: "EVENT_BEAT_BLAINE", label: "defeat Blaine on Cinnabar Island" },
      { key: "EVENT_BEAT_VIRIDIAN_GYM_GIOVANNI", label: "defeat Giovanni in Viridian Gym" },
    ],
    "EVENT_BEAT_CHAMPION_RIVAL",
    "Kanto",
    SOURCES.gen1Story,
    4,
    (hallOfFameCount ?? 0) > 0
  );
}

function buildOakLabFact(
  game: GameVersion,
  events: GameEventProgress | undefined,
  script?: number
): GameProgressFact | undefined {
  if (isSet(events, "EVENT_GOT_POKEDEX") || script === undefined || script === 0) return undefined;

  const yellow = game === "yellow";
  if (script < 1 || script > (yellow ? 22 : 18)) return undefined;

  let value: string;
  let description: string;
  let nextStep: string;

  if (script <= 7) {
    value = yellow ? "Oak's Pikachu encounter" : "Choose your first Pokémon";
    description = yellow
      ? "Professor Oak's opening encounter and return to the laboratory are still in progress."
      : "Professor Oak has brought you to the laboratory for the starter selection.";
    nextStep = yellow
      ? "Follow Oak back to the laboratory and continue the opening scene."
      : "Choose Bulbasaur, Charmander, or Squirtle from the laboratory table.";
  } else if (script <= (yellow ? 11 : 9)) {
    value = "Starter handover";
    description = yellow
      ? "Oak is completing the Pikachu and Eevee handover."
      : "You selected a starter and the rival is completing their choice.";
    nextStep = "Continue the laboratory dialogue.";
  } else if (script <= (yellow ? 16 : 14)) {
    value = "First rival battle";
    description = "The opening battle with the rival is active or its exit scene is still being completed.";
    nextStep = "Finish the rival battle and leave Oak's Lab.";
  } else if (yellow && script <= 18) {
    value = "Pikachu leaves its Poké Ball";
    description = "The special Pikachu follower scene is still in progress.";
    nextStep = "Finish the scene and continue toward Viridian City.";
  } else if (script === (yellow ? 19 : 15)) {
    value = "Deliver Oak's Parcel";
    description = "Oak's Parcel has brought the opening errand back to the laboratory.";
    nextStep = "Talk to Professor Oak and deliver the Parcel.";
  } else if (script === (yellow ? 20 : 16)) {
    value = "Receive the Pokédex";
    description = "Professor Oak's Pokédex presentation is the current laboratory scene.";
    nextStep = "Finish talking to Oak to receive the Pokédex and Poké Balls.";
  } else {
    value = "Finish the Oak Lab opening";
    description = "The final rival exit or laboratory cleanup scene is still recorded.";
    nextStep = "Finish the remaining dialogue and leave the laboratory.";
  }

  return {
    key: "oaks-lab-phase",
    label: "Oak's Lab phase",
    category: "Current story phase",
    value,
    description,
    nextStep,
    sourceRefs: [...SOURCES.gen1OakLab],
  };
}

function buildGen1Facts(input: BuildProgressFactsInput): GameProgressFact[] {
  const starter = input.raw?.playerStarter;
  const names: Record<number, string> = input.game === "yellow"
    ? { 0x54: "Pikachu" }
    : { 0x99: "Bulbasaur", 0xb0: "Charmander", 0xb1: "Squirtle" };
  const value = starter === undefined ? undefined : names[starter];
  const starterFact = isSet(input.events, "EVENT_GOT_STARTER") && value
    ? choiceFact(
      "starter-choice",
      value,
      `Your permanent Kanto starter choice is ${value}.`,
      input.game === "yellow" ? SOURCES.yellowStarter : SOURCES.gen1Starter
    )
    : undefined;
  return [
    buildGen1StoryFact(input.events, input.raw?.hallOfFameCount),
    starterFact,
    buildOakLabFact(input.game, input.events, input.raw?.oaksLabScript),
  ]
    .filter((fact): fact is GameProgressFact => Boolean(fact));
}

function buildGen2Starter(events?: GameEventProgress): GameProgressFact | undefined {
  const choices = [
    ["EVENT_GOT_CYNDAQUIL_FROM_ELM", "Cyndaquil"],
    ["EVENT_GOT_TOTODILE_FROM_ELM", "Totodile"],
    ["EVENT_GOT_CHIKORITA_FROM_ELM", "Chikorita"],
  ] as const;
  const selected = choices.find(([key]) => isSet(events, key));
  if (!selected) return undefined;
  return choiceFact(
    "starter-choice",
    selected[1],
    `Your permanent Johto starter choice is ${selected[1]}. The other two starter flags are alternatives, not missing tasks.`,
    SOURCES.gen2Elm
  );
}

function buildElmFact(events: GameEventProgress | undefined, scene?: number): GameProgressFact | undefined {
  if (scene === undefined || scene < 0 || scene > 6) return undefined;
  const gaveEgg = isSet(events, "EVENT_GAVE_MYSTERY_EGG_TO_ELM");
  const states: Record<number, Pick<GameProgressFact, "value" | "description" | "nextStep">> = {
    0: {
      value: "Meet Professor Elm",
      description: "Elm has not yet assigned the opening errand.",
      nextStep: "Talk to Professor Elm in his lab.",
    },
    1: {
      value: "Choose a starter",
      description: "Elm has offered the three starter Pokémon, but the lab exit remains blocked.",
      nextStep: "Choose Cyndaquil, Totodile, or Chikorita from the lab table.",
    },
    3: {
      value: "Report the theft",
      description: "The police officer scene is waiting after the rival stole a Pokémon.",
      nextStep: "Enter Elm's Lab and speak with the officer.",
    },
    4: {
      value: "Unused source state",
      description: "The game defines this scene value but does not use it in the normal story route.",
    },
    5: {
      value: "Receive the Potion",
      description: "Elm's aide is waiting at the lab exit with a Potion.",
      nextStep: "Walk toward the exit and accept the Potion.",
    },
    6: {
      value: "Receive Poké Balls",
      description: "After returning the Mystery Egg to Elm, the aide is waiting with five Poké Balls.",
      nextStep: "Walk toward the lab exit and accept the Poké Balls.",
    },
  };
  if (scene === 2) {
    if (gaveEgg) return undefined;
    return {
      key: "elms-lab-phase",
      label: "Elm's Lab phase",
      category: "Current story phase",
      value: "Complete the Mystery Egg errand",
      description: "You may leave the lab and continue the opening trip to Mr. Pokémon.",
      nextStep: "Visit Mr. Pokémon, then return to Elm when the story calls you back.",
      sourceRefs: [...SOURCES.gen2Elm],
    };
  }
  const state = states[scene];
  if (!state) return undefined;
  return {
    key: "elms-lab-phase",
    label: "Elm's Lab phase",
    category: "Current story phase",
    ...state,
    sourceRefs: [...SOURCES.gen2Elm],
  };
}

function buildRadioTowerFact(
  events: GameEventProgress | undefined,
  scene?: number
): GameProgressFact | undefined {
  const cleared = isSet(events, "EVENT_CLEARED_RADIO_TOWER");
  const takeoverFlag = flag(events, "EVENT_RADIO_TOWER_ROCKET_TAKEOVER");
  const takeoverActive = takeoverFlag ? !(takeoverFlag.rawSet ?? takeoverFlag.completed) : false;
  if (!cleared && !takeoverActive && scene !== 1) return undefined;

  const states: Record<number, Pick<GameProgressFact, "value" | "description" | "nextStep">> = {
    0: {
      value: "Expose the fake Director",
      description: "Team Rocket controls the tower and the fake Director is waiting on 5F.",
      nextStep: "Reach Radio Tower 5F, defeat the fake Director, and take the Basement Key.",
    },
    1: {
      value: "Rescue the real Director",
      description: "The fake Director has been defeated; the takeover continues through the Underground Warehouse.",
      nextStep: "Use the Basement Key, rescue the real Director, then return to Radio Tower 5F.",
    },
    2: {
      value: "Radio Tower cleared",
      description: "The takeover sequence is complete and Team Rocket has disbanded.",
    },
  };
  const state = states[cleared ? 2 : (scene ?? 0)];
  if (!state) return undefined;
  return {
    key: "radio-tower-phase",
    label: "Radio Tower phase",
    category: "Current story phase",
    ...state,
    sourceRefs: [...SOURCES.gen2Radio],
  };
}

function buildRocketBaseFact(
  events: GameEventProgress | undefined,
  b2fScene?: number,
  b3fScene?: number
): GameProgressFact | undefined {
  if (
    !isSet(events, "EVENT_DECIDED_TO_HELP_LANCE")
    || isSet(events, "EVENT_CLEARED_ROCKET_HIDEOUT")
    || b2fScene === undefined
    || b3fScene === undefined
  ) {
    return undefined;
  }

  let value: string;
  let description: string;
  let nextStep: string;

  if (b3fScene === 0) {
    value = "Find the two passwords";
    description = "Lance has entered the Mahogany Team Rocket base and the locked office still requires two passwords.";
    nextStep = "Defeat and question the Rocket members on B3F who know the passwords.";
  } else if (b3fScene === 1) {
    value = "Continue through B3F";
    description = "The password search has advanced and the rival encounter is the next recorded scene in the base.";
    nextStep = "Continue through B3F toward the rival and the Executive's office.";
  } else if (b3fScene === 2) {
    value = "Defeat the Executive";
    description = "The Executive guarding the office on B3F is the current story battle.";
    nextStep = "Defeat the Executive and use the Murkrow password to open the generator area.";
  } else if (b2fScene === 0) {
    value = "Meet Lance on B2F";
    description = "The B3F office sequence is complete and the operation continues near the generator room.";
    nextStep = "Reach Lance on B2F.";
  } else if (b2fScene === 1) {
    value = "Defeat the final Executives";
    description = "The confrontation outside the generator room is active.";
    nextStep = "Fight the Rocket Executives with Lance.";
  } else if (b2fScene === 2) {
    value = "Stop the Electrode";
    description = "The generator must be disabled to finish the Mahogany base operation.";
    nextStep = "Defeat or catch the three Electrode on your side of the generator.";
  } else {
    value = "Finish the Mahogany operation";
    description = "The base scenes have advanced, but the persistent cleared flag has not yet been recorded.";
    nextStep = "Complete the remaining dialogue with Lance before leaving the base.";
  }

  return {
    key: "rocket-base-phase",
    label: "Team Rocket HQ phase",
    category: "Current story phase",
    value,
    description,
    nextStep,
    sourceRefs: [...SOURCES.gen2RocketBase],
  };
}

function buildGen2Facts(input: BuildProgressFactsInput): GameProgressFact[] {
  return [
    storyRouteFact(
      input.events,
      [
        { key: "EVENT_BEAT_FALKNER", label: "defeat Falkner in Violet City" },
        { key: "EVENT_BEAT_BUGSY", label: "defeat Bugsy in Azalea Town" },
        { key: "EVENT_BEAT_WHITNEY", label: "defeat Whitney in Goldenrod City" },
        { key: "EVENT_BEAT_MORTY", label: "defeat Morty in Ecruteak City" },
        { key: "EVENT_BEAT_CHUCK", label: "defeat Chuck in Cianwood City" },
        { key: "EVENT_BEAT_JASMINE", label: "defeat Jasmine in Olivine City" },
        { key: "EVENT_BEAT_PRYCE", label: "defeat Pryce in Mahogany Town" },
        { key: "EVENT_CLEARED_RADIO_TOWER", label: "clear the Team Rocket takeover of Radio Tower" },
        { key: "EVENT_BEAT_CLAIR", label: "defeat Clair in Blackthorn City" },
      ],
      "EVENT_BEAT_ELITE_FOUR",
      "Johto",
      SOURCES.gen2Story,
      4
    ),
    buildGen2Starter(input.events),
    buildElmFact(input.events, input.raw?.elmsLabScene),
    buildRocketBaseFact(
      input.events,
      input.raw?.teamRocketBaseB2FScene,
      input.raw?.teamRocketBaseB3FScene
    ),
    buildRadioTowerFact(input.events, input.raw?.radioTower5FScene),
  ].filter((fact): fact is GameProgressFact => Boolean(fact));
}

function buildHoennStarter(raw?: ProgressFactRawValues): GameProgressFact | undefined {
  if ((raw?.birchLabState ?? 0) < 2) return undefined;
  const value = ["Treecko", "Torchic", "Mudkip"][raw?.starterMon ?? -1];
  if (!value) return undefined;
  return choiceFact(
    "starter-choice",
    value,
    `Your permanent Hoenn starter choice is ${value}.`,
    SOURCES.hoenn
  );
}

function buildLittlerootFact(raw?: ProgressFactRawValues): GameProgressFact | undefined {
  const state = raw?.littlerootIntroState;
  if (state === undefined || state < 1 || state > 7 || (raw?.birchLabState ?? 0) >= 2) return undefined;
  const states: Record<number, Pick<GameProgressFact, "value" | "description" | "nextStep">> = {
    1: {
      value: "Leave the moving truck",
      description: "The male-player opening scene is waiting inside the moving truck.",
      nextStep: "Walk out of the truck.",
    },
    2: {
      value: "Leave the moving truck",
      description: "The female-player opening scene is waiting inside the moving truck.",
      nextStep: "Walk out of the truck.",
    },
    3: {
      value: "Enter your new home",
      description: "You have arrived in Littleroot and Mom is leading you inside.",
      nextStep: "Enter your house with Mom.",
    },
    4: {
      value: "Set the bedroom clock",
      description: "Mom has told you to set the clock upstairs.",
      nextStep: "Go upstairs and interact with the wall clock.",
    },
    5: {
      value: "Set the bedroom clock",
      description: "You are upstairs and the clock still needs to be set.",
      nextStep: "Interact with the wall clock.",
    },
    6: {
      value: "Watch the TV report",
      description: "The clock is set and Mom is waiting by the television.",
      nextStep: "Go downstairs and watch the TV report with Mom.",
    },
    7: {
      value: "Meet your rival",
      description: "Mom has told you to introduce yourself to the neighbor.",
      nextStep: "Visit the rival's house next door, then go north toward Route 101.",
    },
  };
  const mapped = states[state];
  return {
    key: "littleroot-intro-phase",
    label: "Littleroot opening",
    category: "Current story phase",
    ...mapped,
    sourceRefs: [...SOURCES.hoenn],
  };
}

function buildPetalburgFact(raw?: ProgressFactRawValues): GameProgressFact | undefined {
  const state = raw?.petalburgGymState;
  if (state === undefined || state < 1 || state > 8) return undefined;
  let value: string;
  let description: string;
  let nextStep: string | undefined;
  if (state === 1) {
    value = "Wally catching tutorial";
    description = "The first Petalburg Gym visit is in progress with Wally.";
    nextStep = "Finish Wally's catching tutorial and return to Norman.";
  } else if (state >= 2 && state <= 5) {
    const badges = state - 2;
    value = `Norman locked (${badges}/4 required badges)`;
    description = "Norman will not accept the Gym challenge until four Hoenn badges are earned.";
    nextStep = `Earn ${4 - badges} more badge${4 - badges === 1 ? "" : "s"}, then return to Petalburg Gym.`;
  } else if (state === 6) {
    value = "Norman challenge available";
    description = "Four badges have been earned and Petalburg Gym is open for the main battle.";
    nextStep = "Enter Petalburg Gym, clear the battle rooms, and defeat Norman.";
  } else if (state === 7) {
    value = "Norman defeated";
    description = "The Balance Badge story battle is complete.";
  } else {
    value = "Norman rematch state";
    description = "The postgame rematch version of Norman is active.";
    nextStep = "Challenge Norman when his rematch is available.";
  }
  return {
    key: "petalburg-gym-phase",
    label: "Petalburg Gym phase",
    category: "Current story phase",
    value,
    description,
    nextStep,
    sourceRefs: [...SOURCES.petalburg],
  };
}

function buildHoennEliteFourFact(
  game: GameVersion,
  events: GameEventProgress | undefined,
  state?: number
): GameProgressFact | undefined {
  if (state === undefined || state < 1 || state > 4 || isSet(events, "FLAG_SYS_GAME_CLEAR")) {
    return undefined;
  }

  const sidneyKey = game === "ruby" || game === "sapphire"
    ? "FLAG_DEFEATED_ELITE_4_SYDNEY"
    : "FLAG_DEFEATED_ELITE_4_SIDNEY";
  const members = [
    { key: sidneyKey, name: "Sidney" },
    { key: "FLAG_DEFEATED_ELITE_4_PHOEBE", name: "Phoebe" },
    { key: "FLAG_DEFEATED_ELITE_4_GLACIA", name: "Glacia" },
    { key: "FLAG_DEFEATED_ELITE_4_DRAKE", name: "Drake" },
  ];
  const next = members.find((member) => !isSet(events, member.key));
  const value = next ? `Challenge ${next.name}` : "Challenge the Champion";

  return {
    key: "hoenn-league-run",
    label: "Pokémon League run",
    category: "Current story phase",
    value,
    description: next
      ? `The current Elite Four run has advanced to ${next.name}. These battle flags reset when a new League attempt begins.`
      : "All four Elite Four members are defeated in the current run; the Champion battle remains.",
    nextStep: next
      ? `Continue to ${next.name}'s room and win the battle.`
      : "Enter the Champion's room and complete the Hall of Fame battle.",
    sourceRefs: [...SOURCES.hoennEliteFour],
  };
}

function buildSootopolisFact(
  game: GameVersion,
  events: GameEventProgress | undefined,
  state?: number
): GameProgressFact | undefined {
  if (state === undefined) return undefined;

  if (game === "emerald") {
    if (!isSet(events, "FLAG_KYOGRE_ESCAPED_SEAFLOOR_CAVERN") || state < 1 || state > 5) {
      return undefined;
    }
    const phases: Record<number, [string, string, string]> = {
      1: [
        "Reach Steven in Sootopolis",
        "Groudon and Kyogre have reached Sootopolis and the crisis scene has begun.",
        "Enter Sootopolis and meet Steven near the city center.",
      ],
      2: [
        "Speak with Steven",
        "The clash between Groudon and Kyogre has been witnessed and Steven can advance the investigation.",
        "Talk to Steven and follow him to the Cave of Origin.",
      ],
      3: [
        "Find Wallace",
        "Wallace is waiting in the Cave of Origin to discuss a Pokémon capable of stopping the crisis.",
        "Meet Wallace and identify Sky Pillar as Rayquaza's location.",
      ],
      4: [
        "Awaken Rayquaza",
        "Wallace has opened the route to Sky Pillar.",
        "Travel to Sky Pillar, reach the summit, and awaken Rayquaza.",
      ],
      5: [
        "Return to Sootopolis",
        "Rayquaza has stopped the battle between Groudon and Kyogre.",
        "Return to the Sootopolis Gym area and finish the closing dialogue.",
      ],
    };
    const [value, description, nextStep] = phases[state];
    return {
      key: "sootopolis-crisis-phase",
      label: "Sootopolis crisis",
      category: "Current story phase",
      value,
      description,
      nextStep,
      sourceRefs: [...SOURCES.sootopolis],
    };
  }

  if (
    (game !== "ruby" && game !== "sapphire")
    || !isSet(events, "FLAG_LEGEND_ESCAPED_SEAFLOOR_CAVERN")
    || isSet(events, "FLAG_LEGENDARY_BATTLE_COMPLETED")
    || state < 1
    || state > 2
  ) {
    return undefined;
  }
  return {
    key: "sootopolis-crisis-phase",
    label: "Sootopolis crisis",
    category: "Current story phase",
    value: state === 1 ? "Meet Steven and Wallace" : "Enter the Cave of Origin",
    description: "The awakened legendary Pokémon crisis is active in Sootopolis.",
    nextStep: state === 1
      ? "Find Steven and Wallace in Sootopolis."
      : "Enter the Cave of Origin and confront the awakened legendary Pokémon.",
    sourceRefs: [...SOURCES.sootopolis],
  };
}

function buildGen3Facts(input: BuildProgressFactsInput): GameProgressFact[] {
  if (input.game === "firered" || input.game === "leafgreen") {
    const value = ["Bulbasaur", "Squirtle", "Charmander"][input.raw?.starterMon ?? -1];
    const starterFact = isSet(input.events, "FLAG_SYS_POKEMON_GET") && value
      ? choiceFact("starter-choice", value, `Your permanent Kanto starter choice is ${value}.`, SOURCES.frlgStarter)
      : undefined;
    return [
      storyRouteFact(
        input.events,
        [
          { key: "FLAG_SYS_POKEDEX_GET", label: "receive the Pokédex from Professor Oak" },
          { key: "FLAG_DEFEATED_BROCK", label: "defeat Brock in Pewter City" },
          { key: "FLAG_DEFEATED_MISTY", label: "defeat Misty in Cerulean City" },
          { key: "FLAG_DEFEATED_LT_SURGE", label: "defeat Lt. Surge in Vermilion City" },
          { key: "FLAG_DEFEATED_ERIKA", label: "defeat Erika in Celadon City" },
          { key: "FLAG_DEFEATED_KOGA", label: "defeat Koga in Fuchsia City" },
          { key: "FLAG_DEFEATED_SABRINA", label: "defeat Sabrina in Saffron City" },
          { key: "FLAG_DEFEATED_BLAINE", label: "defeat Blaine on Cinnabar Island" },
          { key: "FLAG_DEFEATED_LEADER_GIOVANNI", label: "defeat Giovanni in Viridian Gym" },
        ],
        "FLAG_SYS_GAME_CLEAR",
        "Kanto",
        SOURCES.frlgStory,
        4
      ),
      starterFact,
    ].filter((fact): fact is GameProgressFact => Boolean(fact));
  }
  return [
    storyRouteFact(
      input.events,
      [
        { key: "FLAG_DEFEATED_RUSTBORO_GYM", label: "defeat Roxanne in Rustboro City" },
        { key: "FLAG_DEFEATED_DEWFORD_GYM", label: "defeat Brawly in Dewford Town" },
        { key: "FLAG_DEFEATED_MAUVILLE_GYM", label: "defeat Wattson in Mauville City" },
        { key: "FLAG_DEFEATED_LAVARIDGE_GYM", label: "defeat Flannery in Lavaridge Town" },
        { key: "FLAG_DEFEATED_PETALBURG_GYM", label: "defeat Norman in Petalburg City" },
        { key: "FLAG_DEFEATED_FORTREE_GYM", label: "defeat Winona in Fortree City" },
        { key: "FLAG_DEFEATED_MOSSDEEP_GYM", label: "defeat the Mossdeep Gym Leaders" },
        { key: "FLAG_DEFEATED_SOOTOPOLIS_GYM", label: "defeat the Sootopolis Gym Leader" },
      ],
      "FLAG_SYS_GAME_CLEAR",
      "Hoenn",
      SOURCES.hoennStory,
      1
    ),
    buildHoennStarter(input.raw),
    buildLittlerootFact(input.raw),
    buildPetalburgFact(input.raw),
    buildSootopolisFact(input.game, input.events, input.raw?.sootopolisState),
    buildHoennEliteFourFact(input.game, input.events, input.raw?.eliteFourState),
  ].filter((fact): fact is GameProgressFact => Boolean(fact));
}

export function buildProgressFacts(input: BuildProgressFactsInput): GameProgressFacts | undefined {
  const facts = input.generation === 1
    ? buildGen1Facts(input)
    : input.generation === 2
      ? buildGen2Facts(input)
      : input.generation === 3
        ? buildGen3Facts(input)
        : [];
  return facts.length > 0 ? { source: input.source, facts } : undefined;
}

export function normalizeProgressRaw(value: unknown): ProgressFactRawValues {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const result: ProgressFactRawValues = {};
  for (const key of [
    "playerStarter",
    "oaksLabScript",
    "hallOfFameCount",
    "elmsLabScene",
    "radioTower5FScene",
    "teamRocketBaseB2FScene",
    "teamRocketBaseB3FScene",
    "starterMon",
    "birchLabState",
    "littlerootIntroState",
    "petalburgGymState",
    "eliteFourState",
    "sootopolisState",
  ] as const) {
    const number = Number(record[key]);
    if (Number.isFinite(number)) result[key] = number;
  }
  return result;
}
