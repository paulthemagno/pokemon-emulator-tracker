-- Pokemon Emulator Tracker live adapter for mGBA + Pokemon Gen 2 (Gold/Silver/Crystal).
-- Load in mGBA: Tools -> Scripting... -> Load Script.
-- Then press "Start Live" in the web UI. The adapter serves http://127.0.0.1:8080/snapshot.

local PORT = 8080
local HOST = "127.0.0.1"

local PARTY_MON_SIZE = 0x30
local NAME_SIZE = 11
local BOX_MON_SIZE = 0x20
local BOX_CAPACITY = 20
local BOX_NAME_LENGTH = 9
local NUM_BOXES = 14
local BOX_NAMES_TOTAL_LENGTH = BOX_NAME_LENGTH * NUM_BOXES
local BOX_RECORD_SIZE = 1 + BOX_CAPACITY + 1 + (BOX_CAPACITY * BOX_MON_SIZE) + (BOX_CAPACITY * NAME_SIZE * 2)
local POKEDEX_FLAGS_FROM_PARTY_COUNT = 0x1C2
local GEN2_NUM_SPECIES = 251
local POKEDEX_FLAG_BYTES = math.floor((GEN2_NUM_SPECIES + 7) / 8)
local CURRENT_BOX_OFFSET = 0x2D10
local BOX_SCAN_START = 0x2400
local BOX_SCAN_END = 0x8000 - BOX_RECORD_SIZE
local BOX_OFFSETS = {
  0x4000, 0x4450, 0x48A0, 0x4CF0, 0x5140, 0x5590, 0x59E0,
  0x6000, 0x6450, 0x68A0, 0x6CF0, 0x7140, 0x7590, 0x79E0,
}
local SRAM_BANK_SIZE = 0x2000
local SRAM_WINDOW = 0xA000
local NUM_TMS = 50
local NUM_HMS = 7

local OFFSET_PROFILES = {
  crystal = {
    key = "crystal",
    game = "crystal",
    playerGender = 0xD472,
    trainerId = 0xD47B,
    trainerName = 0xD47D,
    playTime = 0xD4C4,
    money = 0xD84E,
    moneyFormat = "be24",
    johtoBadges = 0xD857,
    kantoBadges = 0xD858,
    tmsHms = 0xD859,
    numItems = 0xD892,
    items = 0xD893,
    numKeyItems = 0xD8BC,
    keyItems = 0xD8BD,
    numBalls = 0xD8D7,
    balls = 0xD8D8,
    mapGroup = 0xDCB5,
    mapNumber = 0xDCB6,
    playerY = 0xDCB7,
    playerX = 0xDCB8,
    partyCount = 0xDCD7,
    partyMon1 = 0xDCDF,
    partyNicknames = 0xDE41,
  },
  gold_silver = {
    key = "gold_silver",
    game = "gold",
    trainerId = 0xD1A1,
    trainerName = 0xD1A3,
    playTime = 0xD1EB,
    money = 0xD573,
    moneyFormat = "be24",
    johtoBadges = 0xD57C,
    kantoBadges = 0xD57D,
    tmsHms = 0xD57E,
    numItems = 0xD5B7,
    items = 0xD5B8,
    numKeyItems = 0xD5E1,
    keyItems = 0xD5E2,
    numBalls = 0xD5FC,
    balls = 0xD5FD,
    mapGroup = 0xDA00,
    mapNumber = 0xDA01,
    playerX = 0xDA02,
    playerY = 0xDA03,
    partyCount = 0xDA22,
    partyMon1 = 0xDA2A,
    partyNicknames = 0xDB8C,
  },
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
  [0x2d] = "&", [0xe9] = "&",
  [0xf6] = "0", [0xf7] = "1", [0xf8] = "2", [0xf9] = "3", [0xfa] = "4",
  [0xfb] = "5", [0xfc] = "6", [0xfd] = "7", [0xfe] = "8", [0xff] = "9",
}

