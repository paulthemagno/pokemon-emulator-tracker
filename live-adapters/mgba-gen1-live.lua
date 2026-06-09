-- Pokemon Emulator Tracker live adapter for mGBA + Pokemon Gen 1 (Red/Blue/Yellow).
-- Load in mGBA: Tools -> Scripting... -> Load Script.
-- Then press "Start Live" in the web UI. The adapter serves http://127.0.0.1:8080/snapshot.

local PORT = 8080
local HOST = "127.0.0.1"

local NAME_SIZE = 11
local PARTY_MON_SIZE = 44
local BOX_MON_SIZE = 33
local BOX_RECORD_SIZE = 0x462
local BOX_CAPACITY = 20
local GEN1_NUM_SPECIES = 151
local POKEDEX_FLAG_BYTES = math.floor((GEN1_NUM_SPECIES + 7) / 8)
local SNAPSHOT_REFRESH_SECONDS = 0.25

local OFFSET_PROFILES = nil

local GEN1_INDEX_TO_NATIONAL = {
  [0x01] = 112, [0x02] = 115, [0x03] = 32, [0x04] = 35, [0x05] = 21,
  [0x06] = 100, [0x07] = 34, [0x08] = 80, [0x09] = 2, [0x0a] = 103,
  [0x0b] = 108, [0x0c] = 102, [0x0d] = 88, [0x0e] = 94, [0x0f] = 29,
  [0x10] = 31, [0x11] = 104, [0x12] = 111, [0x13] = 131, [0x14] = 59,
  [0x15] = 151, [0x16] = 130, [0x17] = 90, [0x18] = 72, [0x19] = 92,
  [0x1a] = 123, [0x1b] = 120, [0x1c] = 9, [0x1d] = 127, [0x1e] = 114,
  [0x21] = 58, [0x22] = 95, [0x23] = 22, [0x24] = 16, [0x25] = 79,
  [0x26] = 64, [0x27] = 75, [0x28] = 113, [0x29] = 67, [0x2a] = 122,
  [0x2b] = 106, [0x2c] = 107, [0x2d] = 24, [0x2e] = 47, [0x2f] = 54,
  [0x30] = 96, [0x31] = 76, [0x33] = 126, [0x35] = 125, [0x36] = 82,
  [0x37] = 109, [0x39] = 56, [0x3a] = 86, [0x3b] = 50, [0x3c] = 128,
  [0x40] = 83, [0x41] = 48, [0x42] = 149, [0x46] = 84, [0x47] = 60,
  [0x48] = 124, [0x49] = 146, [0x4a] = 144, [0x4b] = 145, [0x4c] = 132,
  [0x4d] = 52, [0x4e] = 98, [0x52] = 37, [0x53] = 38, [0x54] = 25,
  [0x55] = 26, [0x58] = 147, [0x59] = 148, [0x5a] = 140, [0x5b] = 141,
  [0x5c] = 116, [0x5d] = 117, [0x60] = 27, [0x61] = 28, [0x62] = 138,
  [0x63] = 139, [0x64] = 39, [0x65] = 40, [0x66] = 133, [0x67] = 136,
  [0x68] = 135, [0x69] = 134, [0x6a] = 66, [0x6b] = 41, [0x6c] = 23,
  [0x6d] = 46, [0x6e] = 61, [0x6f] = 62, [0x70] = 13, [0x71] = 14,
  [0x72] = 15, [0x74] = 85, [0x75] = 57, [0x76] = 51, [0x77] = 49,
  [0x78] = 87, [0x7b] = 10, [0x7c] = 11, [0x7d] = 12, [0x7e] = 68,
  [0x80] = 55, [0x81] = 97, [0x82] = 42, [0x83] = 150, [0x84] = 143,
  [0x85] = 129, [0x88] = 89, [0x8a] = 99, [0x8b] = 91, [0x8d] = 101,
  [0x8e] = 36, [0x8f] = 110, [0x90] = 53, [0x91] = 105, [0x93] = 93,
  [0x94] = 63, [0x95] = 65, [0x96] = 17, [0x97] = 18, [0x98] = 121,
  [0x99] = 1, [0x9a] = 3, [0x9b] = 73, [0x9d] = 118, [0x9e] = 119,
  [0xa3] = 77, [0xa4] = 78, [0xa5] = 19, [0xa6] = 20, [0xa7] = 33,
  [0xa8] = 30, [0xa9] = 74, [0xaa] = 137, [0xab] = 142, [0xad] = 81,
  [0xb0] = 4, [0xb1] = 7, [0xb2] = 5, [0xb3] = 8, [0xb4] = 6,
  [0xb9] = 43, [0xba] = 44, [0xbb] = 45, [0xbc] = 69, [0xbd] = 70,
  [0xbe] = 71,
}

