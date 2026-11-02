import test from "node:test";
import assert from "node:assert/strict";

// Execute the production Lua with a simulated read-only mGBA bus.
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = require("fengari");

function runLua(code: string) {
  const state = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(state);
  try {
    const status = lauxlib.luaL_dostring(state, to_luastring(code));
    assert.equal(status, lua.LUA_OK, status ? to_jsstring(lua.lua_tostring(state, -1)) : undefined);
  } finally {
    lua.lua_close(state);
  }
}

const bus = `
local bytes = {}
local hashReads = 0
local emu = { read8 = function(_, a) return bytes[a] or 0 end,
  checksum = function() hashReads = hashReads + 1; return string.char(1,2,3,4) end }
local function header(gba, code, revision, globalChecksum)
  bytes = {}
  local a = gba and 0x080000ac or 0x13f
  for i = 1, #code do bytes[a+i-1] = code:byte(i) end
  bytes[gba and 0x080000bc or 0x14c] = revision or 0
  bytes[0x14e] = math.floor((globalChecksum or 0) / 256)
  bytes[0x14f] = (globalChecksum or 0) % 256
  local c = 0
  for i = (gba and 0x080000a0 or 0x134), (gba and 0x080000bc or 0x14c) do
    c = (c - (bytes[i] or 0) - (gba and 0 or 1)) % 256
  end
  bytes[gba and 0x080000bd or 0x14d] = (c - (gba and 0x19 or 0)) % 256
end
local M = dofile("live-adapters/rom-identity.lua")
`;

test("live ROM identity recognizes all Western GBA titles and selects localized RAM profiles", () => {
  runLua(bus + `
  local expected = { AXV="ruby", AXP="sapphire", BPE="emerald", BPR="firered", BPG="leafgreen" }
  local languages = {E="en", I="it", D="de", F="fr", S="es"}
  local profiles = dofile("live-adapters/generated/gen3-live-offsets.lua").profiles
  for prefix, game in pairs(expected) do
    for suffix, language in pairs(languages) do
      header(true, prefix .. suffix)
      local identity = M.read(emu, 3)
      assert(identity.game == game and identity.language == language)
      assert(identity.crc32 == "01020304")
      local key = game == "emerald" and "emerald"
        or (game == "firered" or game == "leafgreen") and "fire_red_leaf_green" or "ruby_sapphire"
      local p = M.profile(profiles[key], identity)
      if key == "ruby_sapphire" then
        assert(p.activeParty == (language == "en" and 0x03004360 or 0x03004370))
      elseif key == "fire_red_leaf_green" then
        assert(p.saveBlock1Ptr == (language == "en" and 0x03005008 or 0x03004f58))
      else assert(p.activePartyCandidates[1] == 0x020244ec) end
      assert(profiles[key].key == key) -- Never mutate the generated base profile.
    end
  end
  `);
});

test("live identity supports Western GB product codes and legacy Red/Blue checksums", () => {
  runLua(bus + `
  for suffix, language in pairs({E="en",I="it",D="de",F="fr",S="es"}) do
    for prefix, game in pairs({APS="yellow",AAU="gold",AAX="silver",BYT="crystal"}) do
      header(false, prefix .. suffix)
      local identity = M.read(emu, game == "yellow" and 1 or 2)
      assert(identity.game == game and identity.language == language)
    end
  end
  for checksum, game in pairs({[0x89d2]="red",[0x5e9c]="blue"}) do
    header(false, "", 0, checksum)
    local identity = M.read(emu, 1)
    assert(identity.game == game and identity.language == "it")
    local base = dofile("live-adapters/generated/gen1-live-offsets.lua").profiles.red_blue
    local p = M.profile(base, identity)
    assert(p.playerName == 0xd15d and p.partyCount == 0xd168 and p.currentMap == 0xd363)
    assert(base.playerName == 0xd158)
  end
  `);
});

test("live identity rejects wrong adapters, unknown languages and corrupt headers; reloads same-title language/revision changes", () => {
  runLua(bus + `
  header(true, "BPGE")
  local en = M.read(emu, 3)
  M.read(emu, 3)
  assert(hashReads == 1)
  header(true, "BPGI")
  local it = M.read(emu, 3)
  assert(en.key ~= it.key and hashReads == 2)
  header(true, "BPGI", 1)
  assert(M.read(emu, 3).key ~= it.key)
  M.reset()
  M.read(emu, 3)
  assert(hashReads == 4)
  header(true, "BPGJ")
  assert(not pcall(M.read, emu, 3))
  header(true, "BPGI")
  assert(not pcall(M.read, emu, 2))
  bytes[0x080000bd] = 99
  assert(not pcall(M.read, emu, 3))
  header(true, "ZZZE")
  assert(not pcall(M.read, emu, 3))
  `);
});

test("all mGBA adapter scripts compile and register lifecycle callbacks", () => {
  for (const generation of [1, 2, 3]) {
    // Exercise loading and initialization without opening sockets or running a ROM.
    runLua(`
    local registered = {}
    console = {log=function() end}
    callbacks = {add=function(_, event, fn) registered[event] = fn end}
    emu = {}
    socket = {tcp=function() return {bind=function() end, listen=function() end} end}
    dofile("live-adapters/mgba-gen${generation}-live.lua")
    assert(registered.frame and registered.start and registered.reset)
    registered.start()
    registered.reset()
    `);
  }
});

test("production adapters reselect profiles on same-title language changes and reject unknown games", () => {
  for (const generation of [1, 2, 3]) {
    runLua(bus + `
    _G.emu = emu
    local registered = {}
    console = {log=function() end}
    callbacks = {add=function(_, event, fn) registered[event] = fn end}
    socket = {tcp=function() return {bind=function() end, listen=function() end} end}
    dofile("live-adapters/mgba-gen${generation}-live.lua")
    local function find(fn, wanted, seen)
      seen = seen or {}
      if seen[fn] then return nil end
      seen[fn] = true
      for i = 1, 100 do
        local name, value = debug.getupvalue(fn, i)
        if not name then break end
        if name == wanted then return value end
        if type(value) == "function" then
          local found = find(value, wanted, seen)
          if found then return found end
        end
      end
    end
    local profile = find(registered.frame, "${generation === 3 ? "get_profile" : "get_offset_profile"}")
    assert(profile, "Cannot reach the adapter profile selection")
    header(${generation === 3}, "${generation === 3 ? "BPGE" : generation === 2 ? "BYTE" : "APSE"}")
    local english = profile()
    header(${generation === 3}, "${generation === 3 ? "BPGI" : generation === 2 ? "BYTI" : "APSI"}")
    local italian = profile()
    assert(english ~= italian)
    ${generation === 3 ? 'assert(english.saveBlock1Ptr == 0x03005008 and italian.saveBlock1Ptr == 0x03004f58)' : generation === 1 ? 'assert(english.playerName == 0xd157 and italian.playerName == 0xd15c)' : 'assert(english.trainerName == italian.trainerName)'}
    registered.reset()
    assert(profile() ~= italian)
    header(${generation === 3}, "ZZZE")
    assert(not pcall(profile))
    `);
  }
});
