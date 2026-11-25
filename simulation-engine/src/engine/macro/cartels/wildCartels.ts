import { pickShuffled, type CartelRunContext, type WorkingCartel } from "./types.js";

/**
 * 5. The Ghostwind Raiders: Single covert lair, seasonal dead drops & phantom strikes.
 */
export function stepGhostwind(cartel: WorkingCartel, ctx: CartelRunContext): void {
  const { snap, deltas } = ctx;
  const tick = snap.tick;

  const lairCount = ctx.lairCountByFaction.get(cartel.id) || 0;
  if (lairCount === 0) {
    const clanCell = cartel.originCellId || 24364;
    const clanBurg = cartel.originBurgId || 115;
    deltas.push({
      kind: "fringeLair.mutate",
      action: "upsert",
      factionId: cartel.id,
      cellId: clanCell,
      burgId: clanBurg,
      lairType: "CLAN_COVERT_COVE",
      manpower: 45,
      heat: 10,
    });
    ctx.lairCountByFaction.set(cartel.id, 1);
  }

  // A. Real Dead Drops Supplied Twice a Year (dayOfYear === 48 || 313)
  if ((snap.dayOfYear === 48 || snap.dayOfYear === 313) && snap.topPowers.length >= 4) {
    const powers = snap.topPowers;
    for (let i = 0; i < powers.length; i++) {
      const clientFaction = powers[i]!;
      const targetFaction = powers[(i + 1) % powers.length]!;
      const richTarget = snap.richestBurgByFaction[targetFaction.id];
      const fallbackBurg = snap.targetBurgs[0]
        ? { burgId: snap.targetBurgs[0].burgId, name: snap.targetBurgs[0].name }
        : null;
      const targetBurg = richTarget || fallbackBurg;
      if (targetBurg) {
        const bounty = 350;
        deltas.push({
          kind: "faction.update",
          factionId: clientFaction.id,
          treasurySet: Math.max(50, clientFaction.treasury - bounty),
        });
        deltas.push({
          kind: "ghostwindDrop.create",
          createdTick: tick,
          clientFactionId: clientFaction.id,
          targetFactionId: targetFaction.id,
          targetBurgId: targetBurg.burgId,
          bountyGold: bounty,
        });
        deltas.push({
          kind: "event.log",
          tick,
          type: "GHOSTWIND_DEAD_DROP_PLACED",
          message: `📜 REAL DEAD DROP SUPPLIED: Sovereign ministers of ${clientFaction.name} deposited a secret dead drop containing ${bounty} gold and convoy routing ciphers inside a hollow border cairn, commissioning a phantom strike on ${targetFaction.name}'s supply routes near ${targetBurg.name}! Unwittingly, all four supreme courts are supplying dead drops targeting each other in a circle.`,
          tier: "MAJOR",
          outlawId: cartel.id,
          burgId: targetBurg.burgId,
          loreDate: snap.loreDate,
        });
      }
    }
  }

  // B. Randomized Timing of Phantom Strikes
  if (snap.pendingGhostwindDrops.length > 0) {
    const lastTick = snap.lastGhostwindStrikeTick;
    const ticksSinceLast = tick - lastTick;
    const shouldStrike =
      (lastTick === 0 && tick >= 45) ||
      (ticksSinceLast >= 32 && ctx.random() < 0.18) ||
      ticksSinceLast >= 70;

    if (shouldStrike) {
      const contract = snap.pendingGhostwindDrops[0]!;
      const plunderWealth = Math.min(contract.targetBurgWealth || 200, 400);
      const plunderFood = Math.min(contract.targetBurgFood || 150, 250);
      const wealthDelta = Math.max(20, contract.targetBurgWealth - plunderWealth) - contract.targetBurgWealth;
      const foodDelta = Math.max(50, contract.targetBurgFood - plunderFood) - contract.targetBurgFood;

      deltas.push({
        kind: "burg.adjust",
        burgId: contract.targetBurgId,
        wealth: wealthDelta || undefined,
        food: foodDelta || undefined,
        unrest: 12,
      });
      deltas.push({
        kind: "ghostwindDrop.execute",
        dropId: contract.id,
        executedTick: tick,
      });
      cartel.wealth += contract.bountyGold;

      const clanCut = Math.floor(plunderWealth * 0.35);
      deltas.push({
        kind: "faction.update",
        factionId: 1,
        treasuryDelta: clanCut,
      });

      const ruralCut = plunderWealth - clanCut;
      const outerBurgs = snap.outerBurgs.filter((b) => b.burgId !== contract.targetBurgId).slice(0, 2);
      const sharePerBurg = outerBurgs.length > 0 ? Math.floor(ruralCut / outerBurgs.length) : 0;
      for (const ob of outerBurgs) {
        deltas.push({
          kind: "burg.adjust",
          burgId: ob.burgId,
          wealth: sharePerBurg || undefined,
          food: 100,
          unrest: -4,
        });
        deltas.push({
          kind: "event.log",
          tick,
          type: "GHOSTWIND_DEAD_DROP_DISTRIBUTION",
          message: `📦 DEAD DROP SMUGGLING: Outlying smugglers near ${ob.name} recovered an untraceable dead drop left by The Ghostwind! Siphoning off their cut, contraband coin (${sharePerBurg} gold) was quietly circulated into the hands of struggling rural commoners.`,
          tier: "MINOR",
          outlawId: cartel.id,
          burgId: ob.burgId,
          loreDate: snap.loreDate,
        });
      }

      ctx.emitTagBurg(
        contract.targetBurgId,
        ["#GhostwindRumor", "#BlameRivalFaction", "#SpectralAirshipSighting", "#LockedRoomMystery"],
        "WARY",
        `Debating conflicting rumors: some blame ${contract.clientName} privateers, while terrified sailors swear a phantom airship vanished into thin air after tying the crew in slipknots.`,
        "%sailor%",
        3
      );

      const clientCapBurgId = snap.capitalBurgByFaction[contract.clientFactionId];
      if (clientCapBurgId) {
        ctx.emitTagBurg(
          clientCapBurgId,
          ["#DeadDropSuccess", "#WhisperedTriumph"],
          "TRIUMPHANT",
          `Court nobles quietly celebrate the destruction of rival convoys in ${contract.targetName}, toast-drinking their anonymous mercenary contractor.`,
          "%noble%",
          2
        );
      }

      deltas.push({
        kind: "event.log",
        tick,
        type: "GHOSTWIND_PHANTOM_RAID",
        message: `⚔️ THE GHOSTWIND PHANTOM RAID: Emerging silently out of storm clouds, The Ghostwind ambushed the flagship supply convoy of ${contract.targetName} near ${contract.targetBurgName}! Carrying out the secret dead-drop contract placed by ${contract.clientName}, the phantom corsairs subdued the entire crew with ruthless finesse and stripped the vessel down to its bare hull. In their signature locked-room mystery style, the raiders left exactly one captive tied in a loose knot that could be worked free after four hours—by which time The Ghostwind had vanished into the cloudbanks! Faction leaders in ${contract.targetName} suspect espionage, while commoners and sailors spread wild rumors: some point fingers at ${contract.clientName}, while others swear an actual ghost ship struck them!`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: contract.targetBurgId,
        loreDate: snap.loreDate,
      });
    }
  }
}

