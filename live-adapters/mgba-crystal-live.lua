-- Pokemon Save Companion live adapter for mGBA + Pokemon Crystal.
-- Load in mGBA: Tools -> Scripting... -> Load Script.
-- Then press "Start Live" in the web UI. The adapter serves http://127.0.0.1:8080/snapshot.

local PORT = 8080
local HOST = "127.0.0.1"

local PARTY_COUNT = 0xDCD7
local PARTY_MON_1 = 0xDCDF
local PARTY_NICKNAMES = 0xDE41
local PARTY_MON_SIZE = 0x30
local NAME_SIZE = 11
local BOX_MON_SIZE = 0x20
local BOX_CAPACITY = 20
local BOX_RECORD_SIZE = 1 + BOX_CAPACITY + 1 + (BOX_CAPACITY * BOX_MON_SIZE) + (BOX_CAPACITY * NAME_SIZE * 2)
local CURRENT_BOX_OFFSET = 0x2D10
local BOX_SCAN_START = 0x2400
local BOX_SCAN_END = 0x8000 - BOX_RECORD_SIZE
local BOX_OFFSETS = {
  0x4000, 0x4450, 0x48A0, 0x4CF0, 0x5140, 0x5590, 0x59E0,
  0x6000, 0x6450, 0x68A0, 0x6CF0, 0x7140, 0x7590, 0x79E0,
}
local SRAM_BANK_SIZE = 0x2000
local SRAM_WINDOW = 0xA000
local TRAINER_ID = 0xD47B
local TRAINER_NAME = 0xD47D
local PLAY_TIME = 0xD4C4
local MONEY = 0xD84F
local JOHTO_BADGES = 0xD857
local KANTO_BADGES = 0xD858
local TMS_HMS = 0xD859
local NUM_TMS = 50
local NUM_HMS = 7
local NUM_ITEMS = 0xD892
local ITEMS = 0xD893
local NUM_KEY_ITEMS = 0xD8BC
local KEY_ITEMS = 0xD8BD
local NUM_BALLS = 0xD8D7
local BALLS = 0xD8D8
local MAP_GROUP = 0xDCB5
local MAP_NUMBER = 0xDCB6
local PLAYER_Y = 0xDCB7
local PLAYER_X = 0xDCB8

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
}

local server = nil
local wram = nil
local sram = nil
local sramReadMode = "domain"
local lastSramHealth = "unknown"

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
  local memory = get_wram()
  if not memory then return 0 end
  local offset = address >= 0xC000 and address - 0xC000 or address
  local ok, value = pcall(function() return memory:read8(offset) end)
  if ok and value then return value end
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

local function read_party()
  local count = math.min(read8(PARTY_COUNT), 6)
  local party = {}

  for slot = 0, count - 1 do
    local address = PARTY_MON_1 + (slot * PARTY_MON_SIZE)
    local species = read8(address)
    if species > 0 and species < 252 then
      local nickname = read_name(PARTY_NICKNAMES + (slot * NAME_SIZE))
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

local function read_badges(byte)
  local badges = {}
  for i = 0, 7 do
    badges[i + 1] = math.floor(byte / (2 ^ i)) % 2 == 1
  end
  return badges
end

local function read_u24_le(address)
  return read8(address) + (read8(address + 1) * 0x100) + (read8(address + 2) * 0x10000)
end

local function read_player()
  local name = read_name(TRAINER_NAME)
  local id = read16be(TRAINER_ID)
  local playTimeHours = read16be(PLAY_TIME)
  local playTimeMinutes = read8(PLAY_TIME + 2)
  local playTimeSeconds = read8(PLAY_TIME + 3)
  local money = read_u24_le(MONEY)
  local johto = read8(JOHTO_BADGES)
  local kanto = read8(KANTO_BADGES)
  local badges = read_badges(johto)
  local kantoBadges = read_badges(kanto)

  for i = 1, 8 do
    badges[8 + i] = kantoBadges[i]
  end

  return {
    name = name ~= "" and name or "Live Trainer",
    id = id,
    money = money,
    badges = badges,
    playTime = {
      hours = playTimeHours,
      minutes = playTimeMinutes,
      seconds = playTimeSeconds,
    },
  }
