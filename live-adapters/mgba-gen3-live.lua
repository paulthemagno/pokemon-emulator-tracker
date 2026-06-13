-- Pokemon Emulator Tracker live adapter for mGBA + Pokemon Gen 3 (Ruby/Sapphire/Emerald/FireRed/LeafGreen).
-- Load in mGBA: Tools -> Scripting... -> Load Script.
-- Then press "Start Live" in the web UI. The adapter serves http://127.0.0.1:8080/snapshot.

local PORT = 8080
local HOST = "127.0.0.1"
local GEN3_NUM_SPECIES = 386
local GEN3_HOENN_DEX_COUNT = 202
local GEN3_KANTO_DEX_COUNT = 151
local RSE_NATIONAL_MAGIC = 0xDA
local DEX_MODE_NATIONAL = 1
local SNAPSHOT_REFRESH_SECONDS = 0.25
local HEAVY_SECTION_REFRESH_SECONDS = 1.25
local ADAPTER_REVISION = "gen3-story-context-2026-06-11"

local function script_directory()
  local info = debug and debug.getinfo and debug.getinfo(1, "S")
  if info and type(info.source) == "string" and info.source:sub(1, 1) == "@" then
    local path = info.source:sub(2)
    local directory = path:match("^(.*[/\\])")
    if directory then return directory end
  end
  return ""
end

local generated = dofile(script_directory() .. "generated/gen3-live-offsets.lua")
local profiles = generated.profiles

local function band(a, b)
  if bit32 and bit32.band then return bit32.band(a, b) end
  local result, bit = 0, 1
  a = math.floor(a)
  b = math.floor(b)
  while a > 0 or b > 0 do
    if (a % 2 == 1) and (b % 2 == 1) then result = result + bit end
    a = math.floor(a / 2)
    b = math.floor(b / 2)
    bit = bit * 2
  end
  return result
end

local function bxor(a, b)
  if bit32 and bit32.bxor then return bit32.bxor(a, b) end
  local result, bit = 0, 1
  a = math.floor(a)
  b = math.floor(b)
  while a > 0 or b > 0 do
    if (a % 2) ~= (b % 2) then result = result + bit end
    a = math.floor(a / 2)
    b = math.floor(b / 2)
    bit = bit * 2
  end
  return result
end

local function lshift(a, bits)
  if bit32 and bit32.lshift then return bit32.lshift(a, bits) end
  return math.floor(a * (2 ^ bits))
end

local function rshift(a, bits)
  if bit32 and bit32.rshift then return bit32.rshift(a, bits) end
  return math.floor(a / (2 ^ bits))
end

-- Western Gen 3 character codes from pret/pokeemerald charmap.txt.
local GEN3_CHARS = {
  [0x00] = " ", [0x2d] = "&", [0x2e] = "+", [0x35] = "=", [0x36] = ";",
  [0x5b] = "%", [0x5c] = "(", [0x5d] = ")", [0x85] = "<", [0x86] = ">",
  [0xa1] = "0", [0xa2] = "1", [0xa3] = "2", [0xa4] = "3", [0xa5] = "4",
  [0xa6] = "5", [0xa7] = "6", [0xa8] = "7", [0xa9] = "8", [0xaa] = "9",
  [0xab] = "!", [0xac] = "?", [0xad] = ".", [0xae] = "-", [0xaf] = ".",
  [0xb0] = "...", [0xb1] = "\"", [0xb2] = "\"", [0xb3] = "'", [0xb4] = "'",
  [0xb8] = ",", [0xb9] = "x", [0xba] = "/",
  [0xbb] = "A", [0xbc] = "B", [0xbd] = "C", [0xbe] = "D", [0xbf] = "E",
  [0xc0] = "F", [0xc1] = "G", [0xc2] = "H", [0xc3] = "I", [0xc4] = "J",
  [0xc5] = "K", [0xc6] = "L", [0xc7] = "M", [0xc8] = "N", [0xc9] = "O",
  [0xca] = "P", [0xcb] = "Q", [0xcc] = "R", [0xcd] = "S", [0xce] = "T",
  [0xcf] = "U", [0xd0] = "V", [0xd1] = "W", [0xd2] = "X", [0xd3] = "Y",
  [0xd4] = "Z", [0xd5] = "a", [0xd6] = "b", [0xd7] = "c", [0xd8] = "d",
  [0xd9] = "e", [0xda] = "f", [0xdb] = "g", [0xdc] = "h", [0xdd] = "i",
  [0xde] = "j", [0xdf] = "k", [0xe0] = "l", [0xe1] = "m", [0xe2] = "n",
  [0xe3] = "o", [0xe4] = "p", [0xe5] = "q", [0xe6] = "r", [0xe7] = "s",
  [0xe8] = "t", [0xe9] = "u", [0xea] = "v", [0xeb] = "w", [0xec] = "x",
  [0xed] = "y", [0xee] = "z", [0xf0] = ":",
}

local server = nil
local ewram = nil
local detectedRomTitle = nil
local detectedGame = nil
local activeProfile = nil
local blockCache = nil
local cachedSnapshotBody = nil
local cachedSnapshotAt = 0
local cachedHeavySections = nil
local cachedHeavySectionsAt = 0
local cachedHeavySectionsGame = nil
local lastPollAt = 0
local saveBlockScanCursorByProfile = {}
local saveBlockScanBestByProfile = {}
local runtimePointerAddressByProfile = {}
local storageScanCursorByProfile = {}
local storageScanBestByProfile = {}
local SAVEBLOCK_SCAN_CANDIDATES_PER_SNAPSHOT = 128
local STORAGE_SCAN_CANDIDATES_PER_SNAPSHOT = 32
local SERVER_POLL_SECONDS = 0.1
local STORAGE_DEBUG_SCAN_LIMIT = 12