local GB_CHARS = {
  [0x7f] = " ", [0x80] = "A", [0x81] = "B", [0x82] = "C", [0x83] = "D",
  [0x84] = "E", [0x85] = "F", [0x86] = "G", [0x87] = "H", [0x88] = "I",
  [0x89] = "J", [0x8a] = "K", [0x8b] = "L", [0x8c] = "M", [0x8d] = "N",
  [0x8e] = "O", [0x8f] = "P", [0x90] = "Q", [0x91] = "R", [0x92] = "S",
  [0x93] = "T", [0x94] = "U", [0x95] = "V", [0x96] = "W", [0x97] = "X",
  [0x98] = "Y", [0x99] = "Z", [0xa0] = "a", [0xa1] = "b", [0xa2] = "c",
  [0xa3] = "d", [0xa4] = "e", [0xa5] = "f", [0xa6] = "g", [0xa7] = "h",
  [0xa8] = "i", [0xa9] = "j", [0xaa] = "k", [0xab] = "l", [0xac] = "m",
  [0xad] = "n", [0xae] = "o", [0xaf] = "p", [0xb0] = "q", [0xb1] = "r",
  [0xb2] = "s", [0xb3] = "t", [0xb4] = "u", [0xb5] = "v", [0xb6] = "w",
  [0xb7] = "x", [0xb8] = "y", [0xb9] = "z",
  [0xf6] = "0", [0xf7] = "1", [0xf8] = "2", [0xf9] = "3", [0xfa] = "4",
  [0xfb] = "5", [0xfc] = "6", [0xfd] = "7", [0xfe] = "8", [0xff] = "9",
  [0xe0] = "'", [0xe3] = "-", [0xe6] = "?", [0xe7] = "!", [0xe8] = ".",
  [0xe9] = "&",
}

local server = nil
local wram = nil
local sram = nil
local activeOffsetProfile = nil
local detectedGame = nil
local detectedRomTitle = nil
local lastSramHealth = "unknown"
local sramReadMode = "domain"
local sramBoxShift = 0
local sramAccessMode = "domain-linear"
local lastBoxRawCounts = {}
local lastBoxLayoutScore = 0
local lastCurrentBoxRawCount = 0
local lastCurrentBoxTerminator = false
local lastCurrentBoxDataOffset = 0
local lastCurrentBoxScanScore = 0
local lastRequestTarget = ""
local cachedSnapshotData = nil
local cachedSnapshotBody = nil
local cachedSnapshotAt = 0
local debugSnapshotDumped = false
-- Snapshot dump mode:
--   "once"   -> write one file per script load
--   "always" -> overwrite on every request
--   "off"    -> never auto-write (default)
-- Query override on /snapshot:
--   ?dump=1      force one write now
--   ?dump=always enable per-request writes for this response
--   ?dump=off    disable write for this response
local DEBUG_SNAPSHOT_MODE = "off"
local get_offset_profile

local function log(message)
  if console and console.log then
    local ok = pcall(console.log, message)
    if ok then return end
  end
  pcall(print, message)
end

local function call_if_exists(target, method, value)
  if target and target[method] then
    local fn = target[method]
    local ok, result = pcall(fn, target, value)
    if ok then return result end
  end
  return nil
end

local function now_seconds()
  if os and os.clock then return os.clock() end
  return 0
end

local function script_directory()
  local info = debug and debug.getinfo and debug.getinfo(1, "S")
  if info and type(info.source) == "string" and info.source:sub(1, 1) == "@" then
    local path = info.source:sub(2)
    local directory = path:match("^(.*[/\\])")
    if directory then return directory end
  end
  return ""
end

local generatedOffsets = dofile(script_directory() .. "generated/gen1-live-offsets.lua")
OFFSET_PROFILES = generatedOffsets.profiles

local function temp_directory()
  local tmp = os and os.getenv and os.getenv("TMPDIR")
  if tmp and #tmp > 0 then
    if tmp:sub(-1) ~= "/" and tmp:sub(-1) ~= "\\" then
      tmp = tmp .. "/"
    end
    return tmp
  end
  return "/tmp/"
end

