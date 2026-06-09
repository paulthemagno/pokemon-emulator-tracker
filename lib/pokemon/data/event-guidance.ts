export interface EventGuidance {
  description?: string;
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
      prerequisites: ["FLAG_LEGENDARIES_IN_SOOTOPOLIS"],
      sourceRefs: [POKEEMERALD_SEAFLOOR],
    },
    FLAG_GROUDON_ESCAPED_SEAFLOOR_CAVERN: {
      description: "Groudon has left Seafloor Cavern during Emerald's weather crisis.",
      actionHint: "Finish the Seafloor Cavern room 9 story scene; the weather crisis continues in Sootopolis.",
      steps: ["Reach Seafloor Cavern room 9.", "Finish the story scene there.", "Let the weather crisis move to Sootopolis."],
      prerequisites: ["FLAG_LEGENDARIES_IN_SOOTOPOLIS"],
      sourceRefs: [POKEEMERALD_SEAFLOOR],
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
  return EVENT_GUIDANCE_BY_PROFILE[gameProfile]?.[key];
}
