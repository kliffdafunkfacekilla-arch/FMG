"""
OSTRAKA CAMPAIGN, QUEST & WORLD INJECTION ENGINE
================================================
Connects the overarching campaign arc and procedural story beat framework
directly to the 351x351 local grid and regional cell engines.

Key Responsibilities:
  1. Campaign Arc Manager: Tracks global acts, faction tensions, and major story milestones.
  2. Quest Generator & Directive Synthesizer: Translates narrative beats into concrete physical spawn manifests.
  3. Physical World Injector:
     - Spawns Locations (Camps, Ritual Altars, Barricades, Crash Sites)
     - Spawns NPCs / Entities (Cultists, Merchants, Guards) with 5-Facet Social Tags
     - Spawns Interactive Props (Chests, Braziers, Ropes, Silos) with 5-Facet Universal Tags
  4. Objective Listener & Delta Feedback: Listens to player actions on injected entities to update quest state and advance the campaign arc.
"""

import json
import random
from typing import Dict, List, Any, Optional

# --- 1. PHYSICAL TAGGED PROP & ENTITY MODELS ---

class InjectedProp:
    def __init__(self, prop_id: str, name: str, tile_pos: tuple, tags: List[str], hp: int = 20):
        self.prop_id = prop_id
        self.name = name
        self.tile_pos = tile_pos  # (x, y) on 351x351 grid
        self.tags = set(tags)     # Material, active, reactive, actionable, environmental
        self.hp = hp
        self.destroyed = False

    def to_dict(self):
        return {
            "prop_id": self.prop_id,
            "name": self.name,
            "tile_pos": self.tile_pos,
            "tags": list(self.tags),
            "hp": self.hp,
            "destroyed": self.destroyed
        }


class InjectedNPC:
    def __init__(self, npc_id: str, name: str, tile_pos: tuple, social_tags: List[str], faction: str, hp: int = 30):
        self.npc_id = npc_id
        self.name = name
        self.tile_pos = tile_pos
        self.social_tags = set(social_tags)  # Disposition, role, faction, metaphysical, actionable
        self.faction = faction
        self.hp = hp
        self.alive = True
        self.disposition_level = 0  # -2 Hostile to +2 Allied

    def to_dict(self):
        return {
            "npc_id": self.npc_id,
            "name": self.name,
            "tile_pos": self.tile_pos,
            "social_tags": list(self.social_tags),
            "faction": self.faction,
            "hp": self.hp,
            "alive": self.alive,
            "disposition_level": self.disposition_level
        }


# --- 2. QUEST OBJECTIVE & MANIFEST ENGINE ---

class QuestObjective:
    def __init__(self, obj_id: str, obj_type: str, description: str, target_id: str, required_count: int = 1):
        self.obj_id = obj_id
        self.obj_type = obj_type  # 'DESTROY_PROP', 'DEFEAT_NPC', 'INTERACT_PROP', 'CONVINCE_NPC'
        self.description = description
        self.target_id = target_id
        self.required_count = required_count
        self.current_count = 0
        self.completed = False

    def update_progress(self, target_id: str, amount: int = 1):
        if self.completed:
            return False
        if target_id == self.target_id:
            self.current_count += amount
            if self.current_count >= self.required_count:
                self.completed = True
                print(f"  🎯 [OBJECTIVE COMPLETED]: {self.description}")
            else:
                print(f"  📈 [OBJECTIVE PROGRESS]: {self.description} ({self.current_count}/{self.required_count})")
            return True
        return False


class StoryQuest:
    def __init__(self, quest_id: str, title: str, category: str, hook: str, quest_giver_id: str):
        self.quest_id = quest_id
        self.title = title
        self.category = category
        self.hook = hook
        self.quest_giver_id = quest_giver_id
        self.objectives: List[QuestObjective] = []
        self.injected_props: List[InjectedProp] = []
        self.injected_npcs: List[InjectedNPC] = []
        self.injected_location_name: Optional[str] = None
        self.injected_location_center: Optional[tuple] = None
        self.status = "ACTIVE"  # ACTIVE, COMPLETED, FAILED

    def check_completion(self) -> bool:
        if all(obj.completed for obj in self.objectives):
            self.status = "COMPLETED"
            return True
        return False


