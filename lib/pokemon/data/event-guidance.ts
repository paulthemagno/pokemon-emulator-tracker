export interface EventGuidance {
  description?: string;
  completionMeaning?: string;
  notCompletedMeaning?: string;
  actionHint?: string;
  steps?: string[];
  prerequisites?: string[];
  mutuallyExclusiveWith?: string[];
  normalMissingReason?: string;
  sourceRefs?: string[];
}

const POKERED_OAKS_LAB =
  "https://github.com/pret/pokered/blob/3c814341c81307b3193a9ea890ff3a197b09b4e3/scripts/OaksLab.asm";
const POKERED_MT_MOON =
  "https://github.com/pret/pokered/blob/3c814341c81307b3193a9ea890ff3a197b09b4e3/scripts/MtMoonB2F.asm";
const POKERED_FIGHTING_DOJO =
  "https://github.com/pret/pokered/blob/3c814341c81307b3193a9ea890ff3a197b09b4e3/scripts/FightingDojo.asm";
const POKECRYSTAL_DRAGONS_DEN =
  "https://github.com/pret/pokecrystal/blob/8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217/maps/DragonsDenB1F.asm";
const POKECRYSTAL_ELMS_LAB =
  "https://github.com/pret/pokecrystal/blob/8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217/maps/ElmsLab.asm";
const POKECRYSTAL_ILEX_FOREST =
  "https://github.com/pret/pokecrystal/blob/8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217/maps/IlexForest.asm";
const POKECRYSTAL_UNOWN =
  "https://github.com/pret/pokecrystal/blob/8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217/event/unown.asm";
const POKECRYSTAL_INDIGO_PLATEAU =
  "https://github.com/pret/pokecrystal/blob/8f2162d7dd72a42f4a0a1f2afdb32d4a00d7f217/maps/IndigoPlateauPokecenter1F.asm";
const POKEEMERALD_SEAFLOOR =
  "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/SeafloorCavern_Room9/scripts.inc";
const POKEEMERALD_MIRAGE_TOWER =
  "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/MirageTower_4F/scripts.inc";
const POKEEMERALD_VICTORY_ROAD =
  "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/VictoryRoad_1F/scripts.inc";
const POKEEMERALD_BATTLE_SETUP =
  "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/src/battle_setup.c";

const EMERALD_WALLY_TEAMS: Record<string, EventGuidance> = {
  TRAINER_WALLY_VR_1: {
    description: "Victory over Wally's first Victory Road team, before the Pokemon League. This does not prove a post-League rematch.",
    completionMeaning: "Set: Wally's pre-League Victory Road team was defeated.",
    notCompletedMeaning: "Not set: this specific pre-League team has no recorded victory bit.",
    sourceRefs: [POKEEMERALD_VICTORY_ROAD, POKEEMERALD_BATTLE_SETUP],
  },
  ...Object.fromEntries([2, 3, 4, 5].map((team) => [`TRAINER_WALLY_VR_${team}`, {
    description: team === 2
      ? "Victory over Wally's first post-League team at the Victory Road exit. This encounter appears after entering the Hall of Fame."
      : `Victory over Wally's post-League rematch team ${team - 1} at the Victory Road exit. The rematch table selects this specific stronger team.`,
    completionMeaning: "Set: this specific post-League Wally team was defeated; this confirms a post-League victory.",
    notCompletedMeaning: "Not set: no victory over this specific team is recorded. Check the other post-League Wally team bits before saying he has never been defeated after the League.",
    normalMissingReason: "Later teams depend on rematch progression and readiness. An unset bit is not proof that this team can be challenged now.",
    steps: ["After entering the Hall of Fame, speak to Wally near the Victory Road exit. Later teams require the rematch system to make another battle available."],
    sourceRefs: [POKEEMERALD_VICTORY_ROAD, POKEEMERALD_BATTLE_SETUP],
  }])),
};

const emeraldScript = (map: string) =>
  `https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/${map}/scripts.inc`;

