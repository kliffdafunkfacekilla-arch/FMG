"""
OSTRAKA DYNAMIC STORY BEAT & QUEST GENERATOR ENGINE
===================================================
Translates local cell deltas, ecological anomalies, market shocks, and 
faction tensions into emergent quest hooks, dynamic story beats, objective 
vectors, and structured AI DM prompts for runtime narrative generation.

Features:
  - Delta Listener: Listens to Tier 1/2 cell deltas (silo destruction, famine, chaos mutation, trade raids)
  - Quest Archetype Synthesizer: Maps delta conditions to dynamic quest templates
  - Stakeholder & Faction Motivation Evaluator: Determines who offers the quest and who opposes it
  - AI DM Prompt Payload Generator: Generates structured LLM context blocks for runtime roleplay
"""

import json
from typing import Dict, List, Any, Optional


class StoryBeat:
    def __init__(
        self,
        beat_id: str,
        category: str,
        title: str,
        hook: str,
        quest_giver: Dict[str, str],
        opposing_faction: Optional[str],
        objectives: List[Dict[str, Any]],
        rewards: Dict[str, Any],
        reputation_changes: Dict[str, int],
        ai_dm_prompt: str
    ):
        self.beat_id = beat_id
        self.category = category
        self.title = title
        self.hook = hook
        self.quest_giver = quest_giver
        self.opposing_faction = opposing_faction
        self.objectives = objectives
        self.rewards = rewards
        self.reputation_changes = reputation_changes
        self.ai_dm_prompt = ai_dm_prompt

    def to_json_dict(self) -> Dict[str, Any]:
        return {
            "beat_id": self.beat_id,
            "category": self.category,
            "title": self.title,
            "hook": self.hook,
            "quest_giver": self.quest_giver,
            "opposing_faction": self.opposing_faction,
            "objectives": self.objectives,
            "rewards": self.rewards,
            "reputation_changes": self.reputation_changes,
            "ai_dm_prompt": self.ai_dm_prompt
        }


