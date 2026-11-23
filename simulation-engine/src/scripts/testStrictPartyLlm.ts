import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { LlmError, ollamaGenerateStrict } from "../engine/llm.js";
import { BrutalGameMaster } from "../engine/rpg/BrutalGM.js";
import { TaggedObject } from "../engine/rpg/TagMatrixEngine.js";

async function main() {
  console.log("=== Testing Strict AI Party LLM Error Handling ===");

  const prevStoryLlm = process.env.STORY_LLM;
  const prevOllamaUrl = process.env.OLLAMA_URL;

  try {
    // 1. ollamaGenerateStrict throws LlmError when STORY_LLM=off
    process.env.STORY_LLM = "off";
    await assert.rejects(
      () => ollamaGenerateStrict("Say hi", { stage: "party_intent" }),
      (err: any) => {
        assert.ok(err instanceof LlmError, `Expected LlmError, got ${err}`);
        assert.equal(err.stage, "party_intent");
        assert.match(err.message, /STORY_LLM=off/);
        return true;
      }
    );
    console.log("1. ollamaGenerateStrict refuses STORY_LLM=off with LlmError... PASSED");

    // 2. ollamaGenerateStrict throws LlmError with unreachable URL reason when enabled
    process.env.STORY_LLM = "";
    process.env.OLLAMA_URL = "http://127.0.0.1:1";
    await assert.rejects(
      () => ollamaGenerateStrict("Say hi", { stage: "party_intent", timeoutMs: 2000 }),
      (err: any) => {
        assert.ok(err instanceof LlmError, `Expected LlmError, got ${err}`);
        assert.equal(err.stage, "party_intent");
        assert.match(err.message, /127\.0\.0\.1:1/);
        return true;
      }
    );
    console.log("2. ollamaGenerateStrict throws LlmError on unreachable Ollama... PASSED");

    // 3. BrutalGameMaster.executeTurn({ strictLlm: true }) throws LlmError at stage 'intent_parse'
    const gm = new BrutalGameMaster(pool);
    const prop: TaggedObject = {
      id: "prop_test_crate",
      name: "Test Supply Crate",
      type: "PROP",
      pos: [128, 128],
      tags: new Set(["wood", "crate"]),
      hp: 20,
      maxHp: 20,
      isDestroyed: false,
      description: "Wooden crate"
    };
    gm.activeProps.set(prop.id, prop);

    await assert.rejects(
      () =>
        gm.executeTurn({
          actionText: "I inspect the Test Supply Crate",
          playerId: 101,
          playerName: "Harrow Grist",
          playerPos: [128, 128],
          strictLlm: true
        }),
      (err: any) => {
        assert.ok(err instanceof LlmError, `Expected LlmError, got ${err}`);
        assert.equal(err.stage, "intent_parse");
        return true;
      }
    );
    console.log("3. BrutalGameMaster.executeTurn(strictLlm=true) fails loudly at intent_parse... PASSED");

    // 4. Non-strict offline mode still works for automated deterministic tests (STORY_LLM=off)
    process.env.STORY_LLM = "off";
    const nonStrictOut = await gm.executeTurn({
      actionText: "I inspect the Test Supply Crate",
      playerId: 101,
      playerName: "Harrow Grist",
      playerPos: [128, 128],
      strictLlm: false
    });
    assert.ok(nonStrictOut && typeof nonStrictOut.narrativeResponse === "string", "Non-strict offline mode should still return narrativeResponse");
    console.log("4. BrutalGameMaster.executeTurn(strictLlm=false) offline test path preserved... PASSED");

    console.log("ALL STRICT PARTY LLM TESTS PASSED");
  } finally {
    if (prevStoryLlm === undefined) delete process.env.STORY_LLM;
    else process.env.STORY_LLM = prevStoryLlm;
    if (prevOllamaUrl === undefined) delete process.env.OLLAMA_URL;
    else process.env.OLLAMA_URL = prevOllamaUrl;
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