// Reviewed against each map's outcome branches, not inferred from flag names.
const EMERALD_OPTIONAL_CONTEXT: Record<string, EventGuidance> = {
  ...Object.fromEntries([
    ["REGIROCK", "DesertRuins"], ["REGICE", "IslandCave"], ["REGISTEEL", "AncientTomb"],
    ["RAYQUAZA", "SkyPillar_Top"], ["KYOGRE", "MarineCave_End"], ["GROUDON", "TerraCave_End"],
  ].map(([species, map]) => [`FLAG_DEFEATED_${species}`, {
    description: `${species} encounter outcome marker. The map script sets this on both the defeat and capture completion paths; this flag alone does not prove capture.`,
    completionMeaning: "Set: the encounter outcome is recorded. This does not distinguish capture from defeating the Pokemon.",
    notCompletedMeaning: "Not set: this encounter outcome is not recorded by this bit; this does not establish current encounter availability.",
    normalMissingReason: "Keep encounter flags separate from Pokedex ownership and current party/PC records. Pokedex ownership can also result from a trade, and visibility flags alone are not capture proof.",
    steps: [],
    sourceRefs: [emeraldScript(map)],
  }])),
  ...Object.fromEntries([
    ["MEW", "FarawayIsland_Interior"], ["HO_OH", "NavelRock_Top"], ["LUGIA", "NavelRock_Bottom"],
    ["LATIAS_OR_LATIOS", "SouthernIsland_Interior"],
  ].flatMap(([species, map]) => [
    [`FLAG_CAUGHT_${species}`, {
      description: species === "LATIAS_OR_LATIOS"
        ? "Capture-side record for the Southern Island stationary Latias/Latios encounter. This is not the roaming legendary's capture flag."
        : `Capture-side record for the ${species} encounter on this map. It is distinct from the defeated flag and does not prove the Pokemon is still owned.`,
      completionMeaning: "Set: the map's capture-side completion was recorded.",
      notCompletedMeaning: "Not set: capture at this map is not recorded by this bit. It does not rule out obtaining the species by another method.",
      normalMissingReason: "These encounters require their map's access conditions; do not treat event-only island encounters as mandatory unfinished quests.",
      steps: [], sourceRefs: [emeraldScript(map)],
    }],
    [`FLAG_DEFEATED_${species}`, {
      description: `Defeat-side record for ${species} on this map, separate from its FLAG_CAUGHT_* record. This does not prove capture.`,
      completionMeaning: "Set: the script's defeat branch was recorded, not its capture branch.",
      notCompletedMeaning: "Not set: this defeat branch is not recorded. Check the separate capture bit and map access conditions.",
      steps: [], sourceRefs: [emeraldScript(map)],
    }],
  ])),
  FLAG_DEFEATED_DEOXYS: {
    description: "Birth Island Deoxys defeat-side record, set on the B_OUTCOME_WON branch. It is not capture proof.",
    completionMeaning: "Set: Deoxys was defeated in the Birth Island encounter.",
    notCompletedMeaning: "Not set: the defeat-side event is not recorded; this is not proof of capture or encounter availability.",
    sourceRefs: [emeraldScript("BirthIsland_Exterior")],
  },
  FLAG_BATTLED_DEOXYS: {
    description: "Birth Island outcome marker set on the completion path after the script excludes defeat and fleeing. It is not simply an 'ever encountered Deoxys' counter; inspect it alongside the separate defeat flag and Pokedex.",
    completionMeaning: "Set: this specific post-battle script path was recorded.",
    notCompletedMeaning: "Not set: this path is not recorded. Do not infer that Deoxys has never been encountered.",
    sourceRefs: [emeraldScript("BirthIsland_Exterior")],
  },
  FLAG_EXCHANGED_SCANNER: {
    description: "Captain Stern accepted the Scanner in exchange for a Deep Sea Tooth or Deep Sea Scale. Both reward branches set the same flag, so it does not retain which reward was chosen.",
    completionMeaning: "Set: the Scanner exchange succeeded.",
    notCompletedMeaning: "Not set: the exchange is not recorded; check whether the Scanner has been collected and is in the bag.",
    sourceRefs: [emeraldScript("SlateportCity_Harbor")],
  },
  FLAG_WINGULL_SENT_ON_ERRAND: {
    description: "The Fortree house Wingull errand was started. This is not proof the mail was delivered or the Mental Herb reward was collected.",
    sourceRefs: [emeraldScript("FortreeCity_House4")],
  },
  FLAG_WINGULL_DELIVERED_MAIL: {
    description: "The Mossdeep house interaction recorded Wingull delivering the mail. The Mental Herb reward is a separate return interaction in Fortree.",
    sourceRefs: [emeraldScript("MossdeepCity_House2"), emeraldScript("FortreeCity_House4")],
  },
  FLAG_RECEIVED_MENTAL_HERB: {
    description: "The Mental Herb reward for the Wingull errand was successfully collected from the Fortree boy. This receipt does not imply the item remains in the bag.",
    sourceRefs: [emeraldScript("FortreeCity_House4")],
  },
  FLAG_GOT_BASEMENT_KEY_FROM_WATTSON: {
    description: "Wattson gave the Basement Key to start the New Mauville generator errand. Generator shutdown and collecting TM Thunderbolt are separate facts.",
    sourceRefs: [emeraldScript("MauvilleCity")],
  },
  FLAG_GOT_TM_THUNDERBOLT_FROM_WATTSON: {
    description: "Wattson's TM Thunderbolt reward was successfully received after stopping the New Mauville generator. The receipt remains useful even if the TM was used.",
    sourceRefs: [emeraldScript("MauvilleCity"), emeraldScript("NewMauville_Inside")],
  },
  FLAG_RECEIVED_EXP_SHARE: {
    description: "Mr. Stone's Exp. Share reward for delivering Steven's letter was successfully received. Delivering the letter and claiming this reward are separate events.",
    sourceRefs: [emeraldScript("RustboroCity_DevonCorp_3F")],
  },
  FLAG_RECEIVED_BELDUM: {
    description: "The gift Beldum in Steven's Mossdeep house was received. This is a gift receipt, not a wild capture or proof of current ownership.",
    sourceRefs: [emeraldScript("MossdeepCity_StevensHouse")],
  },
  FLAG_RECEIVED_CASTFORM: {
    description: "The Weather Institute gift Castform was received. This is distinct from clearing the Institute battles and from currently owning Castform.",
    sourceRefs: [emeraldScript("Route119_WeatherInstitute_2F")],
  },
  FLAG_RECEIVED_LAVARIDGE_EGG: {
    description: "The Lavaridge gift Egg was accepted. This flag does not record whether that Egg has hatched.",
    sourceRefs: [emeraldScript("LavaridgeTown")],
  },
  FLAG_RECEIVED_REVIVED_FOSSIL_MON: {
    description: "A revived fossil Pokemon was received from Devon. The scientist can revive another fossil; combine this history flag with the current resurrection phase and selected fossil variable.",
    sourceRefs: [emeraldScript("RustboroCity_DevonCorp_2F")],
  },
};
const BULBAPEDIA_MIRAGE_TOWER =
  "https://bulbapedia.bulbagarden.net/w/index.php?title=Mirage_Tower&oldid=4566304";
