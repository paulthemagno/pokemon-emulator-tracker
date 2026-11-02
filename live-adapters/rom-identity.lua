-- Shared read-only ROM identity/profile selection for the three mGBA adapters.
-- Header evidence identifies a layout candidate; it does not certify ROM hacks.
local directory = debug.getinfo(1, "S").source:sub(2):match("^(.*[/\\])") or "live-adapters/"
local catalog = dofile(directory .. "generated/rom-identities.lua")
local M = {}
local cachedSignature, cachedIdentity

local function ascii(emu, address, length)
  local chars = {}
  for i = 0, length - 1 do
    local byte = emu:read8(address + i)
    if byte == 0 then break end
    if byte >= 32 and byte <= 126 then chars[#chars + 1] = string.char(byte) end
  end
  return table.concat(chars)
end

function M.reset()
  cachedSignature, cachedIdentity = nil, nil
end

function M.read(emu, generation)
  local gba = generation == 3
  local title = ascii(emu, gba and 0x080000a0 or 0x134, gba and 12 or 11)
  local code = ascii(emu, gba and 0x080000ac or 0x13f, 4)
  local revision = emu:read8(gba and 0x080000bc or 0x14c)
  local globalChecksum = gba and 0 or emu:read8(0x14e) * 256 + emu:read8(0x14f)
  local signature = table.concat({generation, title, code, revision, globalChecksum,
    emu:read8(gba and 0x080000bd or 0x14d)}, ":")
  if cachedSignature == signature then return cachedIdentity end

  -- Validate the actual header before selecting a memory profile.
  local checksum = 0
  for address = (gba and 0x080000a0 or 0x134), (gba and 0x080000bc or 0x14c) do
    checksum = (checksum - emu:read8(address) - (gba and 0 or 1)) % 256
  end
  if gba then checksum = (checksum - 0x19) % 256 end
  if checksum ~= emu:read8(gba and 0x080000bd or 0x14d) then
    error("Invalid ROM header; no compatible Pokemon profile selected")
  end

  local game = (gba and catalog.gbaPrefixes or catalog.gbPrefixes)[code:sub(1, 3)]
  local language = catalog.languages[code:sub(4, 4)]
  if not gba and not game then
    local legacy = catalog.gbChecksums[string.format("%04x", globalChecksum)]
    if legacy then game, language = legacy.game, legacy.language end
  end
  local expectedGeneration = ({red=1, blue=1, yellow=1, gold=2, silver=2, crystal=2,
    ruby=3, sapphire=3, emerald=3, firered=3, leafgreen=3})[game]
  if expectedGeneration ~= generation or not language then
    error("Unsupported Pokemon ROM/language for this adapter: " .. title .. " " .. code)
  end
  -- Only reviewed Western retail revisions are selected automatically.
  if revision > (gba and (game == "ruby" or game == "sapphire") and 2 or 1) then
    error("Unsupported Pokemon ROM revision: " .. tostring(revision))
  end
  local crc32 = nil
  if emu.checksum then
    local ok, bytes = pcall(function() return emu:checksum(0) end)
    if ok and type(bytes) == "string" and #bytes == 4 then
      crc32 = bytes:gsub(".", function(c) return string.format("%02x", string.byte(c)) end)
    end
  end
  cachedIdentity = {game=game, language=language, revision=revision, romTitle=title,
    gameCode=code, crc32=crc32, matchedBy="header", key=signature .. ":" .. (crc32 or "")}
  cachedSignature = signature
  return cachedIdentity
end

function M.profile(base, identity)
  local result = {}
  for key, value in pairs(base) do result[key] = value end
  if identity.language ~= "en" then
    local override = catalog.overrides[base.key]
    for key, value in pairs(override and override.european or {}) do result[key] = value end
  end
  result.game = identity.game
  return result
end

return M