# --- 3. CAMPAIGN & WORLD INJECTOR ENGINE ---

class CampaignWorldInjectorEngine:
    def __init__(self, current_act: int = 1, global_theme: str = "The Awakening of Sh'lar"):
        self.current_act = current_act
        self.global_theme = global_theme
        self.active_quests: List[StoryQuest] = []
        
        # Simulated 351x351 Local Grid Entity Registers
        self.local_grid_props: Dict[str, InjectedProp] = {}
        self.local_grid_npcs: Dict[str, InjectedNPC] = {}
        self.local_grid_locations: List[Dict[str, Any]] = []

    def generate_and_inject_quest(
        self,
        cell_id: int,
        burg_name: str,
        trigger_delta: Dict[str, Any]
    ) -> StoryQuest:
        """
        Takes a simulation delta or campaign trigger, generates a structured quest, 
        and INJECTS physical entities, props, and micro-locations directly into the 351x351 local grid.
        """
        delta_type = trigger_delta.get("type", "UNKNOWN")
        
        if delta_type == "RITUAL_SITE_SPAWNED":
            quest = self._create_ritual_purge_quest(cell_id, burg_name, trigger_delta)
        elif delta_type == "BANDIT_BARRICADE":
            quest = self._create_barricade_clearing_quest(cell_id, burg_name, trigger_delta)
        else:
            quest = self._create_generic_investigation_quest(cell_id, burg_name, trigger_delta)

        # Register injected elements into the Local Grid Canvas
        for prop in quest.injected_props:
            self.local_grid_props[prop.prop_id] = prop
        for npc in quest.injected_npcs:
            self.local_grid_npcs[npc.npc_id] = npc
        
        if quest.injected_location_name:
            self.local_grid_locations.append({
                "name": quest.injected_location_name,
                "center_tile": quest.injected_location_center,
                "associated_quest": quest.quest_id
            })

        self.active_quests.append(quest)
        
        print(f"\n✨ [WORLD INJECTOR]: Injected Quest '{quest.title}' into Cell {cell_id} ({burg_name})")
        print(f"  📍 Micro-Location Injected: '{quest.injected_location_name}' at Tile {quest.injected_location_center}")
        print(f"  👥 Injected NPCs: {len(quest.injected_npcs)} actors spawned on tactical grid.")
        print(f"  📦 Injected Props: {len(quest.injected_props)} interactive objects spawned with 5-Facet Tags.")
        
        return quest

    def _create_ritual_purge_quest(self, cell_id: int, burg_name: str, delta: Dict[str, Any]) -> StoryQuest:
        quest = StoryQuest(
            quest_id=f"QUEST_PURGE_{cell_id}",
            title=f"The Defiled Grove of {burg_name}",
            category="CAMPAIGN_MAIN_ARC",
            hook="Worm Cult zealots have erected a corrupting Obsidian Altar in the forest edge, leeching the local leyline node.",
            quest_giver_id="npc_grey_warden_1"
        )
        
        # Micro-Location Center on 351x351 grid
        loc_center = (210, 85)
        quest.injected_location_name = "Defiled Shrine Ruins"
        quest.injected_location_center = loc_center
        
        # 1. Inject Props with 5-Facet Universal Tags
        altar = InjectedProp(
            prop_id="prop_obsidian_altar_1",
            name="Corrupted Obsidian Altar",
            tile_pos=loc_center,
            tags=["stone", "burning", "magic_focus", "indestructible", "fragile_to_null", "dark"],
            hp=50
        )
        brazier_1 = InjectedProp(
            prop_id="prop_brazier_1",
            name="Blood-Fire Brazier (West)",
            tile_pos=(205, 85),
            tags=["metal", "burning", "hot", "flammable_fuel", "movable"],
            hp=20
        )
        brazier_2 = InjectedProp(
            prop_id="prop_brazier_2",
            name="Blood-Fire Brazier (East)",
            tile_pos=(215, 85),
            tags=["metal", "burning", "hot", "flammable_fuel", "movable"],
            hp=20
        )
        quest.injected_props.extend([altar, brazier_1, brazier_2])

        # 2. Inject NPCs with 5-Facet Social & Combat Tags
        cultist_leader = InjectedNPC(
            npc_id="npc_cult_heresiarch",
            name="Heresiarch Malakor",
            tile_pos=(210, 87),
            social_tags=["fanatical", "hostile", "worm_cult", "sparkborn", "provokable", "unyielding"],
            faction="Thirteen Worm Cults",
            hp=45
        )
        cult_zealot_1 = InjectedNPC(
            npc_id="npc_zealot_1",
            name="Worm Cult Initiate",
            tile_pos=(208, 83),
            social_tags=["fearful", "hostile", "worm_cult", "gullible", "intimidatable"],
            faction="Thirteen Worm Cults",
            hp=25
        )
        quest.injected_npcs.extend([cultist_leader, cult_zealot_1])

        # 3. Define Objectives
        obj_1 = QuestObjective(
            obj_id="obj_defeat_heresiarch",
            obj_type="DEFEAT_NPC",
            description="Defeat Heresiarch Malakor at the Defiled Shrine.",
            target_id="npc_cult_heresiarch"
        )
        obj_2 = QuestObjective(
            obj_id="obj_destroy_altar",
            obj_type="DESTROY_PROP",
            description="Purify/Destroy the Corrupted Obsidian Altar.",
            target_id="prop_obsidian_altar_1"
        )
        quest.objectives.extend([obj_1, obj_2])

        return quest

    def _create_barricade_clearing_quest(self, cell_id: int, burg_name: str, delta: Dict[str, Any]) -> StoryQuest:
        quest = StoryQuest(
            quest_id=f"QUEST_BARRICADE_{cell_id}",
            title=f"Clearing the Canyon Toll Blockade",
            category="SIDE_QUEST",
            hook="Sky-Baronies outlaws built a fortified wooden barricade across the trade road, extorting passing merchant caravans.",
            quest_giver_id="npc_merchant_factor"
        )
        
        loc_center = (140, 190)
        quest.injected_location_name = "Canyon Toll Blockade"
        quest.injected_location_center = loc_center
        
        barricade = InjectedProp(
            prop_id="prop_wooden_barricade_1",
            name="Fortified Oak Barricade",
            tile_pos=loc_center,
            tags=["wood", "flammable", "cover_heavy", "impassable", "hinder"],
            hp=40
        )
        quest.injected_props.append(barricade)

        bandit_captain = InjectedNPC(
            npc_id="npc_bandit_captain",
            name="Captain Jax the Red",
            tile_pos=(141, 191),
            social_tags=["greedy", "bribeable", "outlaw", "free_sky_baronies", "intimidatable"],
            faction="Free Sky-Baronies",
            hp=35
        )
        quest.injected_npcs.append(bandit_captain)

        obj_1 = QuestObjective(
            obj_id="obj_clear_barricade",
            obj_type="CLEAR_ROAD",
            description="Remove or burn down the Fortified Oak Barricade.",
            target_id="prop_wooden_barricade_1"
        )
        quest.objectives.append(obj_1)

        return quest

    def _create_generic_investigation_quest(self, cell_id: int, burg_name: str, delta: Dict[str, Any]) -> StoryQuest:
        quest = StoryQuest(
            quest_id=f"QUEST_INVESTIGATE_{cell_id}",
            title=f"Anomalous Echoes in {burg_name}",
            category="LOCAL_MYSTERY",
            hook="Unusual Aetheric hums reported in the old cellars.",
            quest_giver_id="npc_burg_mayor"
        )
        return quest

    def process_player_action_event(self, action_type: str, target_id: str, action_payload: Dict[str, Any] = None):
        """
        Listens to physical actions executed on the 351x351 tactical grid (e.g., destroying a prop, defeating an NPC),
        updates active quest progress, and triggers macro campaign feedback deltas!
        """
        print(f"\n⚡ [WORLD EVENT LISTENER]: Processing Player Action '{action_type}' on Target '{target_id}'...")
        
        # 1. Update Injected Physical Objects
        if target_id in self.local_grid_props:
            prop = self.local_grid_props[target_id]
            if action_type == "DESTROY_PROP" or action_type == "BURN_PROP":
                prop.destroyed = True
                prop.hp = 0
                print(f"  🔥 [PROP DESTROYED]: '{prop.name}' has been destroyed on Tile {prop.tile_pos}!")

        if target_id in self.local_grid_npcs:
            npc = self.local_grid_npcs[target_id]
            if action_type == "DEFEAT_NPC":
                npc.alive = False
                npc.hp = 0
                print(f"  ⚔️ [NPC DEFEATED]: '{npc.name}' has been slain on Tile {npc.tile_pos}!")
            elif action_type == "CONVINCE_NPC" or action_type == "BRIBE_NPC":
                npc.disposition_level = +2
                print(f"  🤝 [NPC CONVINCED]: '{npc.name}' disposition raised to ALLIED (+2)!")

        # 2. Check Objectives for Active Quests
        for quest in self.active_quests:
            if quest.status != "ACTIVE":
                continue

            for obj in quest.objectives:
                obj.update_progress(target_id)

            if quest.check_completion():
                print(f"\n🎉 [QUEST COMPLETED!]: '{quest.title}' is now COMPLETED!")
                self._trigger_macro_campaign_cascade(quest)

    def _trigger_macro_campaign_cascade(self, completed_quest: StoryQuest):
        """
        Feeds the quest outcome back up into the macro world simulation ledgers.
        """
        print(f"  🌐 [UPSTREAM CAMPAIGN CASCADE]:")
        print(f"     • Macro Reality Warp Index reduced by -15 points!")
        print(f"     • Regional Burg Stability increased by +10.0%!")
        print(f"     • Faction Reputation: Grey Wardens (+25), Worm Cults (-30)")
        print(f"     • Advanced Campaign Act {self.current_act} Story Milestone!")