local DEBUG_SNAPSHOT_PATH = temp_directory() .. "pokemon-emulator-tracker-gen1-live-snapshot.json"

local function get_wram()
  if wram then return wram end
  if emu and emu.memory and emu.memory.wram then
    wram = emu.memory.wram
  end
  return wram
end

local function get_sram()
  if sram then return sram end
  if emu and emu.memory and emu.memory.sram then
    sram = emu.memory.sram
  end
  return sram
end

local function read8(address)
  if emu and emu.read8 then
    local ok, value = pcall(function() return emu:read8(address) end)
    if ok and value ~= nil then return value end
  end

  local memory = get_wram()
  if memory then
    local offset = address >= 0xc000 and address - 0xc000 or address
    local ok, value = pcall(function() return memory:read8(address) end)
    if ok and value ~= nil then return value end

    ok, value = pcall(function() return memory:read8(offset) end)
    if ok and value ~= nil then return value end
  end

  return 0
end

local function read_sram_domain_offset8(offset)
  if offset < 0 then return 0 end
  local memory = get_sram()
  if not memory then return 0 end
  local ok, value = pcall(function() return memory:read8(offset) end)
  return ok and value or 0
end

local function read_sram_offset8(offset)
  return read_sram_domain_offset8(offset)
end

local function get_sram_size()
  local memory = get_sram()
  if not memory or not memory.size then return 0 end
  local ok, value = pcall(function() return memory:size() end)
  return ok and value or 0
end

local function read_sram_box_offset8(offset)
  return read_sram_offset8(offset + sramBoxShift)
end

local function read_sram_name(offset)
  local result = ""
  for i = 0, NAME_SIZE - 1 do
    local byte = read_sram_offset8(offset + i)
    if byte == 0x50 or byte == 0x00 then break end
    result = result .. (GB_CHARS[byte] or "")
  end
  return result
end

local function read_sram_box_name(offset)
  local result = ""
  for i = 0, NAME_SIZE - 1 do
    local byte = read_sram_box_offset8(offset + i)
    if byte == 0x50 or byte == 0x00 then break end
    result = result .. (GB_CHARS[byte] or "")
  end
  return result
end

local function ensure_sram_ready()
  if not get_sram() then
    lastSramHealth = "unavailable"
    return false
  end

  lastSramHealth = "ready"
  return true
end

local function score_box_layout_shift(offsets, shift, reader)
  local score = 0
  for _, offset in ipairs(offsets.boxOffsets or {}) do
    local shifted = offset + shift
    local count = reader(shifted)
    local terminator = count <= BOX_CAPACITY and reader(shifted + 1 + count) or 0
    if count > 0 and count <= BOX_CAPACITY and terminator == 0xff then
      score = score + 10 + count
    elseif count == 0 and terminator == 0xff then
      score = score + 2
    end
  end
  return score
end

local function select_sram_box_shift()
  local offsets = get_offset_profile()
  local candidates = { 0, -0x4000, -0x6000 }
  local bestShift = 0
  local bestScore = -1
  local bestMode = "domain-linear"
  for _, shift in ipairs(candidates) do
    local score = score_box_layout_shift(offsets, shift, read_sram_domain_offset8)
    if score > bestScore then
      bestScore = score
      bestShift = shift
      bestMode = "domain-linear"
    end
  end
  sramBoxShift = bestShift
  sramAccessMode = bestMode
  sramReadMode = bestMode
  lastBoxLayoutScore = bestScore
end

local function read16be(address)
  return read8(address) * 0x100 + read8(address + 1)
end

local function bit_is_set(value, index)
  return math.floor(value / (2 ^ index)) % 2 == 1
end

local function low_bits(value, mask)
  return value % (mask + 1)
end

local function is_valid_name(value)
  return value ~= nil and #value > 0 and #value <= NAME_SIZE and value:match("^[%w %-%._'!?&]+$") ~= nil
end

local function is_valid_bcd_byte(value)
  return math.floor(value / 16) <= 9 and value % 16 <= 9
end

local function read_bcd3(address)
  if not is_valid_bcd_byte(read8(address))
    or not is_valid_bcd_byte(read8(address + 1))
    or not is_valid_bcd_byte(read8(address + 2)) then
    return 0
  end

  local result = 0
  for i = 0, 2 do
    local value = read8(address + i)
    result = result * 100 + (math.floor(value / 16) * 10) + (value % 16)
  end
  return result
end