local server = nil
local wram = nil
local sram = nil
local sramReadMode = "domain"
local lastSramHealth = "unknown"
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
local pcCache = nil
local pcCacheRemaining = 0
local PC_CACHE_SNAPSHOTS = 5
local boxNamesAddressCache = nil
local activeOffsetProfile = nil
local detectedGame = nil
local detectedRomTitle = nil

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

local function script_directory()
  local info = debug and debug.getinfo and debug.getinfo(1, "S")
  if info and type(info.source) == "string" and info.source:sub(1, 1) == "@" then
    local path = info.source:sub(2)
    local directory = path:match("^(.*[/\\])")
    if directory then return directory end
  end
  return ""
end

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

local DEBUG_SNAPSHOT_PATH = temp_directory() .. "pokemon-emulator-tracker-gen2-live-snapshot.json"

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
  local ok, value

  -- Bus reads are reliable for current WRAM mapping in mGBA.
  if emu and emu.read8 then
    ok, value = pcall(function() return emu:read8(address) end)
    if ok and value ~= nil then return value end
  end

  local memory = get_wram()
  if not memory then return 0 end
  local offset = address >= 0xC000 and address - 0xC000 or address

  ok, value = pcall(function() return memory:read8(offset) end)
  if ok and value ~= nil then return value end

  ok, value = pcall(function() return memory:read8(address) end)
  return ok and value or 0
end

local function read_sram_domain_offset8(offset)
  local memory = get_sram()
  if not memory then return 0 end
  local ok, value = pcall(function() return memory:read8(offset) end)
  return ok and value or 0
end

local function read_sram_bus_offset8(offset)
  local bank = math.floor(offset / SRAM_BANK_SIZE)
  local bankOffset = offset % SRAM_BANK_SIZE
  local ok, value

  if emu and emu.write8 and emu.read8 then
    pcall(function() emu:write8(0x0000, 0x0A) end)
    pcall(function() emu:write8(0x4000, bank) end)
    ok, value = pcall(function() return emu:read8(SRAM_WINDOW + bankOffset) end)
    if ok and value then return value end
  end

  return 0
end

local function read_sram_offset8(offset)
  if sramReadMode == "bus" then return read_sram_bus_offset8(offset) end
  return read_sram_domain_offset8(offset)
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