/**
 * 8. The Ghostspring Subterrane: Central peak spring cavern, subterranean swims & cartel bypass.
 */
export function stepGhostspring(cartel: WorkingCartel, ctx: CartelRunContext): void {
  const { snap, deltas } = ctx;
  const tick = snap.tick;

  const lairCount = ctx.lairCountByFaction.get(cartel.id) || 0;
  if (lairCount === 0) {
    const peakCell = cartel.originCellId || 30627;
    const originBurgId = snap.ghostspringOriginBurgId || 1;
    deltas.push({
      kind: "fringeLair.mutate",
      action: "upsert",
      factionId: cartel.id,
      cellId: peakCell,
      burgId: originBurgId,
      lairType: "CENTRAL_PEAK_SPRING_CAVERN",
      manpower: 40,
      heat: 5,
    });
    ctx.lairCountByFaction.set(cartel.id, 1);
  }

  // Original drew 1 seeded salt every tick for `ORDER BY sqlShuffle("b.burg_id") LIMIT 2`
  const salt = Math.floor(ctx.random() * 2147483647);
  const mountainBurgs = pickShuffled(snap.mountainBurgs, (b) => String(b.burgId), salt, 2);

  if (tick % 3 === 0 && mountainBurgs.length >= 2) {
    const eastBurg = mountainBurgs[0]!;
    const westBurg = mountainBurgs[1]!;
    cartel.wealth += 85;
    deltas.push({
      kind: "burg.adjust",
      burgId: westBurg.burgId,
      wealth: 20,
      rawMaterials: 25,
    });
    deltas.push({
      kind: "event.log",
      tick,
      type: "GHOSTSPRING_MOUNTAIN_SWIM",
      message: `🏊 TRANS-MOUNTAIN SUBTERRANEAN SWIM: Ghostspring pale-skin divers plunged into steaming geothermal pools outside ${eastBurg.name} and navigated miles of pitch-black flooded cavern flues beneath the central mountain range, surfacing with sealed cargo casks in the hot springs of ${westBurg.name}!`,
      tier: "MINOR",
      outlawId: cartel.id,
      burgId: eastBurg.burgId,
      loreDate: snap.loreDate,
    });
  }

  if (tick % 4 === 1 && mountainBurgs.length > 0) {
    const springBurg = mountainBurgs[0]!;
    ctx.emitTagBurg(
      springBurg.burgId,
      ["#HauntedSpringsLegend", "#PaleGhostSighting"],
      "WARY",
      "Terrified by sightings of chalk-white figures vanishing beneath boiling sulfur pools, believing the mountain springs are haunted by water-wraiths.",
      "%peasant%",
      2
    );
    deltas.push({
      kind: "event.log",
      tick,
      type: "GHOSTSPRING_HAUNTED_LEGEND",
      message: `👻 HAUNTED SPRINGS FOLKLORE: Travelers near the steaming geothermal springs above ${springBurg.name} caught glimpses of chalk-pale, spectral figures vanishing silently beneath boiling sulfur waters. Wild ghost stories spread through mountain inns that the springs are cursed and haunted!`,
      tier: "MINOR",
      outlawId: cartel.id,
      burgId: springBurg.burgId,
      loreDate: snap.loreDate,
    });
  }

  if (tick % 4 === 2) {
    const obsidian = ctx.workingById.get(6);
    if (obsidian && obsidian.wealth >= 200) {
      obsidian.wealth = Math.max(0, obsidian.wealth - 90);
      cartel.wealth += 90;
      deltas.push({
        kind: "event.log",
        tick,
        type: "GHOSTSPRING_CARTEL_BYPASS_RUN",
        message: `🏔️ CARTEL UNDER-MOUNTAIN BYPASS: Disregarding peasant ghost stories, the Obsidian Cartel contracted Ghostspring pale-skin divers to swim waterproof crates of void-lotus powder through flooded cavern flues beneath the central mountain range, completely bypassing high mountain toll gates and sovereign checkpoints!`,
        tier: "MAJOR",
        outlawId: cartel.id,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 4 === 0) {
    const barons = ctx.workingById.get(2);
    if (barons && barons.wealth >= 200) {
      barons.wealth = Math.max(0, barons.wealth - 80);
      cartel.wealth += 80;
      deltas.push({
        kind: "event.log",
        tick,
        type: "GHOSTSPRING_BARON_CARGO_TRANSFER",
        message: `📦 SKY-BARON SPRING DROP: Knowing the 'haunted springs' are actually subterranean Riverfolk outcasts, Free Sky-Baron cloud-skiffs dropped tethered cargo crates into steaming geothermal pools above the pass, where Ghostspring divers retrieved the contraband underwater to transport beneath the peaks.`,
        tier: "MAJOR",
        outlawId: cartel.id,
        loreDate: snap.loreDate,
      });
    }
  }
}

/**
 * 9. The Grind Canyon Corps: Nomadic chasm divers stationed at active canyons.
 */
export function stepGrindCanyonCorps(cartel: WorkingCartel, ctx: CartelRunContext): void {
  const { snap, deltas } = ctx;
  const tick = snap.tick;

  if (snap.activeCanyons.length === 0) return;

  if (tick % 2 === 0) {
    for (const canyon of snap.activeCanyons) {
      if (!canyon.nearestBurgId || !canyon.nearestBurgName) continue;
      deltas.push({
        kind: "burg.adjust",
        burgId: canyon.nearestBurgId,
        wealth: 50,
        rawMaterials: 60,
        unrest: 4,
        crime: 5,
      });
      ctx.emitTagBurg(
        canyon.nearestBurgId,
        ["#ChasmBrawler", "#DragonstoneGambler"],
        "ROWDY",
        "Gambling raw dragonstone nuggets in tavern brawls hosted by the Grind Canyon Corps caravan.",
        "%laborer%",
        2
      );
      deltas.push({
        kind: "event.log",
        tick,
        type: "GRIND_CORE_CARAVAN_INFLUX",
        message: `⛏️ GRIND CORE CARAVAN INFLUX: Off-shift chasm divers from ${canyon.name} flooded the taverns and back-alleys of ${canyon.nearestBurgName}! Paying for drinks in raw dragonstone nuggets, the nomadic crews sparked high-stakes dice brawls, spreading wealth, wild crime, and municipal corruption while the canyon remains open!`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: canyon.nearestBurgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 5 === 0) {
    cartel.manpower = Math.min(120, cartel.manpower + 2);
  }
}

/**
 * 10. The Hedge Wizards: Solitary nomadic charm-peddlers, entertainers & Wonder-Wander Troupe.
 */
export function stepHedgeWizards(cartel: WorkingCartel, ctx: CartelRunContext): void {
  const { snap, deltas } = ctx;
  const burgs = snap.targetBurgs;
  const tick = snap.tick;

  if (tick % 4 === 0) {
    const ruralBurg = burgs.find((b) => b.health < 80 || b.unrest > 8);
    if (ruralBurg) {
      deltas.push({
        kind: "event.log",
        tick,
        type: "HEDGE_SPARK_AWAKENING",
        message: `✨ SPARK AWAKENING: Starving on the rural roads outside ${ruralBurg.name}, an impoverished wanderer discovered an innate magical spark—learning through solitary survival to scrape by as an independent hedge wizard.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: ruralBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 3 === 0) {
    const bardBurg = burgs.find((b) => b.wealth > 80);
    if (bardBurg) {
      deltas.push({
        kind: "burg.adjust",
        burgId: bardBurg.burgId,
        unrest: -2,
      });
      cartel.wealth += 20;
      ctx.emitTagBurg(
        bardBurg.burgId,
        ["#BardicCheer"],
        "CONVIVIAL",
        "Enchanted by the roadside songs and whimsical lute-ballads of a traveling hedge wizard.",
        "%commoner%",
        1
      );
      deltas.push({
        kind: "event.log",
        tick,
        type: "HEDGE_BARD_PERFORMANCE",
        message: `🪕 BARDIC ENTERTAINER: A wandering hedge wizard busked on the street corners of ${bardBurg.name}, singing ancient folk ballads and weaving dancing colored sparks to ease commoner hearts for tossed coppers.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: bardBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 3 === 1) {
    const tinkerBurg = burgs.find((b) => b.wealth > 100);
    if (tinkerBurg) {
      deltas.push({
        kind: "burg.adjust",
        burgId: tinkerBurg.burgId,
        rawMaterials: 15,
        unrest: -1,
      });
      cartel.wealth += 25;
      deltas.push({
        kind: "event.log",
        tick,
        type: "HEDGE_PRACTICAL_TINKERING",
        message: `🔨 PRACTICAL HEDGE TINKERING: Setting up a whetstone and solder-pot outside the cookhouses of ${tinkerBurg.name}, a solitary hedge wizard mended copper pots and honed butchering blades with subtle heat charms.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: tinkerBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  const charmBurg = burgs.find((b) => b.wealth > 60);
  if (charmBurg && tick % 2 === 0) {
    const roll = ctx.random();

    if (roll < 0.35) {
      cartel.wealth += 15;
      deltas.push({
        kind: "event.log",
        tick,
        type: "HEDGE_CHARM_JUNK",
        message: `🪨 HEDGE CHARM (USELESS JUNK): A solitary hedge wizard in ${charmBurg.name} peddled painted river 'luck-pebbles' and salted bird feathers to gullible commoners for copper before packing up their roadside cart.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: charmBurg.burgId,
        loreDate: snap.loreDate,
      });
    } else if (roll < 0.70) {
      deltas.push({
        kind: "burg.adjust",
        burgId: charmBurg.burgId,
        health: 6,
        unrest: -3,
      });
      cartel.wealth += 40;
      ctx.emitTagBurg(
        charmBurg.burgId,
        ["#HedgeCharmBearer"],
        "DEVOUT",
        "Carrying unsanctioned curative bramble charms gifted by a solitary nomadic hedge wizard.",
        "%peasant%",
        2
      );
      deltas.push({
        kind: "event.log",
        tick,
        type: "HEDGE_CHARM_USEFUL",
        message: `🌿 HEDGE CHARM (REMEDY): A wandering hedge wizard quietly sold bramble-fever tinctures and hearth-warmth amulets to sickly commoners in ${charmBurg.name}, curing chills where guild apothecaries refused charity.`,
        tier: "MINOR",
        outlawId: cartel.id,
        burgId: charmBurg.burgId,
        loreDate: snap.loreDate,
      });
    } else if (roll < 0.85) {
      deltas.push({
        kind: "burg.adjust",
        burgId: charmBurg.burgId,
        rawMaterials: 60,
      });
      cartel.wealth += 60;
      deltas.push({
        kind: "event.log",
        tick,
        type: "HEDGE_CHARM_WILD_SURGE",
        message: `⚡ HEDGE CHARM (UNINTENDED SURGE): A wild-spark talisman sold to a farmer in ${charmBurg.name} triggered a chaotic magical surge—instantly causing an entire orchard to fruit out of season and levitating two hay wagons!`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: charmBurg.burgId,
        loreDate: snap.loreDate,
      });
    } else {
      deltas.push({
        kind: "burg.adjust",
        burgId: charmBurg.burgId,
        unrest: 4,
      });
      deltas.push({
        kind: "event.log",
        tick,
        type: "HEDGE_CHARM_DISASTER",
        message: `💥 HEDGE CHARM (OOPS!): A faulty warding charm sold by a hedge wizard backfired in the market of ${charmBurg.name}! It turned a merchant's beard into crackling blue sparks and curdled dairy barrels, sending the wizard sprinting for the tree line!`,
        tier: "MAJOR",
        outlawId: cartel.id,
        burgId: charmBurg.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  if (tick % 45 === 15 && snap.circusCandidates.length > 0) {
    const salt = Math.floor(ctx.random() * 2147483647);
    const stop = pickShuffled(
      snap.circusCandidates,
      (s) => `${s.factionId}-${s.burgId}`,
      salt,
      1
    )[0];
    if (stop) {
      const existingCircus = snap.lairs.find(
        (l) => l.factionId === cartel.id && l.lairType === "TRAVELING_CIRCUS_CARAVAN"
      );
      if (!existingCircus) {
        deltas.push({
          kind: "fringeLair.mutate",
          action: "upsert",
          factionId: cartel.id,
          cellId: stop.cellId,
          burgId: stop.burgId,
          lairType: "TRAVELING_CIRCUS_CARAVAN",
          manpower: 24,
          heat: 0,
        });
      } else {
        deltas.push({
          kind: "fringeLair.update",
          lairId: existingCircus.id,
          cellId: stop.cellId,
          burgId: stop.burgId,
        });
      }

      deltas.push({
        kind: "burg.adjust",
        burgId: stop.burgId,
        unrest: -8,
        wealth: 30,
      });
      cartel.wealth += 120;

      ctx.emitTagBurg(
        stop.burgId,
        ["#CircusSpectator", "#EnchantedAudience"],
        "JOYFUL",
        "Spectating breathtaking pyrotechnics and aerial acrobatics performed by The Wonder-Wander Troupe.",
        null,
        3
      );
      deltas.push({
        kind: "event.log",
        tick,
        type: "WONDER_WANDER_CIRCUS_ARRIVES",
        message: `🎪 THE WONDER-WANDER CIRCUS ARRIVES: The flamboyant wagons of The Wonder-Wander Troupe rolled into ${stop.burgName} of ${stop.factionName}! Acrobats, fire-eating hedge mages, and chimera-puppeteers raised their starry pavilions, bringing seasonal revelry, festive joy, and whimsical wonder to the entire realm!`,
        tier: "CRITICAL",
        outlawId: cartel.id,
        burgId: stop.burgId,
        loreDate: snap.loreDate,
      });
    }
  }
}