class QuestGeneratorEngine:
    def __init__(self):
        self.generated_beats: List[StoryBeat] = []

    def process_cell_deltas(self, cell_context: Dict[str, Any], active_deltas: List[Dict[str, Any]]) -> List[StoryBeat]:
        """
        Scans active cell deltas and environmental context to instantiate emergent story beats.
        """
        new_beats = []
        cell_id = cell_context.get("cell_id", "UNKNOWN_CELL")
        burg_name = cell_context.get("burg_name", "Local Settlement")
        controlling_faction = cell_context.get("controlling_faction", "Neutral Folk")

        for delta in active_deltas:
            delta_type = delta.get("type")
            target = delta.get("target")
            severity = delta.get("severity", "MEDIUM")

            # 1. Delta: GRAIN_SILO_DESTROYED / FOOD_SHORTAGE
            if delta_type == "GRAIN_SILO_DESTROYED" or delta_type == "FOOD_SHORTAGE":
                beat = self._build_food_crisis_beat(cell_id, burg_name, controlling_faction, severity)
                new_beats.append(beat)

            # 2. Delta: CHAOS_FLOW_MUTATION
            elif delta_type == "CHAOS_FLOW_MUTATION":
                intensity = delta.get("intensity", 0.8)
                beat = self._build_chaos_mutation_beat(cell_id, burg_name, controlling_faction, intensity)
                new_beats.append(beat)

            # 3. Delta: CARAVAN_RAIDED
            elif delta_type == "CARAVAN_RAIDED":
                cargo = delta.get("cargo", "Aetherium Ore")
                raider_faction = delta.get("raiders", "Ghostwind Raiders")
                beat = self._build_caravan_raid_beat(cell_id, burg_name, controlling_faction, cargo, raider_faction)
                new_beats.append(beat)

            # 4. Delta: FAMINE_MIGRATION
            elif delta_type == "FAMINE_MIGRATION":
                beat = self._build_beast_migration_beat(cell_id, burg_name, controlling_faction)
                new_beats.append(beat)

        self.generated_beats.extend(new_beats)
        return new_beats

    def _build_food_crisis_beat(self, cell_id: Any, burg_name: str, faction: str, severity: str) -> StoryBeat:
        beat_id = f"BEAT_FOOD_{cell_id}"
        title = f"The Empty Granaries of {burg_name}"
        hook = f"Following the destruction of key food storage in {burg_name}, local food reserves have collapsed. Panic spreads through Ring 2 as prices soar."
        
        quest_giver = {
            "npc_name": "Quartermaster Varek",
            "title": "Burg Supply Warden",
            "faction": faction
        }
        
        objectives = [
            {
                "id": "obj_1",
                "type": "SECURE_CARAVAN",
                "description": f"Escort 2 Relief Supply Caravans from Sump-Bog Posts to {burg_name}.",
                "target_count": 2,
                "current_count": 0
            },
            {
                "id": "obj_2",
                "type": "REBUILD_INFRASTRUCTURE",
                "description": f"Deliver 15 Timber and 5 Iron Sheets to rebuild the {burg_name} Granary.",
                "target_count": 20,
                "current_count": 0
            }
        ]
        
        rewards = {
            "gold_bounty": 250,
            "reputation_points": 15,
            "item_reward": "Fulcrum Grain Token (Grants 10% market discount)"
        }
        
        reputation_changes = {
            faction: 15,
            "Free Sky-Baronies": -5
        }
        
        ai_dm_prompt = (
            f"You are AI DM. The players are at {burg_name} (Cell {cell_id}). "
            f"Recent events: A critical grain silo was destroyed, causing local food prices to spike 1.45x. "
            f"NPC Quartermaster Varek is desperate and stressed, offering 250 Gold if players secure incoming food caravans "
            f"or deliver building timber. Roleplay Varek with urgent, gravelly tone and describe the crowded market riots."
        )

        return StoryBeat(
            beat_id=beat_id,
            category="ECONOMIC_CRISIS",
            title=title,
            hook=hook,
            quest_giver=quest_giver,
            opposing_faction="Black Market Syndicate",
            objectives=objectives,
            rewards=rewards,
            reputation_changes=reputation_changes,
            ai_dm_prompt=ai_dm_prompt
        )

    def _build_chaos_mutation_beat(self, cell_id: Any, burg_name: str, faction: str, intensity: float) -> StoryBeat:
        beat_id = f"BEAT_CHAOS_{cell_id}"
        title = f"Aetheric Mutation in Sub-cell {cell_id}"
        hook = f"A sudden surge along a Primordial Chaos Conduit (Intensity: {intensity}) has mutated local wildlife into aggressive Shard-Beasts threatening the outer farms."
        
        quest_giver = {
            "npc_name": "High Monk Kaelen",
            "title": "Grey Warden Purifier",
            "faction": "Grey Warden Order"
        }
        
        objectives = [
            {
                "id": "obj_1",
                "type": "SUBDUE_ABERRATIONS",
                "description": f"Cull 4 Mutated Shard-Beasts prowling the perimeter of {burg_name}.",
                "target_count": 4,
                "current_count": 0
            },
            {
                "id": "obj_2",
                "type": "SEAL_CONDUIT_BLEED",
                "description": "Place a Null-Anchor ward on the local Aetheric Leyline node.",
                "target_count": 1,
                "current_count": 0
            }
        ]
        
        rewards = {
            "gold_bounty": 400,
            "reputation_points": 25,
            "item_reward": "Null Ward Charm (Grants +2 Arcane Resistance)"
        }
        
        reputation_changes = {
            "Grey Warden Order": 25,
            "Worm Cults": -20
        }
        
        ai_dm_prompt = (
            f"You are AI DM. The air in sub-cell {cell_id} hums with raw Aetheric static. "
            f"Local fauna have mutated into jagged Shard-Beasts with glowing obsidian growths. "
            f"Grey Warden Kaelen requests urgent extermination before the mutation reaches Ring 1. "
            f"Emphasize the crackling atmosphere, metallic ozone smell, and unsettling unnatural beast calls."
        )

        return StoryBeat(
            beat_id=beat_id,
            category="CHAOS_OUTBREAK",
            title=title,
            hook=hook,
            quest_giver=quest_giver,
            opposing_faction="Thirteen Worm Cults",
            objectives=objectives,
            rewards=rewards,
            reputation_changes=reputation_changes,
            ai_dm_prompt=ai_dm_prompt
        )

    def _build_caravan_raid_beat(self, cell_id: Any, burg_name: str, faction: str, cargo: str, raiders: str) -> StoryBeat:
        beat_id = f"BEAT_RAID_{cell_id}"
        title = f"Intercepted Trade Convoy: {cargo}"
        hook = f"A high-value merchant skiff carrying {cargo} was ambushed by {raiders} along the eastern trade canyon."
        
        quest_giver = {
            "npc_name": "Factor Elyse",
            "title": "Gilded Compass Trade Agent",
            "faction": "Gilded Compass Cartel"
        }
        
        objectives = [
            {
                "id": "obj_1",
                "type": "RECOVER_CARGO",
                "description": f"Recover 3 Crate Containers of {cargo} from the raider encampment.",
                "target_count": 3,
                "current_count": 0
            }
        ]
        
        rewards = {
            "gold_bounty": 350,
            "reputation_points": 20,
            "item_reward": "Trade Pass Seal"
        }
        
        reputation_changes = {
            "Gilded Compass Cartel": 20,
            raiders: -15
        }
        
        ai_dm_prompt = (
            f"You are AI DM. Factor Elyse of the Gilded Compass Cartel is pacing outside the warehouse at {burg_name}. "
            f"A shipment of {cargo} was intercepted by {raiders}. Elyse will pay handsomely for cargo retrieval. "
            f"Roleplay Elyse as a sharp, pragmatic trader who values speed and discretion."
        )

        return StoryBeat(
            beat_id=beat_id,
            category="TRADE_SABOTAGE",
            title=title,
            hook=hook,
            quest_giver=quest_giver,
            opposing_faction=raiders,
            objectives=objectives,
            rewards=rewards,
            reputation_changes=reputation_changes,
            ai_dm_prompt=ai_dm_prompt
        )

    def _build_beast_migration_beat(self, cell_id: Any, burg_name: str, faction: str) -> StoryBeat:
        beat_id = f"BEAT_MIGRATE_{cell_id}"
        title = f"Famine Migration of the Cloud-Rams"
        hook = f"A severe regional drought has destroyed wild flora, driving herds of hungry Cloud-Rams to trample crops and breach outer town walls."
        
        quest_giver = {
            "npc_name": "Elder Martha",
            "title": "Ring 3 Farmland Steward",
            "faction": faction
        }
        
        objectives = [
            {
                "id": "obj_1",
                "type": "REDIRECT_HERD",
                "description": "Construct 2 temporary flares or barriers to herd the beasts away from farmland.",
                "target_count": 2,
                "current_count": 0
            }
        ]
        
        rewards = {
            "gold_bounty": 180,
            "reputation_points": 10,
            "item_reward": "Apothecary Herb Bundle"
        }
        
        reputation_changes = {
            faction: 10
        }
        
        ai_dm_prompt = (
            f"You are AI DM. Hundreds of starving wild beasts are stampeding toward the agricultural terraces of {burg_name}. "
            f"Elder Martha needs players to divert the herd without slaughtering the entire population. "
            f"Describe the thundering hooves, dusty horizon, and anxious farmers wielding pitchforks."
        )

        return StoryBeat(
            beat_id=beat_id,
            category="ECOLOGICAL_DISASTER",
            title=title,
            hook=hook,
            quest_giver=quest_giver,
            opposing_faction=None,
            objectives=objectives,
            rewards=rewards,
            reputation_changes=reputation_changes,
            ai_dm_prompt=ai_dm_prompt
        )