local function read_name(address)
  local result = ""
  for i = 0, NAME_SIZE - 1 do
    local byte = read8(address + i)
    if byte == 0x50 or byte == 0x00 then break end
    result = result .. (GB_CHARS[byte] or "")
  end
  return result
end

local function escape_json(value)
  return tostring(value):gsub("\\", "\\\\"):gsub('"', '\\"'):gsub("\n", "\\n")
end

local function json(value)
  local valueType = type(value)
  if valueType == "nil" then return "null" end
  if valueType == "boolean" or valueType == "number" then return tostring(value) end
  if valueType == "string" then return '"' .. escape_json(value) .. '"' end
  if valueType == "table" then
    local isArray = true
    local maxIndex = 0
    for key in pairs(value) do
      if type(key) ~= "number" then isArray = false break end
      if key > maxIndex then maxIndex = key end
    end
    local parts = {}
    if isArray then
      for i = 1, maxIndex do table.insert(parts, json(value[i])) end
      return "[" .. table.concat(parts, ",") .. "]"
    end
    for key, item in pairs(value) do
      table.insert(parts, json(tostring(key)) .. ":" .. json(item))
    end
    return "{" .. table.concat(parts, ",") .. "}"
  end
  return "null"
end

local function error_json(message)
  return '{"success":false,"error":' .. json(tostring(message)) .. '}'
end

local function write_text_file(path, contents)
  local file, openErr = io.open(path, "w")
  if not file then
    return false, openErr
  end

  local ok, writeErr = pcall(function()
    file:write(contents)
    file:flush()
    file:close()
  end)

  if not ok then
    pcall(function() file:close() end)
    return false, writeErr
  end

  return true
end

local function should_dump_snapshot(override)
  local mode = override or DEBUG_SNAPSHOT_MODE
  if mode == "force" then return true end
  if mode == "always" then return true end
  if mode == "off" then return false end
  if mode == "once" then return not debugSnapshotDumped end
  return false
end

local function read_rom_title()
  if detectedRomTitle ~= nil then return detectedRomTitle end
  local chars = {}
  if emu and emu.read8 then
    for address = 0x0134, 0x0143 do
      local ok, value = pcall(function() return emu:read8(address) end)
      if not ok or not value or value == 0 then break end
      if value >= 32 and value <= 126 then table.insert(chars, string.char(value)) end
    end
  end
  detectedRomTitle = table.concat(chars):gsub("%s+$", "")
  return detectedRomTitle
end

local function game_from_rom_title(title)
  local upper = string.upper(title or "")
  if upper:find("YELLOW", 1, true) or upper:find("YEL", 1, true) then return "yellow" end
  if upper:find("BLUE", 1, true) or upper:find("BLU", 1, true) then return "blue" end
  if upper:find("RED", 1, true) then return "red" end
  return nil
end

local function score_profile(profile)
  local score = 0
  local partyCount = read8(profile.partyCount)
  if partyCount >= 0 and partyCount <= 6 then score = score + 4 else score = score - 8 end
  if partyCount > 0 then
    local species = read8(profile.partyData)
    if GEN1_INDEX_TO_NATIONAL[species] then score = score + 3 else score = score - 3 end
  end
  local name = read_name(profile.playerName)
  if is_valid_name(name) then score = score + 2 else score = score - 2 end
  local money = read_bcd3(profile.money)
  if money >= 0 and money <= 999999 then score = score + 2 else score = score - 2 end
  return score
end

function get_offset_profile()
  if activeOffsetProfile then return activeOffsetProfile end
  local title = read_rom_title()
  local game = game_from_rom_title(title)
  detectedGame = game

  if game == "yellow" then
    activeOffsetProfile = OFFSET_PROFILES.yellow
  elseif game == "red" or game == "blue" then
    activeOffsetProfile = OFFSET_PROFILES.red_blue
    activeOffsetProfile.game = game
  else
    local yellowScore = score_profile(OFFSET_PROFILES.yellow)
    local redBlueScore = score_profile(OFFSET_PROFILES.red_blue)
    activeOffsetProfile = yellowScore > redBlueScore and OFFSET_PROFILES.yellow or OFFSET_PROFILES.red_blue
    detectedGame = activeOffsetProfile.game
  end

  log("Detected Gen 1 profile: " .. activeOffsetProfile.key .. " (" .. (detectedGame or "unknown") .. ")"
    .. (title ~= "" and (" from ROM title " .. title) or ""))
  return activeOffsetProfile
end

local function get_game()
  local profile = get_offset_profile()
  return detectedGame or profile.game