const POKEFIRERED_SILPH =
  "https://github.com/pret/pokefirered/blob/e060ab955b5dc9ac1c4904c2cd141683615cf477/data/maps/SilphCo_11F/scripts.inc";
const POKEFIRERED_MT_MOON =
  "https://github.com/pret/pokefirered/blob/e060ab955b5dc9ac1c4904c2cd141683615cf477/data/maps/MtMoon_B2F/scripts.inc";
const POKEFIRERED_DOJO =
  "https://github.com/pret/pokefirered/blob/e060ab955b5dc9ac1c4904c2cd141683615cf477/data/maps/SaffronCity_Dojo/scripts.inc";

const GEN1_OAK_SEQUENCE: Record<string, EventGuidance> = {
  EVENT_FOLLOWED_OAK_INTO_LAB: {
    description: "Oak has brought the player into his lab at the start of the Kanto story.",
    actionHint: "Trigger Oak on Route 1/Pallet and follow him into the lab.",
    steps: ["Walk north from Pallet Town until Oak stops you.", "Follow Oak back into the lab."],
    sourceRefs: [POKERED_OAKS_LAB],
  },
  EVENT_GOT_STARTER: {
    description: "The player has received the first partner Pokemon from Oak.",
    actionHint: "Choose one of the three starter Poke Balls in Oak's Lab.",
    steps: ["Let Oak ask you to choose a Pokemon.", "Pick one starter Poke Ball in Oak's Lab."],
    prerequisites: ["EVENT_OAK_ASKED_TO_CHOOSE_MON"],
    sourceRefs: [POKERED_OAKS_LAB],
  },
  EVENT_BATTLED_RIVAL_IN_OAKS_LAB: {
    description: "The first rival battle in Oak's Lab has been completed.",
    actionHint: "After choosing the starter, walk toward the exit and finish the rival battle.",
    steps: ["Choose a starter.", "Walk toward the lab exit.", "Finish the rival battle."],
    prerequisites: ["EVENT_GOT_STARTER"],
    sourceRefs: [POKERED_OAKS_LAB],
  },
  EVENT_GOT_POKEDEX: {
    description: "Oak has given the Pokedex after the Parcel errand.",
    actionHint: "Bring Oak's Parcel back from Viridian and talk to Oak in the lab.",
    steps: ["Get Oak's Parcel from Viridian.", "Return to Oak's Lab.", "Talk to Oak to receive the Pokedex."],
    prerequisites: ["EVENT_BATTLED_RIVAL_IN_OAKS_LAB", "EVENT_GOT_OAKS_PARCEL"],
    sourceRefs: [POKERED_OAKS_LAB],
  },
  EVENT_GOT_POKEBALLS_FROM_OAK: {
    description: "Oak has given the optional Poke Ball gift after the early rival route.",
    actionHint: "Talk to Oak after the Route 22 rival battle if you do not already have Poke Balls.",
    steps: ["Get the Pokedex.", "Beat the Route 22 rival battle.", "Talk to Oak without already having Poke Balls."],
    prerequisites: ["EVENT_GOT_POKEDEX", "EVENT_BEAT_ROUTE22_RIVAL_1ST_BATTLE"],
    normalMissingReason: "This can stay unset in a normal run if you already have Poke Balls by another route.",
    sourceRefs: [POKERED_OAKS_LAB],
  },
  EVENT_GOT_DOME_FOSSIL: {
    description: "The Dome Fossil was chosen in Mt. Moon.",
    actionHint: "Choose the Dome Fossil after the Super Nerd battle in Mt. Moon B2F.",
    steps: ["Beat the Super Nerd in Mt. Moon B2F.", "Choose the Dome Fossil."],
    mutuallyExclusiveWith: ["EVENT_GOT_HELIX_FOSSIL"],
    normalMissingReason: "The Dome and Helix Fossils are a normal either/or choice.",
    sourceRefs: [POKERED_MT_MOON],
  },
  EVENT_GOT_HELIX_FOSSIL: {
    description: "The Helix Fossil was chosen in Mt. Moon.",
    actionHint: "Choose the Helix Fossil after the Super Nerd battle in Mt. Moon B2F.",
    steps: ["Beat the Super Nerd in Mt. Moon B2F.", "Choose the Helix Fossil."],
    mutuallyExclusiveWith: ["EVENT_GOT_DOME_FOSSIL"],
    normalMissingReason: "The Dome and Helix Fossils are a normal either/or choice.",
    sourceRefs: [POKERED_MT_MOON],
  },
  EVENT_GOT_HITMONLEE: {
    description: "Hitmonlee was chosen as the Fighting Dojo reward.",
    actionHint: "After clearing the Fighting Dojo, choose the Hitmonlee Poke Ball.",
    steps: ["Clear the Fighting Dojo.", "Choose the Hitmonlee Poke Ball as the reward."],
    mutuallyExclusiveWith: ["EVENT_GOT_HITMONCHAN"],
    normalMissingReason: "The Fighting Dojo reward is a normal either/or choice.",
    sourceRefs: [POKERED_FIGHTING_DOJO],
  },
  EVENT_GOT_HITMONCHAN: {
    description: "Hitmonchan was chosen as the Fighting Dojo reward.",
    actionHint: "After clearing the Fighting Dojo, choose the Hitmonchan Poke Ball.",
    steps: ["Clear the Fighting Dojo.", "Choose the Hitmonchan Poke Ball as the reward."],
    mutuallyExclusiveWith: ["EVENT_GOT_HITMONLEE"],
    normalMissingReason: "The Fighting Dojo reward is a normal either/or choice.",
    sourceRefs: [POKERED_FIGHTING_DOJO],
  },
};