def run_campaign_injector_demo():
    print("===========================================================================")
    print("📜 OSTRAKA CAMPAIGN, QUEST & WORLD INJECTION ENGINE DEMO 📜")
    print("===========================================================================")

    engine = CampaignWorldInjectorEngine(current_act=1, global_theme="The Awakening of Sh'lar")

    # 1. Simulate a World Engine Delta (e.g. Chaos Conduit mutation / Ritual Site)
    simulated_world_delta = {
        "type": "RITUAL_SITE_SPAWNED",
        "severity": "CRITICAL",
        "controlling_faction": "Grey Warden Order"
    }

    # 2. Generate Quest and Inject entities into 351x351 Local Grid
    active_quest = engine.generate_and_inject_quest(
        cell_id=10522,
        burg_name="Excelsis Foothills Burg",
        trigger_delta=simulated_world_delta
    )

    # Inspect current injected map state
    print("\n--- Current 351x351 Local Grid Canvas Injected State ---")
    for pid, prop in engine.local_grid_props.items():
        print(f" • Prop '{prop.name}' [{pid}] at Tile {prop.tile_pos} | Tags: {list(prop.tags)}")
    for nid, npc in engine.local_grid_npcs.items():
        print(f" • NPC '{npc.name}' [{nid}] at Tile {npc.tile_pos} | Tags: {list(npc.social_tags)}")

    # 3. Player Executes Tactical Actions on the Injected Canvas
    print("\n--- Player Begins Quest Execution on Tactical Grid ---")
    
    # Step A: Player slays the Cult Leader
    engine.process_player_action_event("DEFEAT_NPC", "npc_cult_heresiarch")

    # Step B: Player casts Null-Purify / Destroys the Obsidian Altar
    engine.process_player_action_event("DESTROY_PROP", "prop_obsidian_altar_1")


if __name__ == "__main__":
    run_campaign_injector_demo()