local SUBSTRUCTURE_ORDERS = {
  {0, 1, 2, 3}, {0, 1, 3, 2}, {0, 2, 1, 3}, {0, 2, 3, 1},
  {0, 3, 1, 2}, {0, 3, 2, 1}, {1, 0, 2, 3}, {1, 0, 3, 2},
  {1, 2, 0, 3}, {1, 2, 3, 0}, {1, 3, 0, 2}, {1, 3, 2, 0},
  {2, 0, 1, 3}, {2, 0, 3, 1}, {2, 1, 0, 3}, {2, 1, 3, 0},
  {2, 3, 0, 1}, {2, 3, 1, 0}, {3, 0, 1, 2}, {3, 0, 2, 1},
  {3, 1, 0, 2}, {3, 1, 2, 0}, {3, 2, 0, 1}, {3, 2, 1, 0},
}

local function log(message)
  if console and console.log then
    local ok = pcall(console.log, message)
    if ok then return end
  end
  pcall(print, message)
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

local function get_ewram()
  if ewram then return ewram end
  if emu and emu.memory and emu.memory.wram then ewram = emu.memory.wram end
  return ewram
end

local function can_read_memory()
  return (emu and emu.read8) or get_ewram() ~= nil
end

local function read8(address)
  local ok, value

  if emu and emu.read8 then
    ok, value = pcall(function() return emu:read8(address) end)
    if ok and value ~= nil then return value end
  end

  local memory = get_ewram()
  if memory then
    local offset = address >= 0x02000000 and address - 0x02000000 or address
    ok, value = pcall(function() return memory:read8(offset) end)
    if ok and value ~= nil then return value end
  end

  return 0
end

local function read16(address)
  return read8(address) + read8(address + 1) * 0x100
end

local function read_s16(address)
  local value = read16(address)
  if value >= 0x8000 then return value - 0x10000 end
  return value
end

local function read32(address)
  return read16(address) + read16(address + 2) * 0x10000
end