def run_story_beat_engine_test():
    print("===========================================================================")
    print("📜 OSTRAKA DYNAMIC STORY BEAT & QUEST GENERATOR ENGINE TEST 📜")
    print("===========================================================================")

    generator = QuestGeneratorEngine()

    # Define cell context
    cell_context = {
        "cell_id": 10522,
        "burg_name": "Excelsis Foothills Burg",
        "controlling_faction": "Avian Empire"
    }

    # Simulate active cell deltas produced by the LOD Delta Engine
    simulated_deltas = [
        {
            "type": "GRAIN_SILO_DESTROYED",
            "target": "prop_silo_1",
            "severity": "HIGH"
        },
        {
            "type": "CHAOS_FLOW_MUTATION",
            "intensity": 0.85
        },
        {
            "type": "CARAVAN_RAIDED",
            "cargo": "Refined Silk-Steel",
            "raiders": "Free Sky-Baronies"
        }
    ]

    print(f"\nProcessing {len(simulated_deltas)} active cell deltas for {cell_context['burg_name']}...")
    beats = generator.process_cell_deltas(cell_context, simulated_deltas)

    print(f"\nGenerated {len(beats)} Emergent Story Beats:\n")
    for idx, beat in enumerate(beats, 1):
        print(f"--- [Story Beat {idx}: {beat.category}] {beat.title} ---")
        print(f"  Hook: {beat.hook}")
        print(f"  Quest Giver: {beat.quest_giver['npc_name']} ({beat.quest_giver['title']})")
        print(f"  Opposing Faction: {beat.opposing_faction}")
        print(f"  Objectives: {[obj['description'] for obj in beat.objectives]}")
        print(f"  Rewards: {beat.rewards['gold_bounty']} Gold | Item: {beat.rewards['item_reward']}")
        print(f"  AI DM Prompt Block:\n    \"{beat.ai_dm_prompt}\"\n")


if __name__ == "__main__":
    run_story_beat_engine_test()