end

local function read_badges(address)
  local byte = read8(address)
  local badges = {}
  for i = 0, 7 do
    table.insert(badges, bit_is_set(byte, i))
  end
  return badges
end

local function read_species_flags(address)
  local species = {}
  for national = 1, GEN1_NUM_SPECIES do
    local bitIndex = national - 1
    local byte = read8(address + math.floor(bitIndex / 8))
    if bit_is_set(byte, bitIndex % 8) then
      table.insert(species, national)
    end
  end
  return species
end

local function read_item_stack(address, countAddress, maxCount)
  local rawCount = read8(countAddress)
  if rawCount > maxCount then return {} end

  local count = math.min(rawCount, maxCount)
  local items = {}
  for index = 0, count - 1 do
    local itemId = read8(address + (index * 2))
    local quantity = read8(address + 1 + (index * 2))
    if itemId > 0 and itemId < 0xff and quantity > 0 then
      table.insert(items, { id = itemId, quantity = quantity })
    end
  end
  return items
end

local function read_pokemon_at(offset, nickname, originalTrainer, storage, expectedInternalSpecies)
  local isStoredBox = storage == "sram" or storage == "wram-box"
  local read = storage == "sram" and read_sram_box_offset8 or read8
  local internalSpecies = read(offset)
  if expectedInternalSpecies and expectedInternalSpecies ~= internalSpecies then return nil end

  local species = GEN1_INDEX_TO_NATIONAL[internalSpecies]
  if not species then return nil end

  local level = isStoredBox and read(offset + 3) or read(offset + 33)
  if level < 1 or level > 100 then return nil end

  local currentHP = read(offset + 1) * 0x100 + read(offset + 2)
  if currentHP > 999 then return nil end

  local moves = {}
  for i = 0, 3 do
    local moveId = read(offset + 8 + i)
    if moveId > 0 then
      table.insert(moves, { id = moveId, pp = low_bits(read(offset + 29 + i), 0x3f) })
    end
  end

  local maxHP = isStoredBox and 0 or read16be(offset + 34)
  local attack = isStoredBox and 0 or read16be(offset + 36)
  local defense = isStoredBox and 0 or read16be(offset + 38)
  local speed = isStoredBox and 0 or read16be(offset + 40)
  local special = isStoredBox and 0 or read16be(offset + 42)
  return {
    species = species,
    internalSpecies = internalSpecies,
    nickname = nickname,
    level = level,
    currentHP = currentHP,
    maxHP = maxHP,
    statusByte = read(offset + 4),
    experience = read(offset + 14) * 0x10000 + read(offset + 15) * 0x100 + read(offset + 16),
    originalTrainer = originalTrainer,
    originalTrainerID = read(offset + 12) * 0x100 + read(offset + 13),
    moves = moves,
    attack = attack,
    defense = defense,
    speed = speed,
    special = special,
  }
end

local function read_pc_box_record(offset, name, isCurrent)
  local count = read_sram_box_offset8(offset)
  if count > BOX_CAPACITY then return nil end
  if read_sram_box_offset8(offset + 1 + count) ~= 0xff then return nil end

  local pokemon = {}
  local pokemonDataOffset = offset + 0x16
  local otNamesOffset = offset + 0x2aa
  local nicknamesOffset = offset + 0x386

  for slot = 0, count - 1 do
    local species = read_sram_box_offset8(offset + 1 + slot)
    if species == 0 or species == 0xff then break end
    local mon = read_pokemon_at(
      pokemonDataOffset + slot * BOX_MON_SIZE,
      read_sram_box_name(nicknamesOffset + slot * NAME_SIZE),
      read_sram_box_name(otNamesOffset + slot * NAME_SIZE),
      "sram",
      species
    )
    if mon then table.insert(pokemon, mon) end
  end

  return {
    name = name,
    pokemon = pokemon,
    capacity = BOX_CAPACITY,
    isCurrent = isCurrent,
  }
end

local function read_party()
  local offsets = get_offset_profile()
  local count = math.min(read8(offsets.partyCount), 6)
  local party = {}
  for slot = 0, count - 1 do
    local mon = read_pokemon_at(
      offsets.partyData + slot * PARTY_MON_SIZE,
      read_name(offsets.partyNicknames + slot * NAME_SIZE),
      read_name(offsets.partyOtNames + slot * NAME_SIZE),
      "party"
    )
    if mon then table.insert(party, mon) end
  end
  return party
end

