from backend.models import ActionRequest, Character, CharacterStats
from backend.combat import resolve_action
from backend.npc_generator import _get_fallback_npc

def test_srd():
    print("--- 1. Testing NPC Generation ---")
    npc = _get_fallback_npc("npc_123", "Goliath Beetle Heavy")
    print(f"NPC Name: {npc.name}")
    print(f"Stats sum to: {sum(npc.stats.model_dump().values())} (Expected 36)")
    print(f"Max HP: {npc.max_hp} | HP: {npc.hp}")
    print(f"Max Composure: {npc.max_composure} | Composure: {npc.composure}")
    print(f"Active Stamina: {npc.active_stamina} | Active Focus: {npc.active_focus}")
    
    print("\n--- 2. Testing Combat Resolution ---")
    # Simulate player attacking NPC
    req = ActionRequest(
        attacker_name="Player (Might)",
        attacker_stat=5,
        modifier=0,
        defender_name=npc.name,
        defender_stat=npc.stats.endurance, # Defending with Endurance
        defender_armor=1, # 1 armor
        damage_type="physical"
    )
    
    res = resolve_action(req)
    print(f"Attacker Roll: {res.roll}")
    print(f"Defender Roll: {res.defender_roll}")
    print(f"Raw Damage: {res.raw_damage}")
    print(f"Net Damage: {res.net_damage}")
    print(f"Injury Tier: {res.injury_tier}")
    print(f"Adrenaline Shock: {res.adrenaline_shock}")
    print("\nMessage:")
    print(res.message)

if __name__ == "__main__":
    test_srd()
