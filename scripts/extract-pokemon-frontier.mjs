// Reproduce Emerald Frontier offsets from the project's pinned PRET checkout.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const commit = '0d3100185e0b13faabfc589fc402dd46f83c1d6a';
const root = path.resolve('.');
const source = process.argv[2] ?? path.join(root, '.cache/pokemon-source', `pokeemerald-${commit}`);
if (execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== commit) throw new Error('PRET checkout does not match pinned commit');
const header = await fs.readFile(path.join(source, 'include/global.h'), 'utf8');
const constants = await fs.readFile(path.join(source, 'include/constants/frontier_util.h'), 'utf8');
const offset = name => {
  const match = header.match(new RegExp(`/\\*0x([A-Fa-f0-9]+)\\*/[^\\n]*\\b${name}\\b`));
  if (!match) throw new Error(`Missing field ${name}`);
  return parseInt(match[1], 16);
};
const definitions = [
  ['tower', 'towerWinStreaks', 'towerRecordWinStreaks', ['SINGLES', 'DOUBLES', 'MULTIS', 'LINK_MULTIS'], 'wins'],
  ['dome', 'domeWinStreaks', 'domeRecordWinStreaks', ['SINGLES', 'DOUBLES'], 'tournaments'],
  ['palace', 'palaceWinStreaks', 'palaceRecordWinStreaks', ['SINGLES', 'DOUBLES'], 'wins'],
  ['arena', 'arenaWinStreaks', 'arenaRecordStreaks', [''], 'wins'],
  ['factory', 'factoryWinStreaks', 'factoryRecordWinStreaks', ['SINGLES', 'DOUBLES'], 'wins'],
  ['pike', 'pikeWinStreaks', 'pikeRecordStreaks', [''], 'rooms'],
  ['pyramid', 'pyramidWinStreaks', 'pyramidRecordStreaks', [''], 'floors'],
];
const frontierUtil = await fs.readFile(path.join(source, 'src/frontier_util.c'), 'utf8');
const brainTable = frontierUtil.match(/sFrontierBrainStreakAppearances[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1];
if (!brainTable || !frontierUtil.includes('if (battleMode != FRONTIER_MODE_SINGLES)')) throw new Error('Review Brain encounter conditions');
const facilities = definitions.map(([id, current, record, modes, unit]) => ({
  id, current: offset(current), record: offset(record), unit,
  symbolTargets: (() => {
    const row = brainTable.match(new RegExp(`FRONTIER_FACILITY_${id.toUpperCase()}\\]\\s*=\\s*\\{\\s*(\\d+),\\s*(\\d+)`));
    if (!row) throw new Error(`Missing Brain thresholds for ${id}`);
    // Dome checks completed tournaments before entering the next (5th/10th) tournament.
    const adjustment = id === 'dome' ? 1 : 0;
    return { silver: Number(row[1]) + adjustment, gold: Number(row[2]) + adjustment, mode: 'singles' };
  })(),
  modes: modes.map(mode => ({ id: mode.toLowerCase() || 'singles', masks: ['50', 'OPEN'].map(level => {
    const symbol = ['STREAK', id.toUpperCase(), mode, level].filter(Boolean).join('_');
    const match = constants.match(new RegExp(`#define ${symbol} +\\(1 << (\\d+)\\)`));
    if (!match) throw new Error(`Missing ${symbol}`);
    return 2 ** Number(match[1]);
  }) })),
}));
const data = { sourceKind: 'pret', sourceName: 'pret/pokeemerald', game: 'emerald', extractedAt: new Date().toISOString(), sourceCommit: commit,
  sourceUrl: `https://github.com/pret/pokeemerald/tree/${commit}`,
  sourceFiles: ['include/global.h', 'include/constants/frontier_util.h', 'include/constants/flags.h', 'src/frontier_util.c'],
  generator: 'scripts/extract-pokemon-frontier.mjs', start: offset('winStreakActiveFlags'),
  end: offset('battlePoints') + 2, battlePoints: offset('battlePoints'), facilities };
await fs.writeFile('lib/pokemon/knowledge/sources/frontier-layout.json', JSON.stringify(data, null, 2) + '\n');
const layoutsPath = 'lib/pokemon/knowledge/sources/save-layouts.json';
const layouts = JSON.parse(await fs.readFile(layoutsPath, 'utf8'));
layouts.gen3.emerald.offsets.frontierStart = data.start;
layouts.gen3.emerald.offsets.frontierEnd = data.end;
await fs.writeFile(layoutsPath, JSON.stringify(layouts, null, 2) + '\n');