end

local function read_location()
  local mapGroup = read8(MAP_GROUP)
  local mapNumber = read8(MAP_NUMBER)
  local y = read8(PLAYER_Y)
  local x = read8(PLAYER_X)

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
  local count = math.min(read8(NUM_KEY_ITEMS), 26)
  local items = {}

  for index = 0, count - 1 do
    local itemId = read8(KEY_ITEMS + index)
    if itemId > 0 and itemId < 0xff then
      table.insert(items, { id = itemId, quantity = 1 })
    end
  end

  return items
end

local function read_tms_hms()
  local items = {}

  for index = 0, NUM_TMS - 1 do
    local quantity = read8(TMS_HMS + index)
    if quantity > 0 then
      table.insert(items, { id = 0xbf + index, quantity = quantity })
    end
  end

  for index = 0, NUM_HMS - 1 do
    local quantity = read8(TMS_HMS + NUM_TMS + index)
    if quantity > 0 then
      table.insert(items, { id = 0xf3 + index, quantity = quantity })
    end
  end

  return items
end

local function read_bag()
  return {
    items = read_item_stack(ITEMS, NUM_ITEMS, 20),
    keyItems = read_key_items(),
    pokeballs = read_item_stack(BALLS, NUM_BALLS, 12),
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

  if #currentBox.pokemon > 0 then
    currentBox.name = "Current Box (Live)"
    table.insert(boxes, currentBox)
  end

  for index, offset in ipairs(BOX_OFFSETS) do
    local box = parse_pc_box_record(offset, "Box " .. tostring(index))
    if box then table.insert(boxes, box) end
  end

  if #boxes > 0 then return boxes end

  local offset = BOX_SCAN_START

  while offset <= BOX_SCAN_END and #boxes < 14 do
    local box = parse_pc_box_record(offset, "Box " .. tostring(#boxes + 1))
    if box then
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

local function snapshot()
  ensure_sram_ready()
  local currentPcBox = read_current_pc_box()
  local pcBoxes = read_pc_boxes()
  local pcPokemonCount = 0
  for _, box in ipairs(pcBoxes) do
    pcPokemonCount = pcPokemonCount + #box.pokemon
  end

  local status = {
    emulator = "mGBA",
    adapter = "mgba-crystal-live",
    ok = get_wram() ~= nil,
    sram = get_sram() ~= nil,
    sramHealth = lastSramHealth,
    sramReadMode = sramReadMode,
    pcBoxCount = read_current_pc_count(),
    currentPcBoxPokemon = #currentPcBox.pokemon,
    pcBoxes = #pcBoxes,
    pcBoxPokemon = pcPokemonCount,
  }

  return {
    generation = 2,
    game = "crystal",
    status = status,
    player = read_player(),
    party = read_party(),
    pcBoxes = pcBoxes,
    bag = read_bag(),
    location = read_location(),
  }
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
  server = socket.tcp()
  call_if_exists(server, "settimeout", 0)
  call_if_exists(server, "setblocking", false)
  server:bind(HOST, PORT)
  server:listen(5)
  log("Pokemon Save Companion mGBA adapter listening on http://" .. HOST .. ":" .. PORT)
end

local function poll_server()
  if not server then start_server() end
  local client = server:accept()
  if client then
    call_if_exists(client, "settimeout", 0)
    call_if_exists(client, "setblocking", false)
    local ok, body = pcall(function() return json(snapshot()) end)
    if ok then
      send(client, "200 OK", body)
    else
      log("Snapshot error: " .. tostring(body))
      send(client, "500 Internal Server Error", error_json(body))
    end
    close_client(client)
  end
end

start_server()
callbacks:add("frame", poll_server)