local function score_wram_box_candidate(offset)
  local count = read8(offset)
  if count > BOX_CAPACITY then return -1 end
  if read8(offset + 1 + count) ~= 0xff then return -1 end
  if count == 0 then return 1 end

  local score = 10 + count
  local pokemonDataOffset = offset + 0x16
  for slot = 0, count - 1 do
    local species = read8(offset + 1 + slot)
    if species == 0 or species == 0xff or not GEN1_INDEX_TO_NATIONAL[species] then return -1 end
    if read8(pokemonDataOffset + slot * BOX_MON_SIZE) ~= species then return -1 end
    local level = read8(pokemonDataOffset + slot * BOX_MON_SIZE + 3)
    if level < 1 or level > 100 then return -1 end
    score = score + 5
  end
  return score
end

local function find_wram_current_box_data_offset(defaultOffset)
  local bestOffset = defaultOffset
  local bestScore = score_wram_box_candidate(defaultOffset)

  for offset = 0xd000, 0xdeff - BOX_RECORD_SIZE do
    local score = score_wram_box_candidate(offset)
    if score > bestScore then
      bestScore = score
      bestOffset = offset
    end
  end

  lastCurrentBoxScanScore = bestScore
  return bestOffset
end

local function read_current_box_number()
  local offsets = get_offset_profile()
  local boxNumber = low_bits(read8(offsets.currentBoxNumber), 0x7f)
  if boxNumber < 0 or boxNumber >= 12 then return 0 end
  return boxNumber
end

local function read_current_pc_box(boxNumber)
  local offsets = get_offset_profile()
  local boxDataOffset = find_wram_current_box_data_offset(offsets.currentBoxData)
  local rawCount = read8(boxDataOffset)
  local count = rawCount <= BOX_CAPACITY and rawCount or 0
  local hasTerminator = read8(boxDataOffset + 1 + count) == 0xff
  lastCurrentBoxDataOffset = boxDataOffset
  lastCurrentBoxRawCount = rawCount
  lastCurrentBoxTerminator = hasTerminator
  if not hasTerminator then count = 0 end

  local pokemon = {}
  local pokemonDataOffset = boxDataOffset + 0x16
  local otNamesOffset = boxDataOffset + 0x2aa
  local nicknamesOffset = boxDataOffset + 0x386

  for slot = 0, count - 1 do
    local species = read8(boxDataOffset + 1 + slot)
    if species == 0 or species == 0xff then break end
    local mon = read_pokemon_at(
      pokemonDataOffset + slot * BOX_MON_SIZE,
      read_name(nicknamesOffset + slot * NAME_SIZE),
      read_name(otNamesOffset + slot * NAME_SIZE),
      "wram-box",
      species
    )
    if mon then table.insert(pokemon, mon) end
  end

  return {
    name = "Box " .. tostring(boxNumber + 1),
    pokemon = pokemon,
    capacity = BOX_CAPACITY,
    isCurrent = true,
  }
end

local function read_pc_boxes()
  local offsets = get_offset_profile()
  local currentBoxNumber = read_current_box_number()
  local boxes = {}
  local currentBox = read_current_pc_box(currentBoxNumber)
  local hasSram = ensure_sram_ready()
  if hasSram then
    select_sram_box_shift()
    if lastBoxLayoutScore <= 0 then
      lastSramHealth = "no-valid-box-records"
    end
  else
    lastBoxLayoutScore = 0
  end
  lastBoxRawCounts = {}
  for index = 1, 12 do
    local offset = offsets.boxOffsets and offsets.boxOffsets[index]
    local isCurrent = (index - 1) == currentBoxNumber
    local box = nil
    if offset then
      table.insert(lastBoxRawCounts, read_sram_box_offset8(offset))
    else
      table.insert(lastBoxRawCounts, -1)
    end
    if isCurrent then
      box = currentBox
    elseif hasSram and offset then
      box = read_pc_box_record(offset, "Box " .. tostring(index), false)
    end
    if not box then box = { name = "Box " .. tostring(index), pokemon = {}, capacity = BOX_CAPACITY, isCurrent = false } end
    box.name = "Box " .. tostring(index)
    box.isCurrent = isCurrent
    table.insert(boxes, box)
  end
  return boxes, currentBoxNumber
end

local function read_player()
  local offsets = get_offset_profile()
  return {
    name = read_name(offsets.playerName),
    id = read16be(offsets.trainerId),
    money = read_bcd3(offsets.money),
    badges = read_badges(offsets.badges),
    playTime = {
      hours = read8(offsets.playTimeHours),
      minutes = read8(offsets.playTimeMinutes),
      seconds = read8(offsets.playTimeSeconds),
    },
  }
