import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(
  rootDir,
  "lib/pokemon/knowledge/sources/game-guide-sources.json"
);
const outputPath = path.join(
  rootDir,
  "lib/pokemon/knowledge/walkthrough-index.json"
);
const apiUrl = "https://bulbapedia.bulbagarden.net/w/api.php";
const requestedProfiles = new Set(
  process.argv
    .find((argument) => argument.startsWith("--profiles="))
    ?.slice("--profiles=".length)
    .split(",")
    .map((profile) => profile.trim())
    .filter(Boolean) ?? []
);

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function htmlToCompactText(html) {
  let withoutTables = html;
  let previous;
  do {
    previous = withoutTables;
    withoutTables = withoutTables.replace(
      /<(table|figure)\b[\s\S]*?<\/\1>/gi,
      " "
    );
  } while (withoutTables !== previous);

  return decodeHtml(
    withoutTables
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<span class="mw-editsection"[\s\S]*?<\/span>/gi, " ")
      .replace(/<(?:p|li|br|h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && line !== "edit ]")
    .join("\n")
    .slice(0, 1400);
}

function wikiUrl(title, anchor) {
  const encodedTitle = title
    .split("/")
    .map((segment) => encodeURIComponent(segment.replaceAll(" ", "_")))
    .join("/");
  return `https://bulbapedia.bulbagarden.net/wiki/${encodedTitle}${
    anchor ? `#${encodeURIComponent(anchor)}` : ""
  }`;
}

async function parsePage(page, prop) {
  const url = new URL(apiUrl);
  url.search = new URLSearchParams({
    action: "parse",
    page,
    prop,
    redirects: "1",
    format: "json",
    formatversion: "2",
  }).toString();
  const response = await fetch(url, {
    headers: { "User-Agent": "pokemon-emulator-tracker knowledge generator" },
  });
  if (!response.ok) {
    throw new Error(`Bulbapedia ${response.status} for ${page}`);
  }
  const payload = await response.json();
  if (payload.error || !payload.parse) {
    throw new Error(`Bulbapedia parse failed for ${page}: ${JSON.stringify(payload.error)}`);
  }
  return payload.parse;
}

function findSectionHtml(html, section, nextSection) {
  const marker = `id="${section.anchor}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return "";
  const headingStart = html.lastIndexOf("<h", markerIndex);
  const nextMarkerIndex = nextSection
    ? html.indexOf(`id="${nextSection.anchor}"`, markerIndex + marker.length)
    : -1;
  const sectionEnd =
    nextMarkerIndex >= 0 ? html.lastIndexOf("<h", nextMarkerIndex) : html.length;
  return html.slice(Math.max(headingStart, 0), sectionEnd);
}

const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
const roots = new Map();

for (const [profile, profileInfo] of Object.entries(catalog.profiles)) {
  if (requestedProfiles.size > 0 && !requestedProfiles.has(profile)) continue;
  for (const source of profileInfo.sources) {
    if (
      source.kind !== "walkthrough" ||
      !source.url.startsWith(
        "https://bulbapedia.bulbagarden.net/wiki/Walkthrough"
      )
    ) {
      continue;
    }
    const title = decodeURIComponent(new URL(source.url).pathname.slice("/wiki/".length))
      .replaceAll("_", " ");
    const root = roots.get(title) ?? {
      title,
      profiles: [],
      games: [],
      sourceUrl: source.url,
    };
    root.profiles.push(profile);
    root.games.push(profileInfo.game);
    roots.set(title, root);
  }
}

const chunks = [];
const rootRecords = [];

for (const root of roots.values()) {
  console.log(`Discovering ${root.title}`);
  const rootPage = await parsePage(root.title, "links|revid");
  const partTitles = rootPage.links
    .filter(
      (link) =>
        link.exists &&
        link.title.startsWith(`${root.title}/Part `) &&
        /\/Part \d+$/.test(link.title)
    )
    .map((link) => link.title)
    .sort(
      (left, right) =>
        Number(left.match(/Part (\d+)$/)?.[1]) -
        Number(right.match(/Part (\d+)$/)?.[1])
    );

  rootRecords.push({
    title: root.title,
    profiles: [...new Set(root.profiles)],
    games: [...new Set(root.games)],
    sourceUrl: root.sourceUrl,
    revision: rootPage.revid,
    parts: partTitles.length,
  });

  for (const partTitle of partTitles) {
    console.log(`  Parsing ${partTitle}`);
    const part = await parsePage(partTitle, "text|tocdata|revid");
    const sections = part.tocdata?.sections ?? [];
    const partNumber = Number(partTitle.match(/Part (\d+)$/)?.[1]);
    const partTopics = sections
      .filter((section) => section.tocLevel === 1)
      .map((section) => section.line);

    for (const [index, section] of sections.entries()) {
      const nextSection = sections[index + 1];
      const text = htmlToCompactText(
        findSectionHtml(part.text, section, nextSection)
      );
      if (!text) continue;
      const parent = [...sections]
        .slice(0, index)
        .reverse()
        .find((candidate) => candidate.tocLevel < section.tocLevel);

      chunks.push({
        id: `${root.profiles[0]}:bulbapedia:${partNumber}:${section.index}`,
        profiles: [...new Set(root.profiles)],
        games: [...new Set(root.games)],
        source: "Bulbapedia walkthrough",
        rootTitle: root.title,
        part: partNumber,
        partTopics,
        section: section.line,
        parentSection: parent?.line,
        depth: section.tocLevel,
        text,
        url: wikiUrl(partTitle, section.anchor),
        revision: part.revid,
      });
    }
  }
}

await fs.writeFile(
  outputPath,
  `${JSON.stringify(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      generator: "scripts/generate-pokemon-walkthrough-index.mjs",
      roots: rootRecords,
      chunks,
    },
    null,
    2
  )}\n`
);

console.log(`Generated ${chunks.length} walkthrough chunks in ${outputPath}`);