function hoennLeagueRunGuidance(repo: string, commit: string, sidneyKey: string): Record<string, EventGuidance> {
  const base = `https://github.com/pret/${repo}/blob/${commit}`;
  return Object.fromEntries([
    [sidneyKey, "Sidney", "SidneysRoom"],
    ["FLAG_DEFEATED_ELITE_4_PHOEBE", "Phoebe", "PhoebesRoom"],
    ["FLAG_DEFEATED_ELITE_4_GLACIA", "Glacia", "GlaciasRoom"],
    ["FLAG_DEFEATED_ELITE_4_DRAKE", "Drake", "DrakesRoom"],
  ].map(([key, name, room]) => [key, {
    description: `${name}'s battle flag belongs to the current League attempt. The Hall of Fame resets it, so an unset bit does not mean you have never defeated ${name}.`,
    completionMeaning: `${name} is recorded as defeated in the current League attempt.`,
    notCompletedMeaning: `No victory over ${name} is recorded in the current attempt, or the League flags have been reset after the Hall of Fame.`,
    steps: [`Defeat ${name} during a League attempt to set this flag.`, "The Hall of Fame resets the four Elite Four battle flags. Use the main-story Champion milestone (FLAG_SYS_GAME_CLEAR) for permanent League completion."],
    normalMissingReason: "This flag can be unset after completing the League. It tracks a single attempt rather than permanent story completion.",
    sourceRefs: [`${base}/data/maps/EverGrandeCity_${room}/scripts.inc`, `${base}/data/event_scripts.s`, `${base}/data/scripts/hall_of_fame.inc`],
  }]));
}

const GEN2_LEAGUE_RUN_STATE: Record<string, EventGuidance> = {
  EVENT_BEAT_ELITE_4_WILL: {
    description: "Will has been beaten in the current Elite Four attempt.",
    normalMissingReason: "This is reset when Indigo Plateau prepares a new Elite Four attempt; use EVENT_BEAT_ELITE_FOUR for story completion.",
    sourceRefs: [POKECRYSTAL_INDIGO_PLATEAU],
  },
  EVENT_BEAT_ELITE_4_KOGA: {
    description: "Koga has been beaten in the current Elite Four attempt.",
    normalMissingReason: "This is reset when Indigo Plateau prepares a new Elite Four attempt; use EVENT_BEAT_ELITE_FOUR for story completion.",
    sourceRefs: [POKECRYSTAL_INDIGO_PLATEAU],
  },
  EVENT_BEAT_ELITE_4_BRUNO: {
    description: "Bruno has been beaten in the current Elite Four attempt.",
    normalMissingReason: "This is reset when Indigo Plateau prepares a new Elite Four attempt; use EVENT_BEAT_ELITE_FOUR for story completion.",
    sourceRefs: [POKECRYSTAL_INDIGO_PLATEAU],
  },
  EVENT_BEAT_ELITE_4_KAREN: {
    description: "Karen has been beaten in the current Elite Four attempt.",
    normalMissingReason: "This is reset when Indigo Plateau prepares a new Elite Four attempt; use EVENT_BEAT_ELITE_FOUR for story completion.",
    sourceRefs: [POKECRYSTAL_INDIGO_PLATEAU],
  },
  EVENT_BEAT_CHAMPION_LANCE: {
    description: "Lance has been beaten in the current League attempt.",
    normalMissingReason: "This is reset when Indigo Plateau prepares a new League attempt; use EVENT_BEAT_ELITE_FOUR for Hall of Fame completion.",
    sourceRefs: [POKECRYSTAL_INDIGO_PLATEAU],
  },
};