local function read_bytes(address, count)
  local bytes = {}
  for i = 0, count - 1 do
    bytes[#bytes + 1] = read8(address + i)
  end
  return bytes
end

local function should_dump_snapshot(override)
  local mode = override or DEBUG_SNAPSHOT_MODE
  if mode == "force" then return true end
  if mode == "always" then return true end
  if mode == "off" then return false end
  if mode == "once" then return not debugSnapshotDumped end
  return false
end

local function read_request_target(client)
  local ok, line = pcall(function() return client:receive("*l") end)
  if not ok or not line then return "/snapshot" end

  local target = line:match("^%u+%s+([^%s]+)%s+HTTP/%d%.%d$")
  if not target then
    target = line:match("^%u+%s+([^%s]+)")
  end

  -- Drain headers (up to a safe cap) so the socket is clean before reply/close.
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

local function classify_sram_health(reader)
  local offsets = { CURRENT_BOX_OFFSET, 0x4000, 0x4450, 0x48A0, 0x4CF0, 0x6000 }
  local zeros = 0
  local erased = 0
  local plausible = 0

  for _, offset in ipairs(offsets) do
    local value = reader(offset)
    if value == 0 then zeros = zeros + 1 end
    if value == 0xff then erased = erased + 1 end
    if value > 0 and value <= BOX_CAPACITY then plausible = plausible + 1 end
  end

  if plausible > 0 then return "ready" end
  if erased == #offsets then return "erased" end
  if zeros == #offsets then return "zeroed" end
  return "unknown"
end

local function ensure_sram_ready()
  sramReadMode = "domain"
  lastSramHealth = classify_sram_health(read_sram_domain_offset8)
  if lastSramHealth == "ready" then return end

  sramReadMode = "bus"
  lastSramHealth = classify_sram_health(read_sram_bus_offset8)
  if lastSramHealth == "ready" then return end

  sramReadMode = "domain"
end

local function get_sram_size()
  local memory = get_sram()
  if not memory or not memory.size then return 0 end
  local ok, value = pcall(function() return memory:size() end)
  return ok and value or 0
end

local function read16be(address)
  return (read8(address) * 0x100) + read8(address + 1)
end

local function read24be(address)
  return (read8(address) * 0x10000) + (read8(address + 1) * 0x100) + read8(address + 2)
end

local function read_sram_offset16be(offset)
  return (read_sram_offset8(offset) * 0x100) + read_sram_offset8(offset + 1)
end

local function read_sram_offset24be(offset)
  return (read_sram_offset8(offset) * 0x10000)
    + (read_sram_offset8(offset + 1) * 0x100)
    + read_sram_offset8(offset + 2)
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

local function read_sram_offset_name(offset)
  local result = ""
  for i = 0, NAME_SIZE - 1 do
    local byte = read_sram_offset8(offset + i)
    if byte == 0x50 or byte == 0x00 then break end
    result = result .. (GB_CHARS[byte] or "")
  end
  return result
end

local function read_rom_title()
  if detectedRomTitle ~= nil then return detectedRomTitle end
  local chars = {}

  if emu and emu.read8 then
    for address = 0x0134, 0x0143 do
      local ok, value = pcall(function() return emu:read8(address) end)
      if not ok or not value or value == 0 then break end
      if value >= 32 and value <= 126 then
        table.insert(chars, string.char(value))
      end
    end
  end

  detectedRomTitle = table.concat(chars):gsub("%s+$", "")
  return detectedRomTitle
end

local function game_from_rom_title(title)
  local upper = string.upper(title or "")
  if upper:find("CRYSTAL", 1, true) or upper:find("CRYSTL", 1, true) then return "crystal" end
  if upper:find("POKEMON C", 1, true) then return "crystal" end
  if upper:find("SILVER", 1, true) or upper:find("SLV", 1, true) then return "silver" end
  if upper:find("POKEMON S", 1, true) then return "silver" end
  if upper:find("GOLD", 1, true) or upper:find("GLD", 1, true) then return "gold" end
  if upper:find("POKEMON G", 1, true) then return "gold" end
  return nil
end

local function is_reasonable_trainer_name(name)
  return name ~= nil and #name > 0 and #name <= NAME_SIZE and name:match("^[%w %-%._'!?&]+$") ~= nil
end

local function bcd_byte_score(value)
  local high = math.floor(value / 16)
  local low = value % 16
  return (high <= 9 and low <= 9) and 1 or -1
end

local function score_offset_profile(profile)
  local score = 0
  local partyCount = read8(profile.partyCount)
  if partyCount >= 0 and partyCount <= 6 then score = score + 3 else score = score - 6 end

  if partyCount > 0 then
    local species = read8(profile.partyMon1)
    if species > 0 and species <= GEN2_NUM_SPECIES then score = score + 3 else score = score - 3 end
  end

  if is_reasonable_trainer_name(read_name(profile.trainerName)) then score = score + 2 end

  if profile.moneyFormat == "bcd" then
    score = score + bcd_byte_score(read8(profile.money))
    score = score + bcd_byte_score(read8(profile.money + 1))
    score = score + bcd_byte_score(read8(profile.money + 2))
  else
    local moneyVal = read8(profile.money) * 0x10000 + read8(profile.money + 1) * 0x100 + read8(profile.money + 2)
    if moneyVal <= 999999 then score = score + 2 else score = score - 2 end
  end

  local mapGroup = read8(profile.mapGroup)
  local mapNumber = read8(profile.mapNumber)
  if mapGroup > 0 and mapGroup < 32 then score = score + 1 else score = score - 1 end
  if mapNumber > 0 and mapNumber < 128 then score = score + 1 else score = score - 1 end

  return score
end

local function get_offset_profile()
  if activeOffsetProfile then return activeOffsetProfile end

  local title = read_rom_title()
  local game = game_from_rom_title(title)
  detectedGame = game

  if game == "crystal" then
    activeOffsetProfile = OFFSET_PROFILES.crystal
  elseif game == "gold" or game == "silver" then
    activeOffsetProfile = OFFSET_PROFILES.gold_silver
    activeOffsetProfile.game = game
  else
    local crystalScore = score_offset_profile(OFFSET_PROFILES.crystal)
    local goldSilverScore = score_offset_profile(OFFSET_PROFILES.gold_silver)
    activeOffsetProfile = goldSilverScore > crystalScore and OFFSET_PROFILES.gold_silver or OFFSET_PROFILES.crystal
    detectedGame = activeOffsetProfile.game
  end

  log("Detected Gen 2 profile: " .. activeOffsetProfile.key .. " (" .. (detectedGame or "unknown") .. ")"
    .. (title ~= "" and (" from ROM title " .. title) or ""))
  return activeOffsetProfile
end

local function get_game()
  local profile = get_offset_profile()
  return detectedGame or profile.game
end

local function read_name_at(address, maxLength)
  local result = ""
  for i = 0, maxLength - 1 do
    local byte = read8(address + i)
    if byte == 0x50 or byte == 0x00 then break end
    result = result .. (GB_CHARS[byte] or "")
  end
  return result
end

local function is_reasonable_box_name(name)
  if not name or #name == 0 or #name > (BOX_NAME_LENGTH - 1) then return false end
  return name:match("^[%w %-%._'!?&]+$") ~= nil
end

local function score_box_names_block(baseAddress)
  local nonEmpty = 0
  local reasonable = 0

  for i = 0, NUM_BOXES - 1 do
    local name = read_name_at(baseAddress + (i * BOX_NAME_LENGTH), BOX_NAME_LENGTH)
    if #name > 0 then nonEmpty = nonEmpty + 1 end
    if is_reasonable_box_name(name) then reasonable = reasonable + 1 end
  end

  return nonEmpty, reasonable
end

local function find_box_names_address()
  if boxNamesAddressCache then return boxNamesAddressCache end

  local bestAddress = nil
  local bestScore = -1

  for base = 0xC003, 0xDFFF - BOX_NAMES_TOTAL_LENGTH + 1 do
    local curBoxCandidate = read8(base - 3)
    if curBoxCandidate <= (NUM_BOXES - 1) then
      local nonEmpty, reasonable = score_box_names_block(base)
      local score = (reasonable * 2) + nonEmpty
      if nonEmpty >= 8 and reasonable >= 8 and score > bestScore then
        bestAddress = base
        bestScore = score
      end
    end
  end

  boxNamesAddressCache = bestAddress
  return boxNamesAddressCache
end

local function read_box_names()
  local names = {}
  for i = 1, NUM_BOXES do
    names[i] = "Box " .. tostring(i)
  end

  local base = find_box_names_address()
  if not base then return names, nil end

  for i = 0, NUM_BOXES - 1 do
    local parsed = read_name_at(base + (i * BOX_NAME_LENGTH), BOX_NAME_LENGTH)
    if is_reasonable_box_name(parsed) then
      names[i + 1] = parsed
    end
  end

  local currentBox = read8(base - 3) % NUM_BOXES
  return names, currentBox
end

local function read_party()
  local offsets = get_offset_profile()
  local count = math.min(read8(offsets.partyCount), 6)
  local party = {}

  for slot = 0, count - 1 do
    local address = offsets.partyMon1 + (slot * PARTY_MON_SIZE)
    local species = read8(address)
    if species > 0 and species < 252 then
      local nickname = read_name(offsets.partyNicknames + (slot * NAME_SIZE))
      table.insert(party, {
        speciesID = species,
        nickname = nickname ~= "" and nickname or ("Pokemon " .. tostring(species)),
        heldItem = read8(address + 0x01),
        level = read8(address + 0x1F),
        status = read8(address + 0x20),
        currentHP = read16be(address + 0x22),
        maxHP = read16be(address + 0x24),
        attack = read16be(address + 0x26),
        defense = read16be(address + 0x28),
        speed = read16be(address + 0x2A),
        specialAttack = read16be(address + 0x2C),
        specialDefense = read16be(address + 0x2E),
        experience = read24be(address + 0x08),
        happiness = read8(address + 0x1B),
        originalTrainerID = read16be(address + 0x06),
        moves = {
          { id = read8(address + 0x02), pp = read8(address + 0x17) % 64 },
          { id = read8(address + 0x03), pp = read8(address + 0x18) % 64 },
          { id = read8(address + 0x04), pp = read8(address + 0x19) % 64 },
          { id = read8(address + 0x05), pp = read8(address + 0x1A) % 64 },
        },
      })
    end
  end

  return party
end

local function read_species_flags(address, numSpecies)
  local ids = {}
  for species = 1, numSpecies do
    local bitIndex = species - 1
    local byteIndex = math.floor(bitIndex / 8)
    local mask = 2 ^ (bitIndex % 8)
    local value = read8(address + byteIndex)
    if math.floor(value / mask) % 2 == 1 then
      table.insert(ids, species)
    end
  end
  return ids
end

local function read_pokedex()
  local offsets = get_offset_profile()
  local caughtAddress = offsets.partyCount + POKEDEX_FLAGS_FROM_PARTY_COUNT
  local seenAddress = caughtAddress + POKEDEX_FLAG_BYTES
  local caughtSpecies = read_species_flags(caughtAddress, GEN2_NUM_SPECIES)
  local seenSpecies = read_species_flags(seenAddress, GEN2_NUM_SPECIES)

  return {
    caughtSpecies = caughtSpecies,
    seenSpecies = seenSpecies,
    caughtCount = #caughtSpecies,
    seenCount = #seenSpecies,
    source = "live",
  }
end

local function read_badges(byte)
  local badges = {}
  for i = 0, 7 do
    badges[i + 1] = math.floor(byte / (2 ^ i)) % 2 == 1
  end
  return badges
end

local function read_u24_be(address)
  return (read8(address) * 0x10000) + (read8(address + 1) * 0x100) + read8(address + 2)
end

local function read_bcd_money(address)
  local value = 0

  for i = 0, 2 do
    local byte = read8(address + i)
    local high = math.floor(byte / 16)
    local low = byte % 16
    if high > 9 or low > 9 then
      return 0
    end
    value = (value * 100) + (high * 10) + low
  end

  return value
end

local function is_valid_bcd_money(address)
  for i = 0, 2 do
    local byte = read8(address + i)
    local high = math.floor(byte / 16)
    local low = byte % 16
    if high > 9 or low > 9 then return false end
  end
  return true
end

local function read_money(address, format)
  if format == "be24" then return read_u24_be(address) end
  return read_bcd_money(address)
end

local function read_player()
  local offsets = get_offset_profile()
  local name = read_name(offsets.trainerName)
  local id = read16be(offsets.trainerId)
  local playTimeHours = read16be(offsets.playTime)
  local playTimeMinutes = read8(offsets.playTime + 2)
  local playTimeSeconds = read8(offsets.playTime + 3)
  local moneyBytes = read_bytes(offsets.money, 3)
  local money = read_money(offsets.money, offsets.moneyFormat)
  local moneyDebug = {
    address = offsets.money,
    format = offsets.moneyFormat,
    bytes = moneyBytes,
  }
  if offsets.key == "crystal" and offsets.moneyFormat == "bcd" and not is_valid_bcd_money(offsets.money) then
    -- Some mGBA/core combinations expose Crystal money at this mirrored WRAM address.
    if is_valid_bcd_money(0xD812) then
      moneyDebug.fallbackAddress = 0xD812
      moneyDebug.fallbackBytes = read_bytes(0xD812, 3)
      money = read_bcd_money(0xD812)
    end
  end
  local johto = read8(offsets.johtoBadges)
  local kanto = read8(offsets.kantoBadges)
  local badges = read_badges(johto)
  local kantoBadges = read_badges(kanto)

  for i = 1, 8 do
    badges[8 + i] = kantoBadges[i]
  end

  local gender = nil
  if offsets.playerGender then
    local genderByte = read8(offsets.playerGender)
    if genderByte == 0 or genderByte == 1 then
      gender = genderByte == 1 and "female" or "male"
    end
  end

  return {
    name = name ~= "" and name or "Live Trainer",
    gender = gender,
    id = id,
    money = money,
    debug = {
      money = moneyDebug,
    },
    badges = badges,
    playTime = {
      hours = playTimeHours,
      minutes = playTimeMinutes,
      seconds = playTimeSeconds,
    },
  }
end

local function read_location()
  local offsets = get_offset_profile()
  local mapGroup = read8(offsets.mapGroup)
  local mapNumber = read8(offsets.mapNumber)
  local y = read8(offsets.playerY)
  local x = read8(offsets.playerX)

  return {
    mapGroup = mapGroup,
    mapId = mapNumber,
    x = x,
    y = y,
    name = "Map " .. tostring(mapGroup) .. "-" .. tostring(mapNumber),
  }
end

local function read_item_stack(address, countAddress, maxCount)
  local count = math.min(read8(countAddress), maxCount)
  local items = {}

  for index = 0, count - 1 do
    local itemId = read8(address + (index * 2))
    local quantity = read8(address + (index * 2) + 1)
    if itemId > 0 and itemId < 0xff and quantity > 0 then
      table.insert(items, { id = itemId, quantity = quantity })
    end
  end

  return items
end

local function read_key_items()
  local offsets = get_offset_profile()
  local count = math.min(read8(offsets.numKeyItems), 26)
  local items = {}

  for index = 0, count - 1 do
    local itemId = read8(offsets.keyItems + index)
    if itemId > 0 and itemId < 0xff then
      table.insert(items, { id = itemId, quantity = 1 })
    end
  end

  return items
end

local function read_tms_hms()
  local offsets = get_offset_profile()
  local items = {}

  for index = 0, NUM_TMS - 1 do
    local quantity = read8(offsets.tmsHms + index)
    if quantity > 0 then
      table.insert(items, { id = 0xbf + index, quantity = quantity })
    end
  end

  for index = 0, NUM_HMS - 1 do
    local quantity = read8(offsets.tmsHms + NUM_TMS + index)
    if quantity > 0 then
      table.insert(items, { id = 0xf3 + index, quantity = quantity })
    end
  end

  return items
end

local function read_bag()
  local offsets = get_offset_profile()
  return {
    items = read_item_stack(offsets.items, offsets.numItems, 20),
    keyItems = read_key_items(),
    pokeballs = read_item_stack(offsets.balls, offsets.numBalls, 12),
    tmhms = read_tms_hms(),
  }
end

local function read_box_pokemon_at_offset(address, nickname, originalTrainer)
  local species = read_sram_offset8(address)
  if species <= 0 or species == 0xff or species > 251 then return nil end

  return {
    speciesID = species,
    nickname = nickname ~= "" and nickname or ("Pokemon " .. tostring(species)),
    originalTrainer = originalTrainer,
    heldItem = read_sram_offset8(address + 0x01),
    moves = {
      { id = read_sram_offset8(address + 0x02), pp = read_sram_offset8(address + 0x17) % 64 },
      { id = read_sram_offset8(address + 0x03), pp = read_sram_offset8(address + 0x18) % 64 },
      { id = read_sram_offset8(address + 0x04), pp = read_sram_offset8(address + 0x19) % 64 },
      { id = read_sram_offset8(address + 0x05), pp = read_sram_offset8(address + 0x1A) % 64 },
    },
    originalTrainerID = read_sram_offset16be(address + 0x06),
    experience = read_sram_offset24be(address + 0x08),
    happiness = read_sram_offset8(address + 0x1B),
    level = read_sram_offset8(address + 0x1F),
  }
end

local function parse_pc_box_record(offset, name)
  local count = read_sram_offset8(offset)
  if count <= 0 or count > BOX_CAPACITY then return nil end
  if read_sram_offset8(offset + 1 + count) ~= 0xff then return nil end

  local pokemonDataOffset = offset + 1 + BOX_CAPACITY + 1
  local otNamesOffset = pokemonDataOffset + (BOX_CAPACITY * BOX_MON_SIZE)
  local nicknamesOffset = otNamesOffset + (BOX_CAPACITY * NAME_SIZE)
  local pokemon = {}

  for slot = 0, count - 1 do
    local species = read_sram_offset8(offset + 1 + slot)
    if species <= 0 or species == 0xff or species > 251 then return nil end

    local nickname = read_sram_offset_name(nicknamesOffset + (slot * NAME_SIZE))
    local originalTrainer = read_sram_offset_name(otNamesOffset + (slot * NAME_SIZE))
    local mon = read_box_pokemon_at_offset(
      pokemonDataOffset + (slot * BOX_MON_SIZE),
      nickname,
      originalTrainer
    )
    if mon then table.insert(pokemon, mon) end
  end

  if #pokemon <= 0 then return nil end
  return { name = name, pokemon = pokemon, capacity = BOX_CAPACITY, offset = offset }
end

local read_current_pc_box
local read_current_pc_count

local function read_pc_boxes()
  local boxes = {}
  local currentBox = read_current_pc_box()
  local boxNames, currentBoxIndex = read_box_names()

  for index, offset in ipairs(BOX_OFFSETS) do
    local isCurrentSlot = currentBoxIndex ~= nil and (currentBoxIndex + 1) == index
    local box = nil

    if isCurrentSlot and #currentBox.pokemon > 0 then
      box = currentBox
      box.name = boxNames[index] or ("Box " .. tostring(index))
      box.capacity = BOX_CAPACITY
      box.isCurrent = true
    else
      box = parse_pc_box_record(offset, boxNames[index] or ("Box " .. tostring(index)))
      if box then
        box.isCurrent = isCurrentSlot
      end
    end

    if box then table.insert(boxes, box) end
  end

  if #boxes > 0 then return boxes end

  local offset = BOX_SCAN_START

  while offset <= BOX_SCAN_END and #boxes < 14 do
    local dynamicIndex = #boxes + 1
    local box = parse_pc_box_record(offset, boxNames[dynamicIndex] or ("Box " .. tostring(dynamicIndex)))
    if box then
      box.isCurrent = currentBoxIndex ~= nil and (currentBoxIndex + 1) == dynamicIndex
      table.insert(boxes, box)
      offset = offset + BOX_RECORD_SIZE
    else
      offset = offset + 1
    end
  end

  if #boxes > 0 then return boxes end

  return { currentBox }
end

function read_current_pc_box()
  local count = math.min(read_sram_offset8(CURRENT_BOX_OFFSET), BOX_CAPACITY)
  local pokemon = {}

  if count <= 0 then
    return { name = "Current Box", pokemon = pokemon, capacity = BOX_CAPACITY }
  end

  for slot = 0, count - 1 do
    local species = read_sram_offset8(CURRENT_BOX_OFFSET + 1 + slot)
    if species > 0 and species < 252 then
      local pokemonDataOffset = CURRENT_BOX_OFFSET + 1 + BOX_CAPACITY + 1
      local otNamesOffset = pokemonDataOffset + (BOX_CAPACITY * BOX_MON_SIZE)
      local nicknamesOffset = otNamesOffset + (BOX_CAPACITY * NAME_SIZE)
      local mon = read_box_pokemon_at_offset(
        pokemonDataOffset + (slot * BOX_MON_SIZE),
        read_sram_offset_name(nicknamesOffset + (slot * NAME_SIZE)),
        read_sram_offset_name(otNamesOffset + (slot * NAME_SIZE))
      )
      if mon then table.insert(pokemon, mon) end
    end
  end

  return { name = "Current Box", pokemon = pokemon, capacity = BOX_CAPACITY }
end

function read_current_pc_count()
  return math.min(read_sram_offset8(CURRENT_BOX_OFFSET), BOX_CAPACITY)
end

local function read_cached_pc_data()
  if pcCache and pcCacheRemaining > 0 then
    pcCacheRemaining = pcCacheRemaining - 1
    return pcCache
  end

  local currentPcBox = read_current_pc_box()
  local pcBoxes = read_pc_boxes()
  local pcPokemonCount = 0
  for _, box in ipairs(pcBoxes) do
    pcPokemonCount = pcPokemonCount + #box.pokemon
  end

  pcCache = {
    currentPcBox = currentPcBox,
    pcBoxes = pcBoxes,
    pcPokemonCount = pcPokemonCount,
    pcBoxCount = read_current_pc_count(),
  }
  pcCacheRemaining = PC_CACHE_SNAPSHOTS
  return pcCache
end

local function snapshot()
  ensure_sram_ready()
  local offsets = get_offset_profile()
  local pcData = read_cached_pc_data()

  local status = {
    emulator = "mGBA",
    adapter = "mgba-gen2-live",
    profile = offsets.key,
    game = get_game(),
    romTitle = detectedRomTitle,
    ok = get_wram() ~= nil,
    sram = get_sram() ~= nil,
    sramHealth = lastSramHealth,
    sramReadMode = sramReadMode,
    pcBoxCount = pcData.pcBoxCount,
    currentPcBoxPokemon = #pcData.currentPcBox.pokemon,
    pcBoxes = #pcData.pcBoxes,
    pcBoxPokemon = pcData.pcPokemonCount,
  }

  return {
    generation = 2,
    game = get_game(),
    status = status,
    player = read_player(),
    pokedex = read_pokedex(),
    party = read_party(),
    pcBoxes = pcData.pcBoxes,
    bag = read_bag(),
    location = read_location(),
  }
end

local function snapshot_json(dumpOverride)
  local body = json(snapshot())
  if should_dump_snapshot(dumpOverride) then
    local ok, err = write_text_file(DEBUG_SNAPSHOT_PATH, body)
    if ok then
      debugSnapshotDumped = true
      log("Wrote Gen 2 live debug snapshot to " .. DEBUG_SNAPSHOT_PATH)
    else
      log("Failed to write Gen 2 live debug snapshot: " .. tostring(err))
    end
  end
  return body
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
  log("Pokemon Emulator Tracker mGBA adapter listening on http://" .. HOST .. ":" .. PORT)
end

local function poll_server()
  if not server then start_server() end
  local client = server:accept()
  if client then
    -- Keep accept non-blocking, but reply on a blocking client socket.
    -- Non-blocking send() can frequently fail/partial-write and looks like a reset to curl/UI.
    call_if_exists(client, "settimeout", 0.5)
    local target = read_request_target(client)
    local dumpOverride = parse_dump_override(target)
    local ok, body = pcall(function() return snapshot_json(dumpOverride) end)
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
    callbacks:add("frame", poll_server)
  else
    log("Adapter started server but callbacks:add is missing; polling will not run")
  end
end
