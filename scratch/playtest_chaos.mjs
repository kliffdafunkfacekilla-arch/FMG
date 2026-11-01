import http from "node:http";

const BASE_URL = "http://127.0.0.1:3000";

async function post(path, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      `${BASE_URL}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, text: data });
          }
        });
      }
    );
    req.on("error", (err) => resolve({ status: 500, error: err.message }));
    req.write(payload);
    req.end();
  });
}

async function get(path) {
  return new Promise((resolve) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, text: data });
        }
      });
    }).on("error", (err) => resolve({ status: 500, error: err.message }));
  });
}

async function runChaosPlaytest() {
  console.log("=================================================================");
  console.log("   AETHERIA / CONCORDIA CHAOTIC & NON-RULE-FOLLOWING PLAYTEST   ");
  console.log("=================================================================\n");

  const findings = [];

  // ---------------------------------------------------------------------------
  // TEST 1: LOAD SECTORS UNDER EXTREME CONDITIONS
  // ---------------------------------------------------------------------------
  console.log(">>> [1/7] Testing Sector Loading with Extreme / Inverted Contexts...");
  const load1 = await post("/api/dm/sector_load", {
    cellId: 99999999,
    rx: -50,
    ry: 1000,
    biomeName: "NonExistentVoidBiome",
    isWarzone: true,
    isFamine: true,
    chaosRadiation: 9999.9,
    infrastructureMask: 255
  });
  console.log("  Sector load (Extreme/Out of bounds):", load1.status, load1.data?.props?.length ? `${load1.data.props.length} props` : "ok");
  if (load1.status >= 500) findings.push({ test: "Sector Load Out-of-Bounds", issue: "Server returned 500", detail: load1 });

  const loadNormal = await post("/api/dm/sector_load", {
    cellId: 13408,
    rx: 0,
    ry: 0,
    biomeName: "Wetland Swamp",
    isWarzone: false,
    isFamine: false,
    infrastructureMask: 14
  });
  console.log("  Sector load (Cell 13408):", loadNormal.status, `Props: ${loadNormal.data?.props?.length || 0}`, `NPCs: ${loadNormal.data?.npcs?.length || 0}`);
  const props = loadNormal.data?.props || [];
  const npcs = loadNormal.data?.npcs || [];

  // ---------------------------------------------------------------------------
  // TEST 2: CHARACTER CREATION MUTATION & MALFORMED INPUTS
  // ---------------------------------------------------------------------------
  console.log("\n>>> [2/7] Testing Malformed / Extreme Character Creation...");
  const charTests = [
    { name: "Empty Body", payload: {} },
    { name: "Negative & Infinite Stats", payload: { name: "VoidLord", might: -50, reflex: 999999, gold: -1000, species: "Human" } },
    { name: "SQL Injection Name", payload: { name: "Robert'); DROP TABLE sim_player_character;--", species: "Human", might: 10 } },
    { name: "Huge 100kb Name", payload: { name: "A".repeat(100000), species: "Human" } }
  ];

  for (const ct of charTests) {
    const res = await post("/api/character/create", ct.payload);
    console.log(`  Character Create [${ct.name}]: Status ${res.status}`);
    if (res.status >= 500) {
      findings.push({ test: `Character Create (${ct.name})`, issue: `Status ${res.status}`, detail: res.data || res.text });
    }
  }

  // Create valid player character
  const validChar = await post("/api/character/create", {
    name: "Sir Flute-Botherer",
    species: "Human",
    lineage: "Ironborn",
    institution: "Guild",
    might: 7,
    endurance: 6,
    finesse: 7,
    reflex: 6,
    vitality: 7,
    fortitude: 6,
    knowledge: 5,
    logic: 5,
    awareness: 6,
    intuition: 6,
    charm: 8,
    willpower: 6,
    inventory: ["Steel Arming Sword", "Wooden Flute", "Smuggler Key", "Moldy Bread", "Flask of Acid"]
  });
  const playerId = validChar.data?.character?.id || 1;
  console.log("  Player Character active with ID:", playerId);

  // ---------------------------------------------------------------------------
  // TEST 3: BIZARRE, NONSENSICAL, SURREAL & WEIRD ACTIONS
  // ---------------------------------------------------------------------------
  console.log("\n>>> [3/7] Testing Surreal, Rule-Breaking & Nonsensical Player Actions...");

  const weirdActions = [
    // Flirting / social with inanimate props
    "I passionately confess my undying love to the stone wall and ask it to marry me",
    "I try to bribe the heavy wooden door with 15 gold to open itself",
    "I interrogate the iron lock about its traumatic childhood memories",
    // Inverted survival & cannibalism
    "I attempt to eat my own Osmium Greatsword for breakfast",
    "I lick the puddle of bubbling caustic acid to see what dragon flavor it is",
    "I harvest the flesh of the local guard captain to make soup",
    // Chaotic magic on absurd targets
    "I cast fireball directly into the bottom of the deep water well",
    "I channel divine holy radiance to exorcise the table leg",
    // Hyper-boring & pedantic roleplay
    "I stand completely still for seven hours counting the individual grains of dirt between my boots",
    "I politely discuss the municipal tax bracket of wheat bushels with the corpse",
    "I file a bureaucratic complaint with the swamp mosquito about its noise violation",
    // Aggression on absurd things
    "I slash my own left boot with my dagger to punish it for stumbling",
    "I wrestle the campfire into submission using raw brute might",
    // Creative non-violent boundary testing
    "I play a soothing bedtime lullaby on my flute to put the enraged Briar Bear to sleep",
    "I juggle three burning torches while reciting ancient elven tax law",
    // Empty & malformed inputs
    "",
    "   ",
    "???!!?!?!@#$%^&*()_+{}[]",
    "SELECT * FROM sim_player_character WHERE 1=1;",
    "A".repeat(5000),
    "𓀀 𓀁 𓀂 𓀃 𓀄 𓀅 𓀆 𓀇 𓀈 𓀉 𓀊 𓀋 𓀌 𓀍 𓀎 𓀏 𓀐 𓀑 𓀒 𓀓 𓀔 𓀕 𓀖 𓀗 𓀘 𓀙 𓀚 𓀛 𓀜 𓀝 𓀞 𓀟 𓀠 𓀡 𓀢 𓀣 𓀤 𓀥 𓀦 𓀧 𓀨 𓀩 𓀪"
  ];

  for (const act of weirdActions) {
    const actDisplay = act.length > 50 ? act.substring(0, 47) + "..." : act;
    const res = await post("/api/dm/action", {
      actionText: act,
      playerId,
      playerPos: [128, 128]
    });

    const isOk = res.status === 200;
    const logSummary = res.data?.systemLog || (res.data?.error ? `Error: ${res.data.error}` : `Status ${res.status}`);
    console.log(`  Action: "${actDisplay || '<EMPTY>'}"`);
    console.log(`    -> Status: ${res.status} | Success: ${res.data?.success} | Intent: [${res.data?.intent?.verb || 'N/A'}] | Log: ${logSummary.substring(0, 80)}...`);

    if (res.status >= 500) {
      findings.push({
        test: "Weird Action Crash",
        action: actDisplay,
        issue: `Returned 500: ${res.data?.error || res.text}`
      });
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 4: CONCURRENCY & SPAM FLOODING
  // ---------------------------------------------------------------------------
  console.log("\n>>> [4/7] Testing Rapid Action Spam & Concurrency Flood (20 Concurrent Actions)...");
  const spamPromises = [];
  for (let i = 0; i < 20; i++) {
    spamPromises.push(
      post("/api/dm/action", {
        actionText: `Spam action #${i}: I dodge and roll across the cobblestones`,
        playerId,
        playerPos: [128 + i, 128]
      })
    );
  }
  const spamResults = await Promise.all(spamPromises);
  const spamSuccesses = spamResults.filter((r) => r.status === 200).length;
  const spamFailures = spamResults.filter((r) => r.status !== 200);
  console.log(`  Spam flood finished: ${spamSuccesses}/20 succeeded (${spamFailures.length} failed)`);
  if (spamFailures.length > 0) {
    findings.push({
      test: "Spam Concurrency Flood",
      issue: `${spamFailures.length} requests failed`,
      sampleError: spamFailures[0]
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 5: INTERACTING WITH LIVE SECTOR PROPS & NPCS
  // ---------------------------------------------------------------------------
  console.log("\n>>> [5/7] Testing Targeted Interactions on Live Sector Props & NPCs...");
  if (props.length > 0 || npcs.length > 0) {
    for (const prop of props.slice(0, 4)) {
      console.log(`  Testing prop '${prop.name}' (tags: ${prop.tags.join(", ")})`);
      const actionsToTry = [
        `I ignite the ${prop.name} with a torch`,
        `I attempt to pick the lock on the ${prop.name}`,
        `I smash the ${prop.name} with my heavy hammer`,
        `I pour acid over the ${prop.name}`,
        `I cast freezing ice on the ${prop.name}`
      ];
      for (const a of actionsToTry) {
        const res = await post("/api/dm/action", { actionText: a, playerId, playerPos: [128, 128] });
        console.log(`    [${a.split(" ")[1].toUpperCase()}]: Status ${res.status} | Log: ${res.data?.systemLog?.substring(0, 70)}...`);
        if (res.status >= 500) findings.push({ test: "Prop Interaction Crash", prop: prop.name, action: a, error: res.data });
      }
    }

    for (const npc of npcs.slice(0, 3)) {
      console.log(`  Testing NPC '${npc.name}' (role: ${npc.role}, tags: ${npc.tags.join(", ")})`);
      const npcActions = [
        `I ask ${npc.name} about the rumors in this province`,
        `I attempt to intimidate ${npc.name} into giving me their coin`,
        `I bribe ${npc.name} with 10 gold coins`,
        `I attempt to pickpocket ${npc.name}`,
        `I cast a healing blessing on ${npc.name}`
      ];
      for (const a of npcActions) {
        const res = await post("/api/dm/action", { actionText: a, playerId, playerPos: [128, 128] });
        console.log(`    [${a.split(" ")[1].toUpperCase()}]: Status ${res.status} | Disp: ${res.data?.disposition || 'N/A'} | Log: ${res.data?.systemLog?.substring(0, 70)}...`);
        if (res.status >= 500) findings.push({ test: "NPC Interaction Crash", npc: npc.name, action: a, error: res.data });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 6: BARTER & TRADE EXPLOITS
  // ---------------------------------------------------------------------------
  console.log("\n>>> [6/7] Testing Commerce & Barter Exploits...");
  const catalogRes = await get("/api/dm/trade/catalog?burgId=1");
  console.log("  Trade Catalog Status:", catalogRes.status, `Items: ${catalogRes.data?.catalog?.length || 0}`);

  const tradeExploits = [
    { name: "Buy with Negative Quantity", payload: { playerId, burgId: 1, itemId: "food_ration", quantity: -10 } },
    { name: "Buy Non-Existent Item", payload: { playerId, burgId: 1, itemId: "DOES_NOT_EXIST_XYZ_999", quantity: 1 } },
    { name: "Buy with 0 Quantity", payload: { playerId, burgId: 1, itemId: "food_ration", quantity: 0 } },
    { name: "Buy 9999999 Items (Exceed Gold)", payload: { playerId, burgId: 1, itemId: "food_ration", quantity: 9999999 } },
    { name: "Sell Item Not in Pack", payload: { playerId, burgId: 1, itemId: "Dragon_Scale_Crown_Of_Doom", quantity: 1 } },
    { name: "Sell with Negative Quantity", payload: { playerId, burgId: 1, itemId: "Steel Arming Sword", quantity: -5 } }
  ];

  for (const te of tradeExploits) {
    const isBuy = te.name.startsWith("Buy");
    const path = isBuy ? "/api/dm/trade/buy" : "/api/dm/trade/sell";
    const res = await post(path, te.payload);
    console.log(`  Trade [${te.name}]: Status ${res.status} | Res: ${JSON.stringify(res.data || res.text).substring(0, 60)}...`);
    if (res.status >= 500) {
      findings.push({ test: `Trade Exploit Crash (${te.name})`, issue: "Server returned 500", detail: res.data || res.text });
    }
    if (res.status === 200 && res.data?.success && (te.payload.quantity < 0 || te.payload.quantity === 0)) {
      findings.push({
        test: `Economy Duplication Vulnerability (${te.name})`,
        issue: "Server accepted negative or zero quantity trade!",
        payload: te.payload,
        response: res.data
      });
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 7: INCAPACITATION & PERMADEATH BOUNDARY TESTING
  // ---------------------------------------------------------------------------
  console.log("\n>>> [7/7] Testing Incapacitation, 0 HP & Permadeath Boundaries...");
  const poolMod = await import("../simulation-engine/dist/db/pool.js");
  const pool = poolMod.default?.default || poolMod.default || poolMod;
  await pool.query("UPDATE sim_player_character SET current_hp = 0 WHERE id = $1", [playerId]);

  const actAt0HP = await post("/api/dm/action", {
    actionText: "I attempt to run away while unconscious",
    playerId,
    playerPos: [128, 128]
  });
  console.log("  Action at 0 HP:", actAt0HP.status, `Success: ${actAt0HP.data?.success}`, `Log: ${actAt0HP.data?.systemLog}`);
  if (actAt0HP.data?.success === true) {
    findings.push({ test: "0 HP Action Exploit", issue: "Player succeeded in an action while unconscious at 0 HP" });
  }

  const reviveRes = await post("/api/dm/player/revive", { playerId });
  console.log("  Revive Player Status:", reviveRes.status, `Current HP: ${reviveRes.data?.character?.current_hp}`);

  // ---------------------------------------------------------------------------
  // SUMMARY OF FINDINGS
  // ---------------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log(`   CHAOS PLAYTEST COMPLETE: ${findings.length} POTENTIAL ANOMALIES FOUND`);
  console.log("=================================================================\n");
  findings.forEach((f, idx) => {
    console.log(`[ANOMALY #${idx + 1}] ${f.test}: ${f.issue || JSON.stringify(f)}`);
  });

  await pool.end();
}

runChaosPlaytest().catch(console.error);