export const EVENT_GUIDANCE_BY_PROFILE: Record<string, Record<string, EventGuidance>> = {
  "red-blue-en": GEN1_OAK_SEQUENCE,
  "yellow-en": GEN1_OAK_SEQUENCE,
  "gold-silver-en": {
    ...GEN2_LEAGUE_RUN_STATE,
    EVENT_GOT_A_POKEMON_FROM_ELM: {
      description: "Elm's starter choice has been completed, so the Johto main route has begun.",
      actionHint: "Choose one starter in Elm's Lab to begin the main Johto route.",
      steps: ["Enter Elm's Lab.", "Choose one starter from Elm.", "Accept the Pokemon to start the route."],
      sourceRefs: [POKECRYSTAL_ELMS_LAB],
    },
    EVENT_GOT_CYNDAQUIL_FROM_ELM: {
      description: "Cyndaquil was chosen as Elm's starter Pokemon.",
      steps: ["Enter Elm's Lab.", "Choose Cyndaquil from Elm's starter table."],
      mutuallyExclusiveWith: ["EVENT_GOT_TOTODILE_FROM_ELM", "EVENT_GOT_CHIKORITA_FROM_ELM"],
      normalMissingReason: "Only one Elm starter can be chosen in a normal save.",
      sourceRefs: [POKECRYSTAL_ELMS_LAB],
    },
    EVENT_GOT_TOTODILE_FROM_ELM: {
      description: "Totodile was chosen as Elm's starter Pokemon.",
      steps: ["Enter Elm's Lab.", "Choose Totodile from Elm's starter table."],
      mutuallyExclusiveWith: ["EVENT_GOT_CYNDAQUIL_FROM_ELM", "EVENT_GOT_CHIKORITA_FROM_ELM"],
      normalMissingReason: "Only one Elm starter can be chosen in a normal save.",
      sourceRefs: [POKECRYSTAL_ELMS_LAB],
    },
    EVENT_GOT_CHIKORITA_FROM_ELM: {
      description: "Chikorita was chosen as Elm's starter Pokemon.",
      steps: ["Enter Elm's Lab.", "Choose Chikorita from Elm's starter table."],
      mutuallyExclusiveWith: ["EVENT_GOT_CYNDAQUIL_FROM_ELM", "EVENT_GOT_TOTODILE_FROM_ELM"],
      normalMissingReason: "Only one Elm starter can be chosen in a normal save.",
      sourceRefs: [POKECRYSTAL_ELMS_LAB],
    },
    EVENT_HERDED_FARFETCHD: {
      description: "The Ilex Forest Farfetch'd puzzle has been solved.",
      actionHint: "Complete the Ilex Forest Farfetch'd puzzle.",
      steps: ["Find the missing Farfetch'd in Ilex Forest.", "Approach it from the correct side to herd it back.", "Return it to the charcoal maker's apprentice."],
      sourceRefs: [POKECRYSTAL_ILEX_FOREST],
    },
    EVENT_GOT_HM01_CUT: {
      description: "HM01 Cut has been received from the charcoal maker after the Ilex Forest puzzle.",
      actionHint: "After herding Farfetch'd, talk to the charcoal maker in Ilex Forest to receive HM01 Cut.",
      steps: ["Complete the Farfetch'd puzzle.", "Talk to the charcoal maker in Ilex Forest.", "Receive HM01 Cut."],
      prerequisites: ["EVENT_HERDED_FARFETCHD"],
      sourceRefs: [POKECRYSTAL_ILEX_FOREST],
    },
    EVENT_GOT_TM24_DRAGONBREATH: {
      description: "Clair's Dragonbreath reward has been received after the Dragon's Den sequence.",
      actionHint: "Complete the Dragon's Den follow-up and accept Clair's TM24 scene.",
      steps: ["Beat Clair.", "Complete the Dragon's Den follow-up.", "Accept TM24 Dragonbreath from Clair."],
      prerequisites: ["EVENT_BEAT_CLAIR", "EVENT_DRAGONS_DEN_B1F_DRAGON_FANG"],
      sourceRefs: [POKECRYSTAL_DRAGONS_DEN],
    },
  },
  "crystal-en": {
    ...GEN2_LEAGUE_RUN_STATE,
    EVENT_GOT_A_POKEMON_FROM_ELM: {
      description: "Elm's starter choice has been completed, so the Johto main route has begun.",
      actionHint: "Choose one starter in Elm's Lab to begin the main Johto route.",
      steps: ["Enter Elm's Lab.", "Choose one starter from Elm.", "Accept the Pokemon to start the route."],
      sourceRefs: [POKECRYSTAL_ELMS_LAB],
    },
    EVENT_GOT_CYNDAQUIL_FROM_ELM: {
      description: "Cyndaquil was chosen as Elm's starter Pokemon.",
      steps: ["Enter Elm's Lab.", "Choose Cyndaquil from Elm's starter table."],
      mutuallyExclusiveWith: ["EVENT_GOT_TOTODILE_FROM_ELM", "EVENT_GOT_CHIKORITA_FROM_ELM"],
      normalMissingReason: "Only one Elm starter can be chosen in a normal save.",
      sourceRefs: [POKECRYSTAL_ELMS_LAB],
    },
    EVENT_GOT_TOTODILE_FROM_ELM: {
      description: "Totodile was chosen as Elm's starter Pokemon.",
      steps: ["Enter Elm's Lab.", "Choose Totodile from Elm's starter table."],
      mutuallyExclusiveWith: ["EVENT_GOT_CYNDAQUIL_FROM_ELM", "EVENT_GOT_CHIKORITA_FROM_ELM"],
      normalMissingReason: "Only one Elm starter can be chosen in a normal save.",
      sourceRefs: [POKECRYSTAL_ELMS_LAB],
    },
    EVENT_GOT_CHIKORITA_FROM_ELM: {
      description: "Chikorita was chosen as Elm's starter Pokemon.",
      steps: ["Enter Elm's Lab.", "Choose Chikorita from Elm's starter table."],
      mutuallyExclusiveWith: ["EVENT_GOT_CYNDAQUIL_FROM_ELM", "EVENT_GOT_TOTODILE_FROM_ELM"],
      normalMissingReason: "Only one Elm starter can be chosen in a normal save.",
      sourceRefs: [POKECRYSTAL_ELMS_LAB],
    },
    EVENT_HERDED_FARFETCHD: {
      description: "The Ilex Forest Farfetch'd puzzle has been solved.",
      actionHint: "Complete the Ilex Forest Farfetch'd puzzle.",
      steps: ["Find the missing Farfetch'd in Ilex Forest.", "Approach it from the correct side to herd it back.", "Return it to the charcoal maker's apprentice."],
      sourceRefs: [POKECRYSTAL_ILEX_FOREST],
    },
    EVENT_GOT_HM01_CUT: {
      description: "HM01 Cut has been received from the charcoal maker after the Ilex Forest puzzle.",
      actionHint: "After herding Farfetch'd, talk to the charcoal maker in Ilex Forest to receive HM01 Cut.",
      steps: ["Complete the Farfetch'd puzzle.", "Talk to the charcoal maker in Ilex Forest.", "Receive HM01 Cut."],
      prerequisites: ["EVENT_HERDED_FARFETCHD"],
      sourceRefs: [POKECRYSTAL_ILEX_FOREST],
    },
    EVENT_GOT_TM24_DRAGONBREATH: {
      description: "Clair's Dragonbreath reward has been received after the Dragon Shrine sequence.",
      actionHint: "Complete the Dragon Shrine follow-up and accept Clair's TM24 scene.",
      steps: ["Beat Clair.", "Complete the Dragon Shrine follow-up.", "Accept TM24 Dragonbreath from Clair."],
      prerequisites: ["EVENT_BEAT_CLAIR"],
      sourceRefs: [POKECRYSTAL_DRAGONS_DEN],
    },
    EVENT_BEAT_RIVAL_IN_MT_MOON: {
      description: "The postgame rival battle in Mt. Moon has been completed.",
      actionHint: "This also controls whether the rival may appear in Dragon's Den on Tuesday/Thursday.",
      steps: ["Reach Mt. Moon in Kanto.", "Battle and defeat the rival there."],
      sourceRefs: [POKECRYSTAL_DRAGONS_DEN],
    },
    EVENT_WALL_OPENED_IN_HO_OH_CHAMBER: {
      description: "The hidden wall in the Ruins of Alph Ho-Oh Chamber has opened.",
      actionHint: "Put Ho-Oh first in your party, then inspect the rear wall in the Ho-Oh Chamber.",
      steps: ["Have Ho-Oh in your party.", "Move Ho-Oh to the first party slot.", "Inspect the rear wall in the Ruins of Alph Ho-Oh Chamber."],
      sourceRefs: [POKECRYSTAL_UNOWN],
    },
    EVENT_WALL_OPENED_IN_KABUTO_CHAMBER: {
      description: "The hidden wall in the Ruins of Alph Kabuto Chamber has opened.",
      actionHint: "Use Escape Rope at the rear wall in the Kabuto Chamber.",
      steps: ["Bring an Escape Rope.", "Inspect the rear wall in the Ruins of Alph Kabuto Chamber.", "Use Escape Rope when prompted."],
      sourceRefs: [POKECRYSTAL_UNOWN],
    },
    EVENT_WALL_OPENED_IN_OMANYTE_CHAMBER: {
      description: "The hidden wall in the Ruins of Alph Omanyte Chamber has opened.",
      actionHint: "Have a Water Stone and inspect the rear wall in the Omanyte Chamber.",
      steps: ["Have a Water Stone.", "Inspect the rear wall in the Ruins of Alph Omanyte Chamber."],
      sourceRefs: [POKECRYSTAL_UNOWN],
    },
    EVENT_WALL_OPENED_IN_AERODACTYL_CHAMBER: {
      description: "The hidden wall in the Ruins of Alph Aerodactyl Chamber has opened.",
      actionHint: "Use Flash at the rear wall in the Aerodactyl Chamber.",
      steps: ["Bring a Pokemon that can use Flash.", "Inspect the rear wall in the Ruins of Alph Aerodactyl Chamber.", "Use Flash when prompted."],
      sourceRefs: [POKECRYSTAL_UNOWN],
    },
  },
  "ruby-sapphire-en": {
    ...hoennLeagueRunGuidance("pokeruby", "63a8cbf0016b351a4e68f7036fa0b77e23d2f2c1", "FLAG_DEFEATED_ELITE_4_SYDNEY"),
    FLAG_KYOGRE_ESCAPED_SEAFLOOR_CAVERN: {
      description: "Kyogre has left Seafloor Cavern as part of the late Hoenn story crisis.",
      actionHint: "Finish the Seafloor Cavern room 9 story scene after the Archie battle.",
      steps: ["Reach Seafloor Cavern room 9.", "Finish the Archie story battle.", "Watch Kyogre leave the cavern."],
      prerequisites: ["FLAG_LEGENDARIES_IN_SOOTOPOLIS"],
      sourceRefs: [POKEEMERALD_SEAFLOOR],
    },
    FLAG_GROUDON_ESCAPED_SEAFLOOR_CAVERN: {
      description: "Groudon has left Seafloor Cavern as part of the late Hoenn story crisis.",
      actionHint: "Finish the Seafloor Cavern room 9 story scene after the Maxie battle.",
      steps: ["Reach Seafloor Cavern room 9.", "Finish the Maxie story battle.", "Watch Groudon leave the cavern."],
      prerequisites: ["FLAG_LEGENDARIES_IN_SOOTOPOLIS"],
      sourceRefs: [POKEEMERALD_SEAFLOOR],
    },
  },
  "emerald-en": {
    ...EMERALD_WALLY_TEAMS,
    ...EMERALD_OPTIONAL_CONTEXT,
    FLAG_SYS_GAME_CLEAR: {
      description: "Permanent Pokemon League completion, set by GameClear when entering the Hall of Fame.",
      completionMeaning: "Set: the League has been completed and Hall of Fame entry is recorded.",
      notCompletedMeaning: "Not set: permanent League completion is not recorded by this flag.",
      steps: [],
      sourceRefs: [
        "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/src/post_battle_event_funcs.c",
        "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/scripts/hall_of_fame.inc",
      ],
    },
    FLAG_LEGENDARIES_IN_SOOTOPOLIS: {
      description: "Resettable Sootopolis crisis-scene state, set at Seafloor Cavern and cleared after Rayquaza ends the crisis.",
      completionMeaning: "Set: the crisis scene is active, not permanently completed.",
      notCompletedMeaning: "Not set: the scene is inactive, either before it starts or after it ends.",
      normalMissingReason: "The script clears this bit after resolving the crisis. It is not a permanent prerequisite for earlier completed events.",
      steps: [],
      sourceRefs: [POKEEMERALD_SEAFLOOR, emeraldScript("SootopolisCity")],
    },
    ...hoennLeagueRunGuidance("pokeemerald", "0d3100185e0b13faabfc589fc402dd46f83c1d6a", "FLAG_DEFEATED_ELITE_4_SIDNEY"),
    GUIDE_MIRAGE_TOWER: {
      description: "Mirage Tower is an Emerald-only optional location in the Route 111 desert.",
      actionHint: "Bring the Mach Bike and a Pokemon that can use Rock Smash, then cross the cracked floors at speed and climb to 4F.",
      steps: [
        "Travel to the Route 111 desert in Pokemon Emerald; Mirage Tower can disappear and reappear when entering and leaving the route.",
        "Use the Mach Bike to cross cracked floor tiles before they collapse.",
        "Use Rock Smash on the breakable rocks blocking the route upward.",
        "Reach 4F and choose either the Root Fossil or the Claw Fossil.",
        "The Root Fossil is revived into Lileep; the Claw Fossil is revived into Anorith.",
        "After one Fossil is taken, the tower collapses. The other Fossil becomes available later in Desert Underpass after the main game and National Pokedex.",
      ],
      normalMissingReason: "Mirage Tower exists in Pokemon Emerald, not in Ruby or Sapphire.",
      sourceRefs: [POKEEMERALD_MIRAGE_TOWER, BULBAPEDIA_MIRAGE_TOWER],
    },
    FLAG_CHOSE_ROOT_FOSSIL: {
      description: "The Root Fossil was chosen from Mirage Tower.",
      actionHint: "Choose the Root Fossil at the top of Mirage Tower.",
      steps: ["Reach Mirage Tower 4F.", "Choose the Root Fossil."],
      mutuallyExclusiveWith: ["FLAG_CHOSE_CLAW_FOSSIL"],
      normalMissingReason: "The Root and Claw Fossils are a normal either/or choice.",
      sourceRefs: [POKEEMERALD_MIRAGE_TOWER],
    },
    FLAG_CHOSE_CLAW_FOSSIL: {
      description: "The Claw Fossil was chosen from Mirage Tower.",
      actionHint: "Choose the Claw Fossil at the top of Mirage Tower.",
      steps: ["Reach Mirage Tower 4F.", "Choose the Claw Fossil."],
      mutuallyExclusiveWith: ["FLAG_CHOSE_ROOT_FOSSIL"],
      normalMissingReason: "The Root and Claw Fossils are a normal either/or choice.",
      sourceRefs: [POKEEMERALD_MIRAGE_TOWER],
    },
    FLAG_KYOGRE_ESCAPED_SEAFLOOR_CAVERN: {
      description: "Kyogre has left Seafloor Cavern during Emerald's weather crisis.",
      actionHint: "Finish the Seafloor Cavern room 9 story scene; the script then moves the crisis to Sootopolis.",
      steps: ["Reach Seafloor Cavern room 9.", "Finish the story scene there.", "Let the weather crisis move to Sootopolis."],
      normalMissingReason: "The crisis-scene bit is cleared later in Sootopolis; it is not a permanent prerequisite for this recorded event.",
      sourceRefs: [POKEEMERALD_SEAFLOOR, emeraldScript("SootopolisCity")],
    },
    FLAG_GROUDON_ESCAPED_SEAFLOOR_CAVERN: {
      description: "Groudon has left Seafloor Cavern during Emerald's weather crisis.",
      actionHint: "Finish the Seafloor Cavern room 9 story scene; the weather crisis continues in Sootopolis.",
      steps: ["Reach Seafloor Cavern room 9.", "Finish the story scene there.", "Let the weather crisis move to Sootopolis."],
      normalMissingReason: "The crisis-scene bit is cleared later in Sootopolis; it is not a permanent prerequisite for this recorded event.",
      sourceRefs: [POKEEMERALD_SEAFLOOR, emeraldScript("SootopolisCity")],
    },
  },
  "firered-leafgreen-en": {
    FLAG_GOT_DOME_FOSSIL: {
      description: "The Dome Fossil was chosen in Mt. Moon.",
      actionHint: "Choose the Dome Fossil after the Super Nerd battle in Mt. Moon B2F.",
      steps: ["Beat the Super Nerd in Mt. Moon B2F.", "Choose the Dome Fossil."],
      mutuallyExclusiveWith: ["FLAG_GOT_HELIX_FOSSIL"],
      normalMissingReason: "The Dome and Helix Fossils are a normal either/or choice.",
      sourceRefs: [POKEFIRERED_MT_MOON],
    },
    FLAG_GOT_HELIX_FOSSIL: {
      description: "The Helix Fossil was chosen in Mt. Moon.",
      actionHint: "Choose the Helix Fossil after the Super Nerd battle in Mt. Moon B2F.",
      steps: ["Beat the Super Nerd in Mt. Moon B2F.", "Choose the Helix Fossil."],
      mutuallyExclusiveWith: ["FLAG_GOT_DOME_FOSSIL"],
      normalMissingReason: "The Dome and Helix Fossils are a normal either/or choice.",
      sourceRefs: [POKEFIRERED_MT_MOON],
    },
    FLAG_GOT_HITMONCHAN: {
      description: "Hitmonchan was chosen as the Fighting Dojo reward.",
      actionHint: "Choose Hitmonchan as the Fighting Dojo reward.",
      steps: ["Clear the Saffron Fighting Dojo.", "Choose Hitmonchan as the reward."],
      mutuallyExclusiveWith: ["FLAG_GOT_HITMONLEE"],
      normalMissingReason: "The Dojo reward is a normal either/or choice.",
      sourceRefs: [POKEFIRERED_DOJO],
    },
    FLAG_GOT_HITMONLEE: {
      description: "Hitmonlee was chosen as the Fighting Dojo reward.",
      actionHint: "Choose Hitmonlee as the Fighting Dojo reward.",
      steps: ["Clear the Saffron Fighting Dojo.", "Choose Hitmonlee as the reward."],
      mutuallyExclusiveWith: ["FLAG_GOT_HITMONCHAN"],
      normalMissingReason: "The Dojo reward is a normal either/or choice.",
      sourceRefs: [POKEFIRERED_DOJO],
    },
    FLAG_GOT_MASTER_BALL_FROM_SILPH: {
      description: "The Silph president has given the Master Ball reward.",
      actionHint: "After clearing Giovanni from Silph Co. 11F, talk to the president and accept the Master Ball.",
      steps: ["Clear the Silph Co. Giovanni battle.", "Talk to the president on 11F.", "Accept the Master Ball."],
      sourceRefs: [POKEFIRERED_SILPH],
    },
    FLAG_HIDE_SAFFRON_ROCKETS: {
      description: "Saffron's Rocket occupation has been cleared from the map state.",
      actionHint: "This is a visibility flag: after the Silph Co. Giovanni battle, Rockets are hidden and civilians return.",
      steps: ["Clear the Silph Co. Giovanni battle.", "Let the Saffron map scripts hide the Rocket NPCs."],
      sourceRefs: [POKEFIRERED_SILPH],
    },
  },
};

