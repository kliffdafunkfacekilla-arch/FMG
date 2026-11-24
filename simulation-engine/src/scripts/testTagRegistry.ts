import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { facts, factTags } from "../engine/facts/facts.js";
import { ALL_REGISTERED_TAGS, getTagGroup, isRegisteredTag } from "../engine/facts/tagRegistry.js";

function walkTsFiles(dir: string, out: string[]): void {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkTsFiles(full, out);
    } else if (ent.isFile() && ent.name.endsWith(".ts") && ent.name !== "tagRegistry.ts") {
      out.push(full);
    }
  }
}

function main() {
  console.log("=== Testing Facts Predicates & Canonical Tag Registry (Phase 6) ===");

  // 1. Verify pure simulation boundary on engine/facts/ (Rule 8)
  const factsDir = path.resolve(__dirname, "../../src/engine/facts");
  for (const file of fs.readdirSync(factsDir)) {
    if (!file.endsWith(".ts")) continue;
    const src = fs.readFileSync(path.join(factsDir, file), "utf8");
    assert.ok(!/from\s+['"][^'"]*(?:db|api|public)\//.test(src), `${file} violates Rule 8 purity by importing db/api/public`);
  }
  console.log("1. engine/facts/ maintains strict pure simulation boundary (Rule 8)... PASSED");

  // 2. Verify facts predicates and derived tag generation (no hard-coded #GuildDominance)
  const famished = { food: 100, wealth: 500, unrest: 65 };
  assert.equal(facts.famine(famished), true);
  assert.equal(facts.grainShortage(famished), false);
  assert.equal(facts.martialLaw(famished), true);
  assert.equal(facts.guildDominance(famished), false);
  assert.equal(facts.garrisonStrength(famished), "HIGH");

  const famishedOut = factTags(famished);
  assert.deepEqual(famishedOut.econTags, ["#Famine", "#ResourceScarcity"]);
  assert.ok(famishedOut.factionTags.includes("#MartialLaw"));
  assert.ok(famishedOut.factionTags.includes("#UndergroundUnrest"));
  assert.ok(!famishedOut.factionTags.includes("#GuildDominance"), "Poor/martial burg must not emit #GuildDominance");

  const booming = { food: 950, wealth: 9000, unrest: 10 };
  const boomingOut = factTags(booming);
  assert.deepEqual(boomingOut.econTags, ["#HarvestAbundance", "#CommercialBoom"]);
  assert.deepEqual(boomingOut.factionTags, ["#GuildDominance"]);

  const blockadedOut = factTags(booming, ["#CompassEmbargo"]);
  assert.ok(blockadedOut.econTags.includes("#TradeBlockade"));
  assert.ok(blockadedOut.econTags.includes("#MarketCollapse"));
  assert.ok(!blockadedOut.econTags.includes("#CommercialBoom"));
  console.log("2. facts predicates & factTags() replace hard-coded thresholds cleanly... PASSED");

  // 3. Scan src/{engine,api,worker} for every uppercase #Tag string literal
  const srcRoot = path.resolve(__dirname, "../../src");
  const scanRoots = [
    path.join(srcRoot, "engine"),
    path.join(srcRoot, "api"),
    path.join(srcRoot, "worker"),
  ];
  const files: string[] = [];
  for (const r of scanRoots) {
    if (fs.existsSync(r)) walkTsFiles(r, files);
  }

  const missing: Array<{ file: string; line: number; tag: string }> = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const cleaned = raw
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
    const strRe = /(['"`])(?:\\.|(?!\1)[^\\])*\1/g;
    let m: RegExpExecArray | null;
    while ((m = strRe.exec(cleaned)) !== null) {
      const lit = m[0];
      const tagRe = /#[A-Z][A-Za-z0-9_:-]*/g;
      let tm: RegExpExecArray | null;
      while ((tm = tagRe.exec(lit)) !== null) {
        const tag = tm[0];
        if (/^#[0-9A-F]{3}([0-9A-F]{3})?([0-9A-F]{2})?$/.test(tag)) continue;
        if (!isRegisteredTag(tag)) {
          const line = cleaned.slice(0, m.index).split("\n").length;
          missing.push({ file: path.relative(srcRoot, file).replace(/\\/g, "/"), line, tag });
        }
      }
    }
  }

  assert.equal(
    missing.length,
    0,
    `Found ${missing.length} unregistered #Tag literal(s):\n` +
      missing.slice(0, 25).map((x) => `  - ${x.file}:${x.line} ${x.tag}`).join("\n")
  );
  assert.ok(ALL_REGISTERED_TAGS.size >= 900);
  assert.equal(getTagGroup("#Famine"), "derived");
  assert.equal(getTagGroup("#SealedCrimeScene"), "history");
  assert.equal(getTagGroup("#Want_HoardWealth"), "motive");
  assert.equal(getTagGroup("#Flammable"), "reaction");
  console.log(`3. Audited ${files.length} source files against ${ALL_REGISTERED_TAGS.size} registered tags (0 unregistered)... PASSED`);

  console.log("\nALL TAG REGISTRY & FACTS TESTS PASSED");
}

main();