end

local function read_pokedex()
  local offsets = get_offset_profile()
  local caught = read_species_flags(offsets.pokedexOwned)
  local seen = read_species_flags(offsets.pokedexSeen)
  return {
    caughtSpecies = caught,
    seenSpecies = seen,
    caughtCount = #caught,
    seenCount = #seen,
  }
end

local function read_event_bytes()
  local offsets = get_offset_profile()
  local bytes = {}
  local count = math.floor(((offsets.eventFlagCount or 0) + 7) / 8)
  for i = 0, count - 1 do
    bytes[#bytes + 1] = read8(offsets.eventFlags + i)
  end
  return {
    bytes = bytes,
  }
end

local function read_bag()
  local offsets = get_offset_profile()
  return {
    items = read_item_stack(offsets.items, offsets.numItems, 20),
    pcStorage = read_item_stack(offsets.pcItems, offsets.numPcItems, 50),
  }
end

local function read_location()
  local offsets = get_offset_profile()
  return {
    mapId = read8(offsets.currentMap),
    name = "Live",
  }
end

local function read_debug_bytes(reader, address, length)
  local values = {}
  for index = 0, length - 1 do
    table.insert(values, reader(address + index))
  end
  return values
end

local function summarize_box_candidate(label, source, address, reader)
  local count = reader(address)
  local terminator = count <= BOX_CAPACITY and reader(address + 1 + count) or -1
  return {
    label = label,
    source = source,
    address = address,
    count = count,
    terminator = terminator,
    header = read_debug_bytes(reader, address, 32),
    firstMon = read_debug_bytes(reader, address + 0x16, BOX_MON_SIZE),
  }
end

local function build_box_debug()
  local offsets = get_offset_profile()
  local candidates = {}
  local currentBoxNumber = low_bits(read8(offsets.currentBoxNumber), 0x7f)

  table.insert(candidates, summarize_box_candidate("profile currentBoxData", "wram", offsets.currentBoxData, read8))
  table.insert(candidates, summarize_box_candidate("redBlue wBoxDataStart", "wram", 0xda67, read8))
  table.insert(candidates, summarize_box_candidate("yellow wBoxDataStart", "wram", 0xda94, read8))
  table.insert(candidates, summarize_box_candidate("old generated currentBoxData", "wram", 0xde14, read8))
  table.insert(candidates, summarize_box_candidate("save current box offset", "sram", 0x30c0, read_sram_offset8))
  table.insert(candidates, summarize_box_candidate("save box 1", "sram", 0x4000, read_sram_offset8))
  table.insert(candidates, summarize_box_candidate("save box 2", "sram", 0x4462, read_sram_offset8))
  table.insert(candidates, summarize_box_candidate("save box 7", "sram", 0x6000, read_sram_offset8))
  return {
    generation = 1,
    adapter = "mgba-gen1-live",
    game = get_game(),
    profile = offsets.key,
    romTitle = detectedRomTitle,
    currentBoxNumber = currentBoxNumber,
    currentBoxNumberRaw = read8(offsets.currentBoxNumber),
    sram = get_sram() ~= nil,
    sramSize = get_sram_size(),
    candidates = candidates,
  }
end

local function build_snapshot()
  local offsets = get_offset_profile()
  local pcBoxes, currentBoxNumber = read_pc_boxes()
  local pcPokemonCount = 0
  for _, box in ipairs(pcBoxes) do
    pcPokemonCount = pcPokemonCount + #box.pokemon
  end
  return {
    generation = 1,
    game = get_game(),
    status = {
      emulator = "mGBA",
      adapter = "mgba-gen1-live",
      profile = offsets.key,
      game = get_game(),
      romTitle = detectedRomTitle,
      ok = get_wram() ~= nil,
      sram = get_sram() ~= nil,
      sramSize = get_sram_size(),
      sramHealth = lastSramHealth,
      sramReadMode = sramReadMode,
      lastRequestTarget = lastRequestTarget,
      sramBoxShift = sramBoxShift,
      sramBoxLayoutScore = lastBoxLayoutScore,
      boxRawCounts = lastBoxRawCounts,
      currentBoxDataOffset = lastCurrentBoxDataOffset,
      currentBoxScanScore = lastCurrentBoxScanScore,
      currentBoxRawCount = lastCurrentBoxRawCount,
      currentBoxTerminator = lastCurrentBoxTerminator,
      currentPcBoxPokemon = #(pcBoxes[currentBoxNumber + 1] and pcBoxes[currentBoxNumber + 1].pokemon or {}),
      pcBoxes = #pcBoxes,
      pcBoxPokemon = pcPokemonCount,
    },
    player = read_player(),
    pokedex = read_pokedex(),
    eventsRaw = read_event_bytes(),
    party = read_party(),
    pcBoxes = pcBoxes,
    bag = read_bag(),
    location = read_location(),
  }
end

local function refresh_snapshot_cache(force)
  local currentTime = now_seconds()
  if not force and cachedSnapshotBody and (currentTime - cachedSnapshotAt) < SNAPSHOT_REFRESH_SECONDS then
    return cachedSnapshotData, cachedSnapshotBody
  end

  local data = build_snapshot()
  local body = json(data)
  cachedSnapshotData = data
  cachedSnapshotBody = body
  cachedSnapshotAt = currentTime

  return data, body
end

local function snapshot_json(dumpOverride)
  local _, body = refresh_snapshot_cache(dumpOverride == "force" or dumpOverride == "always")
  if should_dump_snapshot(dumpOverride) then
    local ok, err = write_text_file(DEBUG_SNAPSHOT_PATH, body)
    if ok then
      debugSnapshotDumped = true
      log("Wrote Gen 1 live debug snapshot to " .. DEBUG_SNAPSHOT_PATH)
    else
      log("Failed to write Gen 1 live debug snapshot: " .. tostring(err))
    end
  end
  return body
end

local function read_request_target(client)
  local ok, line = pcall(function() return client:receive("*l") end)
  if not ok or not line then return "/snapshot" end
  local target = line:match("^%u+%s+([^%s]+)%s+HTTP/%d%.%d$") or line:match("^%u+%s+([^%s]+)")
  for _ = 1, 32 do
    local hOk, header = pcall(function() return client:receive("*l") end)
    if not hOk or not header or header == "" then break end
  end
  return target or "/snapshot"
end

local function parse_dump_override(target)
  if not target then return nil end
  local query = target:match("%?(.*)$")
  if not query then return nil end

  for pair in string.gmatch(query, "[^&]+") do
    local key, value = pair:match("^([^=]+)=?(.*)$")
    if key == "dump" then
      if value == "1" or value == "true" then return "force" end
      if value == "always" then return "always" end
      if value == "off" or value == "0" or value == "false" then return "off" end
    end
  end

  return nil
end

local function send(client, status, body)
  local response = "HTTP/1.1 " .. status .. "\r\n"
    .. "Content-Type: application/json\r\n"
    .. "Access-Control-Allow-Origin: *\r\n"
    .. "Connection: close\r\n"
    .. "Content-Length: " .. tostring(#body) .. "\r\n\r\n"
    .. body
  pcall(function() client:send(response) end)
end

local function close_client(client)
  pcall(function() client:close() end)
end

local function start_server()
  if not socket or not socket.tcp then
    error("Missing socket.tcp; mGBA build may not expose Lua socket APIs")
  end
  server = socket.tcp()
  call_if_exists(server, "settimeout", 0)
  call_if_exists(server, "setblocking", false)
  server:bind(HOST, PORT)
  server:listen(5)
  log("Pokemon Emulator Tracker mGBA Gen 1 adapter listening on http://" .. HOST .. ":" .. PORT)
end

local function poll_server()
  if not server then start_server() end
  local client = server:accept()
  if client then
    call_if_exists(client, "settimeout", 0.5)
    local target = read_request_target(client)
    lastRequestTarget = target or ""
    local dumpOverride = parse_dump_override(target)
    local ok, body = pcall(function()
      if target and target:find("debug") then
        return json(build_box_debug())
      end
      return snapshot_json(dumpOverride)
    end)
    if ok then
      send(client, "200 OK", body)
    else
      log("Snapshot error: " .. tostring(body))
      send(client, "500 Internal Server Error", error_json(body))
    end
    close_client(client)
  end
end

local ok, err = pcall(start_server)
if not ok then
  log("Adapter failed to start server: " .. tostring(err))
else
  if callbacks and callbacks.add then
    callbacks:add("frame", function()
      refresh_snapshot_cache(false)
      poll_server()
    end)
  else
    log("Adapter started server but callbacks:add is missing; polling will not run")
  end
end