export function getEventGuidance(gameProfile: string, key: string): EventGuidance | undefined {
  if (gameProfile === "emerald-en" && /^FLAG_(REGISTERED_|DAILY_|MYSTERY_GIFT_)/.test(key)) {
    const daily = key.startsWith("FLAG_DAILY_");
    const registered = key.startsWith("FLAG_REGISTERED_");
    const base = "https://github.com/pret/pokeemerald/blob/0d3100185e0b13faabfc589fc402dd46f83c1d6a/";
    return {
      description: daily ? "Resettable daily state, not lifetime activity completion."
        : registered ? "Trainer registration state, not a victory or current rematch-readiness flag."
          : "Internal Mystery Gift state; specific gameplay meaning is unresolved.",
      completionMeaning: "Set: this technical state bit is active; it is not counted as a completed quest.",
      notCompletedMeaning: daily ? "Not set: inactive in the current daily period; the activity may have been completed on a previous day."
        : "Not set: this internal state is inactive. It does not establish an unfinished quest.",
      steps: [],
      sourceRefs: [base + "include/constants/flags.h", base + (registered ? "src/battle_setup.c" : "src/event_data.c"),
        ...(registered ? [base + "include/constants/rematches.h", base + "src/pokenav_match_call_data.c"] : [])],
    };
  }
  return EVENT_GUIDANCE_BY_PROFILE[gameProfile]?.[key];
}