local function decode_string(address, length)
  local parts = {}
  for i = 0, length - 1 do
    local byte = read8(address + i)
    if byte == 0xff or byte == 0x00 or byte == 0x50 then break end
    parts[#parts + 1] = GEN3_CHARS[byte] or "?"
  end
  return table.concat(parts)
end

local function get_rom_title()
  local title = ""
  if emu and emu.getGameTitle then
    local ok, value = pcall(function() return emu:getGameTitle() end)
    if ok and value then title = tostring(value) end
  end
  if title == "" then
    local chars = {}
    for i = 0, 11 do
      local b = 0
      if emu and emu.read8 then
        pcall(function() b = emu:read8(0x080000A0 + i) end)
      end
      if b >= 32 and b <= 126 then chars[#chars + 1] = string.char(b) end
    end
    title = table.concat(chars)
  end
  detectedRomTitle = title
  return title
end

local function get_game()
  local title = string.upper(get_rom_title())
  local previousGame = detectedGame
  if title:find("EMER") then detectedGame = "emerald"
  elseif title:find("SAPP") or title:find("AXP") then detectedGame = "sapphire"
  elseif title:find("RUBY") or title:find("AXV") then detectedGame = "ruby"
  elseif title:find("FIRE") or title:find("BPRE") or title:find("BPR") then detectedGame = "firered"
  elseif title:find("LEAF") or title:find("BPGE") or title:find("BPG") then detectedGame = "leafgreen"
  else detectedGame = "emerald" end
  if previousGame and previousGame ~= detectedGame then
    activeProfile = nil
    blockCache = nil
    cachedSnapshotBody = nil
    cachedHeavySections = nil
    cachedHeavySectionsAt = 0
    cachedHeavySectionsGame = nil
    saveBlockScanCursorByProfile = {}
    saveBlockScanBestByProfile = {}
    runtimePointerAddressByProfile = {}
    storageScanCursorByProfile = {}
    storageScanBestByProfile = {}
  end
  return detectedGame
end

local function get_profile()
  local game = get_game()
  local expectedKey = "ruby_sapphire"
  if game == "emerald" then expectedKey = "emerald" end
  if game == "firered" or game == "leafgreen" then expectedKey = "fire_red_leaf_green" end
  if activeProfile and activeProfile.key == expectedKey then return activeProfile end
  activeProfile = profiles[expectedKey]
  return activeProfile
end

local function is_printable_name(address, length)
  local seen = 0
  for i = 0, length - 1 do
    local b = read8(address + i)
    if b == 0xff or b == 0 then break end
    if GEN3_CHARS[b] == nil then return false end
    seen = seen + 1
  end
  return seen > 0
end

local function is_empty_record(address, size)
  return read32(address) == 0
end

local function score_saveblock2(base, p)
  local score = 0
  if is_printable_name(base + p.trainerName, 7) then score = score + 3 end
  local gender = read8(base + p.trainerGender)
  if gender == 0 or gender == 1 then score = score + 1 end
  local hours = read16(base + p.playTimeHours)
  local minutes = read8(base + p.playTimeMinutes)
  local seconds = read8(base + p.playTimeSeconds)
  local vblanks = p.playTimeVBlanks and read8(base + p.playTimeVBlanks) or 0
  if hours > 999 or minutes >= 60 or seconds >= 60 or vblanks >= 60 then return -1 end
  score = score + 3
  local magic = read8(base + p.pokedexNationalMagic)
  local nationalMagic = p.nationalMagic or RSE_NATIONAL_MAGIC
  if magic == 0 or magic == nationalMagic then score = score + 1 end
  return score
end

local function score_saveblock1(base, p, securityKey)
  local score = 0
  local partyCount = read8(base + p.partyCount)
  if partyCount <= 6 then score = score + 2 end
  local mapGroup = read8(base + p.locationMapGroup)
  local mapNum = read8(base + p.locationMapNum)
  local mapGroupCount = p.mapGroupCount or 40
  if mapGroup < mapGroupCount and mapNum < 128 then score = score + 2 end
  local money = read32(base + p.money)
  if p.quantityMask == "security-key-low16" then money = bxor(money, securityKey) end
  if money >= 0 and money <= 999999 then score = score + 1 end
  return score
end

local function scan_step(p)
  return 4
end

local function find_saveblock_incremental(p, name, size, minScore, scorer)
  local key = (p.key or "default") .. ":" .. name
  local step = scan_step(p)
  local cursor = saveBlockScanCursorByProfile[key] or p.ewramStart
  local best = saveBlockScanBestByProfile[key] or { base = nil, score = -1, complete = false }

  if best.complete then
    local currentScore = best.base and scorer(best.base) or -1
    if currentScore >= minScore then
      best.score = currentScore
      return best.base, "scan-complete:" .. tostring(currentScore)
    end
    cursor = p.ewramStart
    best = { base = nil, score = -1, complete = false }
    saveBlockScanCursorByProfile[key] = cursor
    saveBlockScanBestByProfile[key] = best
  end

  local scanned = 0
  local scanEnd = p.ewramEnd - size
  while cursor <= scanEnd and scanned < SAVEBLOCK_SCAN_CANDIDATES_PER_SNAPSHOT do
    local score = scorer(cursor)
    if score > best.score then
      best = { base = cursor, score = score, complete = false }
    end
    cursor = cursor + step
    scanned = scanned + 1
  end

  if cursor > scanEnd then
    best.complete = true
  end

  saveBlockScanCursorByProfile[key] = cursor
  saveBlockScanBestByProfile[key] = best

  if best.score >= minScore then
    return best.base, (best.complete and "scan-complete:" or "scan-progress:") .. tostring(best.score)
  end

  return nil, (best.complete and "scan-complete:" or "scan-progress:") .. tostring(best.score)
end

local function find_runtime_pointer(p, name, size, minScore, scorer, preferredAddress)
  local key = (p.key or "default") .. ":" .. name
  local cachedAddress = runtimePointerAddressByProfile[key]
  if cachedAddress then
    local base = read32(cachedAddress)
    if base >= p.ewramStart and base + size <= p.ewramEnd and scorer(base) >= minScore then
      return base, "runtime-pointer-scan"
    end
    runtimePointerAddressByProfile[key] = nil
  end

  if preferredAddress then
    local base = read32(preferredAddress)
    if base >= p.ewramStart and base + size <= p.ewramEnd and scorer(base) >= minScore then
      runtimePointerAddressByProfile[key] = preferredAddress
      return base, "runtime-pointer-adjacent"
    end
  end

  local bestAddress, bestBase, bestScore = nil, nil, -1
  for address = 0x03000000, 0x03007ffc, 4 do
    local base = read32(address)
    if base >= p.ewramStart and base + size <= p.ewramEnd then
      local score = scorer(base)
      if score > bestScore then
        bestAddress, bestBase, bestScore = address, base, score
      end
    end
  end
  if bestScore >= minScore then
    runtimePointerAddressByProfile[key] = bestAddress
    return bestBase, "runtime-pointer-scan"
  end
  return nil, "runtime-pointer-scan:" .. tostring(bestScore)
end

local function find_saveblock2(p)
  if type(p.saveBlock2Ptr) == "number" then
    local base = read32(p.saveBlock2Ptr)
    if base >= p.ewramStart and base + p.saveBlock2Size <= p.ewramEnd and score_saveblock2(base, p) >= 7 then
      runtimePointerAddressByProfile[(p.key or "default") .. ":saveBlock2"] = p.saveBlock2Ptr
      return base, "runtime-pointer"
    end
  end
  if type(p.saveBlock2) == "number" then return p.saveBlock2, "fixed" end
  local pointerBase, pointerMode = find_runtime_pointer(p, "saveBlock2", p.saveBlock2Size, 7, function(base)
    return score_saveblock2(base, p)
  end)
  if pointerBase then return pointerBase, pointerMode end
  return find_saveblock_incremental(p, "saveBlock2", p.saveBlock2Size, 7, function(base)
    return score_saveblock2(base, p)
  end)
end

local function find_saveblock1(p, securityKey)
  local scorer = function(base)
    return score_saveblock1(base, p, securityKey)
  end
  if type(p.saveBlock1Ptr) == "number" then
    local base = read32(p.saveBlock1Ptr)
    if base >= p.ewramStart and base + p.saveBlock1Size <= p.ewramEnd and scorer(base) >= 5 then
      runtimePointerAddressByProfile[(p.key or "default") .. ":saveBlock1"] = p.saveBlock1Ptr
      return base, "runtime-pointer"
    end
  end
  if type(p.saveBlock1) == "number" then return p.saveBlock1, "fixed" end
  local saveBlock2Pointer = runtimePointerAddressByProfile[(p.key or "default") .. ":saveBlock2"]
  local preferredAddress = saveBlock2Pointer and saveBlock2Pointer - 4 or nil
  local pointerBase, pointerMode = find_runtime_pointer(
    p,
    "saveBlock1",
    p.saveBlock1Size,
    5,
    scorer,
    preferredAddress
  )
  if pointerBase then return pointerBase, pointerMode end
  return find_saveblock_incremental(p, "saveBlock1", p.saveBlock1Size, 5, scorer)
end

local function checksum_box_pokemon(record)
  local sum = 0
  for offset = 0x20, 0x4e, 2 do
    sum = band(sum + record[offset + 1] + record[offset + 2] * 0x100, 0xffff)
  end
  return sum
end

local function read_record(address, size)
  local record = {}
  for i = 1, size do record[i] = read8(address + i - 1) end
  return record
end

local function u16(record, offset)
  return record[offset + 1] + record[offset + 2] * 0x100
end

local function u32(record, offset)
  return u16(record, offset) + u16(record, offset + 2) * 0x10000
end

local function decrypt_record(record)
  local pid = u32(record, 0x00)
  local otid = u32(record, 0x04)
  local key = bxor(pid, otid)
  local out = {}
  for i = 1, #record do out[i] = record[i] end
  for offset = 0x20, 0x4c, 4 do
    local value = bxor(u32(out, offset), key)
    out[offset + 1] = band(value, 0xff)
    out[offset + 2] = band(rshift(value, 8), 0xff)
    out[offset + 3] = band(rshift(value, 16), 0xff)
    out[offset + 4] = band(rshift(value, 24), 0xff)
  end
  return out
end

local function substructure_offset(pid, substructure)
  local order = SUBSTRUCTURE_ORDERS[(pid % 24) + 1]
  for index, value in ipairs(order) do
    if value == substructure then return 0x20 + (index - 1) * 12 end
  end
  return 0x20
end

local function national_species(internal)
  if internal >= generated.oldUnownInternalStart and internal <= generated.oldUnownInternalEnd then
    return generated.oldUnownNational
  end
  return generated.internalToNational[internal] or internal
end

local UNOWN_FORM_LABELS = {
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N",
  "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "!", "?",
}

local function gen3_unown_form(pid)
  local composite =
    band(rshift(band(pid, 0x03000000), 18), 0xff) +
    band(rshift(band(pid, 0x00030000), 12), 0xff) +
    band(rshift(band(pid, 0x00000300), 6), 0xff) +
    band(pid, 0x00000003)
  return composite % 28
end

local function parse_pokemon(address, size, isParty)
  local raw = read_record(address, size)
  local pid = u32(raw, 0x00)
  if pid == 0 then return nil end
  local flags = raw[0x13 + 1]
  if band(flags, 0x02) == 0 then return nil end
  local decrypted = decrypt_record(raw)
  if checksum_box_pokemon(decrypted) ~= u16(decrypted, 0x1c) then return nil end
  local growth = substructure_offset(pid, 0)
  local attacks = substructure_offset(pid, 1)
  local evs = substructure_offset(pid, 2)
  local misc = substructure_offset(pid, 3)
  local internal = u16(decrypted, growth)
  if internal == 0 or internal > 440 then return nil end
  local species = national_species(internal)
  local ivData = u32(decrypted, misc + 4)
  local isEgg = band(flags, 0x04) ~= 0 or band(rshift(ivData, 30), 0x01) ~= 0
  local form = nil
  local formName = nil
  if species == 201 then
    form = gen3_unown_form(pid)
    formName = UNOWN_FORM_LABELS[form + 1]
  end
  local mon = {
    species = species,
    internalSpecies = internal,
    isEgg = isEgg,
    form = form,
    formName = formName,
    nickname = decode_string(address + 0x08, 10),
    originalTrainer = decode_string(address + 0x14, 7),
    originalTrainerID = band(u32(decrypted, 0x04), 0xffff),
    experience = u32(decrypted, growth + 4),
    heldItem = u16(decrypted, growth + 2),
    happiness = decrypted[growth + 9 + 1],
    moves = {},
    ivs = {
      hp = band(ivData, 0x1f),
      attack = band(rshift(ivData, 5), 0x1f),
      defense = band(rshift(ivData, 10), 0x1f),
      speed = band(rshift(ivData, 15), 0x1f),
      specialAttack = band(rshift(ivData, 20), 0x1f),
      specialDefense = band(rshift(ivData, 25), 0x1f),
    },
    evs = {
      hp = decrypted[evs + 1],
      attack = decrypted[evs + 2],
      defense = decrypted[evs + 3],
      speed = decrypted[evs + 4],
      specialAttack = decrypted[evs + 5],
      specialDefense = decrypted[evs + 6],
    },
  }
  if mon.heldItem == 0 then mon.heldItem = nil end
  for i = 0, 3 do
    local moveId = u16(decrypted, attacks + i * 2)
    if moveId > 0 then mon.moves[#mon.moves + 1] = { id = moveId, pp = decrypted[attacks + 8 + i + 1] } end
  end
  if isParty and size >= 100 then
    mon.statusByte = u32(raw, 0x50)
    mon.level = raw[0x54 + 1]
    mon.currentHP = u16(raw, 0x56)
    mon.maxHP = u16(raw, 0x58)
    mon.attack = u16(raw, 0x5a)
    mon.defense = u16(raw, 0x5c)
    mon.speed = u16(raw, 0x5e)
    mon.specialAttack = u16(raw, 0x60)
    mon.specialDefense = u16(raw, 0x62)
  end
  return mon
end

local function score_storage_names(base, p)
  if read8(base + p.boxCurrent) >= p.pcBoxCount then return -1 end
  local names = 0
  for i = 0, p.pcBoxCount - 1 do
    if is_printable_name(base + p.boxNames + i * p.boxNameLength, p.boxNameLength) then names = names + 1 end
  end
  return names
end

local function score_storage_wallpapers(base, p)
  local valid = 0
  for i = 0, p.pcBoxCount - 1 do
    if read8(base + p.boxWallpapers + i) <= 15 then valid = valid + 1 end
  end
  return valid
end

local function score_storage_records(base, p)
  local valid, empty, invalid = 0, 0, 0
  local sampleCount = math.min(p.pcBoxCount * p.pcBoxCapacity, 30)
  for i = 0, sampleCount - 1 do
    local address = base + p.boxData + i * p.pcPokemonSize
    if is_empty_record(address, p.pcPokemonSize) then
      empty = empty + 1
    elseif parse_pokemon(address, p.pcPokemonSize, false) then
      valid = valid + 1
    else
      invalid = invalid + 1
    end
  end
  if valid == 0 then return -1 end
  if invalid > math.max(2, valid + empty) then return -1 end
  return valid * 4 + empty
end

local function score_storage(base, p)
  local names = score_storage_names(base, p)
  if names < 0 then return -1 end
  local wallpapers = score_storage_wallpapers(base, p)
  if wallpapers < p.pcBoxCount then return -1 end
  local records = score_storage_records(base, p)
  if records < 0 then return -1 end
  return records + names * 3 + wallpapers
end

local function find_storage_from_candidates(p)
  local candidates = p.pokemonStorageCandidates or {}
  local bestBase, bestScore = nil, -1
  for _, base in ipairs(candidates) do
    local score = score_storage(base, p)
    if score > bestScore then
      bestBase, bestScore = base, score
    end
    if score > 0 and read8(base + p.boxCurrent) < p.pcBoxCount then
      return base, "candidate-priority:" .. tostring(score)
    end
  end
  if bestScore >= p.pcBoxCount * 4 then
    return bestBase, "candidate:" .. tostring(bestScore)
  end
  return nil, "candidate:" .. tostring(bestScore)
end

local function sample_storage_records(base, p)
  local valid, empty, invalid = 0, 0, 0
  local samples = {}
  local sampleCount = math.min(p.pcBoxCount * p.pcBoxCapacity, 120)
  for i = 0, sampleCount - 1 do
    local address = base + p.boxData + i * p.pcPokemonSize
    if is_empty_record(address, p.pcPokemonSize) then
      empty = empty + 1
    else
      local mon = parse_pokemon(address, p.pcPokemonSize, false)
      if mon then
        valid = valid + 1
        if #samples < 5 then
          samples[#samples + 1] = { slot = i + 1, species = mon.species, nickname = mon.nickname }
        end
      else
        invalid = invalid + 1
      end
    end
  end
  return { valid = valid, empty = empty, invalid = invalid, samples = samples }
end

local function storage_debug_candidate(base, p)
  local names = score_storage_names(base, p)
  local wallpapers = score_storage_wallpapers(base, p)
  local records = sample_storage_records(base, p)
  return {
    base = string.format("0x%08x", base),
    currentBox = read8(base + p.boxCurrent),
    nameScore = names,
    wallpaperScore = wallpapers,
    recordValid = records.valid,
    recordEmpty = records.empty,
    recordInvalid = records.invalid,
    firstNames = {
      decode_string(base + p.boxNames, p.boxNameLength),
      decode_string(base + p.boxNames + p.boxNameLength, p.boxNameLength),
      decode_string(base + p.boxNames + p.boxNameLength * 2, p.boxNameLength),
    },
    samples = records.samples,
  }
end

local function insert_debug_candidate(results, candidate)
  results[#results + 1] = candidate
  table.sort(results, function(a, b)
    if a.recordValid ~= b.recordValid then return a.recordValid > b.recordValid end
    if a.nameScore ~= b.nameScore then return a.nameScore > b.nameScore end
    if a.wallpaperScore ~= b.wallpaperScore then return a.wallpaperScore > b.wallpaperScore end
    return a.recordInvalid < b.recordInvalid
  end)
  while #results > STORAGE_DEBUG_SCAN_LIMIT do table.remove(results) end
end

local function build_storage_debug()
  local p = get_profile()
  local candidates = {}
  local explicit = p.pokemonStorageCandidates or {}
  for _, base in ipairs(explicit) do
    insert_debug_candidate(candidates, storage_debug_candidate(base, p))
  end

  local boxLabel = { 0xbc, 0xe3, 0xec }
  for address = p.ewramStart, p.ewramEnd - p.boxNameLength * 3, 4 do
    if read8(address) == boxLabel[1] and read8(address + 1) == boxLabel[2] and read8(address + 2) == boxLabel[3] then
      local base = address - p.boxNames
      if base >= p.ewramStart and base <= p.ewramEnd - p.pokemonStorageSize then
        insert_debug_candidate(candidates, storage_debug_candidate(base, p))
      end
    end
  end

  return {
    game = get_game(),
    profile = p.key,
    expectedLayout = {
      boxCurrent = p.boxCurrent,
      boxData = p.boxData,
      boxNames = p.boxNames,
      boxWallpapers = p.boxWallpapers,
      pcPokemonSize = p.pcPokemonSize,
      pokemonStorageSize = p.pokemonStorageSize,
    },
    currentResolved = resolve_blocks().pokemonStorage and string.format("0x%08x", resolve_blocks().pokemonStorage) or nil,
    currentMode = resolve_blocks().storageMode,
    candidates = candidates,
  }
end

local function find_storage_incremental(p)
  local key = p.key or "default"
  local step = scan_step(p)
  if type(p.pokemonStoragePtr) == "number" then
    local base = read32(p.pokemonStoragePtr)
    local score = score_storage(base, p)
    if base >= p.ewramStart and base + p.pokemonStorageSize <= p.ewramEnd and score > 0 then
      return base, "runtime-pointer:" .. tostring(score)
    end
  end
  local candidateBase, candidateMode = find_storage_from_candidates(p)
  if candidateBase then
    return candidateBase, candidateMode
  end
  if p.pokemonStorageCandidates and #p.pokemonStorageCandidates > 0 then
    return nil, candidateMode .. ":safe-no-scan"
  end
  local scanStart = p.ewramStart
  local cursor = storageScanCursorByProfile[key] or scanStart
  local best = storageScanBestByProfile[key] or { base = nil, score = -1, complete = false }

  if best.complete then
    return best.base, "scan-complete:" .. tostring(best.score)
  end

  local scanned = 0
  local scanEnd = p.ewramEnd - p.pokemonStorageSize
  while cursor <= scanEnd and scanned < STORAGE_SCAN_CANDIDATES_PER_SNAPSHOT do
    local score = score_storage(cursor, p)
    if score > best.score then
      best = { base = cursor, score = score, complete = false }
    end
    if score >= 300 then
      best = { base = cursor, score = score, complete = true }
      break
    end
    cursor = cursor + step
    scanned = scanned + 1
  end

  if cursor > scanEnd then
    best.complete = true
  end

  storageScanCursorByProfile[key] = cursor
  storageScanBestByProfile[key] = best

  if best.score > 0 then
    return best.base, (best.complete and "scan-complete:" or "scan-progress:") .. tostring(best.score)
  end

  return nil, (best.complete and "scan-complete:" or "scan-progress:") .. tostring(best.score)
end

local function find_storage(p)
  local bestBase, bestScore = nil, -1
  local step = scan_step(p)
  for base = p.ewramStart, p.ewramEnd - p.pokemonStorageSize, step do
    local score = score_storage(base, p)
    if score > bestScore then
      bestBase, bestScore = base, score
    end
  end
  return bestBase, "scan:" .. tostring(bestScore)
end

local function resolve_blocks()
  local p = get_profile()
  if type(p.saveBlock1Ptr) == "number" or type(p.saveBlock2Ptr) == "number" or type(p.pokemonStoragePtr) == "number" then
    local saveBlock2, saveBlock2Mode = find_saveblock2(p)
    local securityKey = 0
    if p.encryptionKey and saveBlock2 then securityKey = read32(saveBlock2 + p.encryptionKey) end
    local saveBlock1, saveBlock1Mode = find_saveblock1(p, securityKey)
    local storage, storageMode = find_storage_incremental(p)
    return {
      saveBlock1 = saveBlock1,
      saveBlock2 = saveBlock2,
      pokemonStorage = storage,
      saveBlock1Mode = saveBlock1Mode,
      saveBlock2Mode = saveBlock2Mode,
      storageMode = storageMode,
      securityKey = securityKey,
    }
  end
  if blockCache then
    if not blockCache.saveBlock2 then
      local saveBlock2, saveBlock2Mode = find_saveblock2(p)
      blockCache.saveBlock2 = saveBlock2
      blockCache.saveBlock2Mode = saveBlock2Mode
      if p.encryptionKey and saveBlock2 then blockCache.securityKey = read32(saveBlock2 + p.encryptionKey) end
    end
    if not blockCache.saveBlock1 then
      local saveBlock1, saveBlock1Mode = find_saveblock1(p, blockCache.securityKey or 0)
      blockCache.saveBlock1 = saveBlock1
      blockCache.saveBlock1Mode = saveBlock1Mode
    end
    if not blockCache.pokemonStorage then
      local storage, storageMode = find_storage_incremental(p)
      blockCache.pokemonStorage = storage
      blockCache.storageMode = storageMode
    end
    return blockCache
  end
  local saveBlock2, saveBlock2Mode = find_saveblock2(p)
  local securityKey = 0
  if p.encryptionKey and saveBlock2 then securityKey = read32(saveBlock2 + p.encryptionKey) end
  local saveBlock1, saveBlock1Mode = find_saveblock1(p, securityKey)
  local storage, storageMode = find_storage_incremental(p)
  blockCache = {
    saveBlock1 = saveBlock1,
    saveBlock2 = saveBlock2,
    pokemonStorage = storage,
    saveBlock1Mode = saveBlock1Mode,
    saveBlock2Mode = saveBlock2Mode,
    storageMode = storageMode,
    securityKey = securityKey,
  }
  return blockCache
end

local function read_pokedex()
  local p = get_profile()
  local blocks = resolve_blocks()
  local saveBlock2 = blocks.saveBlock2 or 0
  local seen, caught = {}, {}
  for national = 1, GEN3_NUM_SPECIES do
    local bit = national - 1
    local mask = lshift(1, bit % 8)
    if band(read8(saveBlock2 + p.pokedexSeen + math.floor(bit / 8)), mask) ~= 0 then seen[#seen + 1] = national end
    if band(read8(saveBlock2 + p.pokedexOwned + math.floor(bit / 8)), mask) ~= 0 then caught[#caught + 1] = national end
  end
  local nationalMagic = p.nationalMagic or RSE_NATIONAL_MAGIC
  local nationalEnabled = read8(saveBlock2 + p.pokedexNationalMagic) == nationalMagic
  local mode = nationalEnabled and read8(saveBlock2 + p.pokedexMode) == DEX_MODE_NATIONAL and "national" or "regional"
  local regionalDex = nil
  local dexMax = GEN3_NUM_SPECIES
  local game = get_game()
  if mode == "regional" and (game == "firered" or game == "leafgreen") then
    regionalDex = "kanto"
    dexMax = GEN3_KANTO_DEX_COUNT
  elseif mode == "regional" then
    regionalDex = "hoenn"
    dexMax = GEN3_HOENN_DEX_COUNT
  end
  return {
    seenSpecies = seen,
    caughtSpecies = caught,
    seenCount = #seen,
    caughtCount = #caught,
    mode = mode,
    regionalDex = regionalDex,
    dexMax = dexMax,
    source = "live"
  }
end

local function read_event_bytes()
  local p = get_profile()
  local blocks = resolve_blocks()
  local saveBlock1 = blocks.saveBlock1 or 0
  local bytes = {}
  local count = math.floor(((p.eventFlagCount or 0) + 7) / 8)
  for i = 0, count - 1 do
    bytes[#bytes + 1] = read8(saveBlock1 + p.flags + i)
  end
  return {
    bytes = bytes,
  }
end

local function read_progress_values()
  local p = get_profile()
  local saveBlock1 = resolve_blocks().saveBlock1 or 0
  local function read_var(id)
    return read16(saveBlock1 + p.vars + (id - 0x4000) * 2)
  end
  local game = get_game()
  if game == "firered" or game == "leafgreen" then
    return {
      starterMon = read_var(0x4031),
    }
  end
  return {
    starterMon = read_var(0x4023),
    birchLabState = read_var(0x4084),
    petalburgGymState = read_var(0x4085),
    littlerootIntroState = read_var(0x4092),
    eliteFourState = read_var(0x409c),
    sootopolisState = read_var(0x405e),
  }
end

local function read_badges(saveBlock1, p)
  local badges = {}
  for i = 0, 7 do
    local flag = p.badgeFlagStart + i
    local value = read8(saveBlock1 + p.flags + math.floor(flag / 8))
    badges[i + 1] = band(value, lshift(1, flag % 8)) ~= 0
  end
  return badges
end

local function read_player()
  local p = get_profile()
  local blocks = resolve_blocks()
  local saveBlock1 = blocks.saveBlock1 or 0
  local saveBlock2 = blocks.saveBlock2 or 0
  local money = read32(saveBlock1 + p.money)
  if p.quantityMask == "security-key-low16" then money = bxor(money, blocks.securityKey) end
  return {
    name = decode_string(saveBlock2 + p.trainerName, 7),
    gender = read8(saveBlock2 + p.trainerGender) == 1 and "female" or "male",
    id = read16(saveBlock2 + p.trainerId),
    money = money,
    badges = read_badges(saveBlock1, p),
    playTime = {
      hours = read16(saveBlock2 + p.playTimeHours),
      minutes = read8(saveBlock2 + p.playTimeMinutes),
      seconds = read8(saveBlock2 + p.playTimeSeconds),
      vblanks = p.playTimeVBlanks and read8(saveBlock2 + p.playTimeVBlanks) or nil,
    },
  }
end

local function read_party()
  local p = get_profile()
  local party = {}

  local function read_from_active_party(address)
    local activeParty = {}
    for i = 0, 5 do
      local mon = parse_pokemon(address + i * p.partyPokemonSize, p.partyPokemonSize, true)
      if mon then activeParty[#activeParty + 1] = mon end
    end
    return activeParty
  end

  if type(p.activeParty) == "number" then
    party = read_from_active_party(p.activeParty)
    if #party > 0 then return party end
  end

  if type(p.activePartyCandidates) == "table" then
    local bestParty = {}
    for _, address in ipairs(p.activePartyCandidates) do
      local candidate = read_from_active_party(address)
      if #candidate > #bestParty then bestParty = candidate end
    end
    if #bestParty > 0 then return bestParty end
  end

  local base = resolve_blocks().saveBlock1 or 0
  local count = math.min(read8(base + p.partyCount), 6)
  for i = 0, count - 1 do
    local mon = parse_pokemon(base + p.party + i * p.partyPokemonSize, p.partyPokemonSize, true)
    if mon then party[#party + 1] = mon end
  end
  return party
end

local function read_items_from_pocket(saveBlock1, pocket, securityKey)
  local items = {}
  for i = 0, pocket.count - 1 do
    local offset = saveBlock1 + pocket.offset + i * 4
    local id = read16(offset)
    local quantity = read16(offset + 2)
    if pocket.quantityMask == "security-key-low16" then quantity = bxor(quantity, band(securityKey, 0xffff)) end
    if id > 0 and quantity > 0 then items[#items + 1] = { id = id, quantity = quantity } end
  end
  return items
end

local function read_bag()
  local p = get_profile()
  local blocks = resolve_blocks()
  local bag = {}
  for _, pocket in ipairs(p.pockets) do
    local items = read_items_from_pocket(blocks.saveBlock1 or 0, pocket, blocks.securityKey)
    if pocket.name == "PC Items" then bag.pcStorage = items
    elseif pocket.name == "Poke Balls" then bag.pokeballs = items
    elseif pocket.name == "TMs/HMs" then bag.tmhms = items
    elseif pocket.name == "Berries" then bag.berries = items
    elseif pocket.name == "Key Items" then bag.keyItems = items
    elseif pocket.name == "Items" then bag.items = items end
  end
  return bag
end

local function read_pc_boxes()
  local p = get_profile()
  local storage = resolve_blocks().pokemonStorage
  if not storage then return {} end
  local currentBox = read8(storage + p.boxCurrent)
  local boxes = {}
  for box = 0, p.pcBoxCount - 1 do
    local pokemon = {}
    for slot = 0, p.pcBoxCapacity - 1 do
      local mon = parse_pokemon(storage + p.boxData + (box * p.pcBoxCapacity + slot) * p.pcPokemonSize, p.pcPokemonSize, false)
      if mon then
        mon.slotIndex = slot
        pokemon[#pokemon + 1] = mon
      end
    end
    local name = decode_string(storage + p.boxNames + box * p.boxNameLength, p.boxNameLength)
    if name == "" or string.upper(name) == "BOX" then name = "Box " .. tostring(box + 1) end
    boxes[#boxes + 1] = { name = name, capacity = p.pcBoxCapacity, isCurrent = box == currentBox, pokemon = pokemon }
  end
  return boxes
end

local function read_location()
  local p = get_profile()
  local base = resolve_blocks().saveBlock1 or 0
  return {
    mapGroup = read8(base + p.locationMapGroup),
    mapId = read8(base + p.locationMapNum),
    x = read_s16(base + 0x0000),
    y = read_s16(base + 0x0002),
    name = "Live",
  }
end

local function now_seconds()
  if socket and socket.gettime then return socket.gettime() end
  if os and os.clock then return os.clock() end
  return 0
end

local function read_heavy_sections(force)
  local currentTime = now_seconds()
  local game = get_game()
  if not force
    and cachedHeavySections
    and cachedHeavySectionsGame == game
    and (currentTime - cachedHeavySectionsAt) < HEAVY_SECTION_REFRESH_SECONDS
  then
    return cachedHeavySections
  end

  cachedHeavySections = {
    pokedex = read_pokedex(),
    pcBoxes = read_pc_boxes(),
    bag = read_bag(),
  }
  cachedHeavySectionsAt = currentTime
  cachedHeavySectionsGame = game
  return cachedHeavySections
end

local function build_snapshot()
  local p = get_profile()
  local blocks = resolve_blocks()
  local heavy = read_heavy_sections(false)
  return {
    generation = 3,
    game = get_game(),
    status = {
      emulator = "mGBA",
      adapter = "mgba-gen3-live",
      adapterRevision = ADAPTER_REVISION,
      profile = p.key,
      game = get_game(),
      romTitle = get_rom_title(),
      ok = get_ewram() ~= nil,
      saveBlock1 = blocks.saveBlock1,
      saveBlock2 = blocks.saveBlock2,
      pokemonStorage = blocks.pokemonStorage,
      saveBlock1Mode = blocks.saveBlock1Mode,
      saveBlock2Mode = blocks.saveBlock2Mode,
      storageMode = blocks.storageMode,
      memoryReadMode = "bus-first",
      resolution = p.resolution,
    },
    player = read_player(),
    pokedex = heavy.pokedex,
    eventsRaw = read_event_bytes(),
    progressRaw = read_progress_values(),
    party = read_party(),
    pcBoxes = heavy.pcBoxes,
    bag = heavy.bag,
    location = read_location(),
  }
end

local function snapshot_json(force)
  local currentTime = now_seconds()
  if not force and cachedSnapshotBody and (currentTime - cachedSnapshotAt) < SNAPSHOT_REFRESH_SECONDS then
    return cachedSnapshotBody
  end
  local body = json(build_snapshot())
  cachedSnapshotBody = body
  cachedSnapshotAt = currentTime
  return body
end

local function call_if_exists(target, method, value)
  if target and target[method] then
    local ok = pcall(target[method], target, value)
    if ok then return end
  end
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

local function read_request_target(client)
  local ok, line = pcall(function() return client:receive("*l") end)
  if not ok or not line then return "/snapshot" end

  local target = line:match("^%u+%s+([^%s]+)%s+HTTP/%d%.%d$")
  if not target then target = line:match("^%u+%s+([^%s]+)") end

  for _ = 1, 32 do
    local hOk, header = pcall(function() return client:receive("*l") end)
    if not hOk or not header or header == "" then break end
  end

  return target or "/snapshot"
end

local function start_server()
  if not socket or not socket.tcp then error("Missing socket.tcp; mGBA build may not expose Lua socket APIs") end
  server = socket.tcp()
  call_if_exists(server, "settimeout", 0)
  call_if_exists(server, "setblocking", false)
  server:bind(HOST, PORT)
  server:listen(5)
  log("Pokemon Emulator Tracker Gen 3 mGBA adapter listening on http://" .. HOST .. ":" .. PORT)
end

local function poll_server()
  local currentTime = now_seconds()
  if (currentTime - lastPollAt) < SERVER_POLL_SECONDS then return end
  lastPollAt = currentTime

  if not server then start_server() end
  local client = nil

  local acceptOk, accepted = pcall(function() return server:accept() end)
  if acceptOk then client = accepted end

  if client then
    call_if_exists(client, "settimeout", 0.5)
    local target = read_request_target(client)
    local ok, body = pcall(function()
      if target == "/debug/storage" then return json(build_storage_debug()) end
      return snapshot_json(false)
    end)
    if ok then send(client, "200 OK", body) else send(client, "500 Internal Server Error", json({ success = false, error = tostring(body) })) end
    pcall(function() client:close() end)
  end
end

local ok, err = pcall(start_server)
if not ok then
  log("Adapter failed to start server: " .. tostring(err))
elseif callbacks and callbacks.add then
  callbacks:add("frame", function()
    poll_server()
  end)
else
  log("Adapter started server but callbacks:add is missing; polling will not run")
end
