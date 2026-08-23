from rules_engine.inventory import Inventory, Item

class CharacterSheet:
    """
    Core data structure for the BRUTAL engine.
    Now supports all 12 core stats and derives pools automatically.
    """
    def __init__(self, name: str, stats: dict = None, origin: str = "Unknown"):
        self.name = name
        self.biological_origin = origin
        
        # 12 Core Stats
        self.stats = {
            "endurance": 5, "fortitude": 5, "vitality": 5,
            "willpower": 5, "logic": 5, "charm": 5,
            "might": 5, "reflexes": 5, "finesse": 5,
            "knowledge": 5, "awareness": 5, "intuition": 5
        }
        
        if stats:
            for k, v in stats.items():
                if k in self.stats:
                    self.stats[k] = min(v, 8) # Hard Biological Ceiling at creation
                    
        self.inventory = Inventory()
        
        self.level = 1
        self.xp = 0
        self.skills = []
        self.unspent_stat_points = 0
        self.unspent_skill_points = 0
        
        self.trauma_tokens = 0
        self.is_stabilized = True
        self.has_disadvantage = False
        
        # Functional State
        self.tags = set()
        self.modifiers = {}
        
        self._derive_pools()
        self._init_battery()
        
    def _derive_pools(self):
        # HP: Endurance + Fortitude + Vitality
        self.max_hp = self.stats["endurance"] + self.stats["fortitude"] + self.stats["vitality"]
        self.current_hp = self.max_hp
        
        # Composure: Willpower + Logic + Charm
        self.max_composure = self.stats["willpower"] + self.stats["logic"] + self.stats["charm"]
        self.current_composure = self.max_composure
        
        # Capacities
        self.max_stamina = self.stats["might"] + self.stats["reflexes"] + self.stats["finesse"]
        self.max_focus = self.stats["knowledge"] + self.stats["awareness"] + self.stats["intuition"]
        
    def _init_battery(self):
        # Active Battery: All combatants initialize with 10 tokens
        self.active_stamina = 10
        self.active_focus = 10
        
    def get_reserve_pool(self) -> int:
        """Reserve pool is capacity minus gear tax."""
        tax = 0
        for slot, item in self.inventory.slots.items():
            if item:
                tax += item.loadout_cost
        return self.max_stamina - tax - self.trauma_tokens
        
    def get_stat(self, stat_name: str) -> int:
        base = self.stats.get(stat_name.lower(), 0)
        # Apply gear modifiers
        gear_mod = self.inventory.get_total_modifier(stat_name)
        return base + gear_mod
        
    def take_damage(self, amount: int):
        self.current_hp = max(0, self.current_hp - amount)
        
    def apply_action_cost(self, cost: dict):
        self.active_stamina -= cost.get("stamina", 0)
        self.active_focus -= cost.get("focus", 0)

    def consume(self, item: Item):
        """Applies a consumable item's effect and decrements quantity."""
        if not item.consumable_effect:
            return False
            
        if "heal" in item.consumable_effect:
            self.current_hp = min(self.max_hp, self.current_hp + item.consumable_effect["heal"])
        if "stamina" in item.consumable_effect:
            self.active_stamina = min(self.max_stamina, self.active_stamina + item.consumable_effect["stamina"])
        if "focus" in item.consumable_effect:
            self.active_focus = min(self.max_focus, self.active_focus + item.consumable_effect["focus"])
            
        item.quantity -= 1
        return True
        
    def add_xp(self, amount: int):
        self.xp += amount
        # Simple threshold for leveling up: 100 * current level
        if self.xp >= self.level * 100:
            self.xp -= self.level * 100
            self.level_up()
            
    def level_up(self):
        """Increases level, grants a skill point, and grants a stat point every other level."""
        self.level += 1
        self.unspent_skill_points += 1
        
        if self.level % 2 == 0:
            self.unspent_stat_points += 1
            
    def spend_stat_point(self, stat_name: str):
        if self.unspent_stat_points > 0:
            key = stat_name.lower()
            if key in self.stats:
                self.stats[key] += 1
                self.unspent_stat_points -= 1
                self._derive_pools() # Recalculate max HP/Capacities
                return True
        return False
        
    def unlock_skill(self, skill_name: str):
        if self.unspent_skill_points > 0 and skill_name not in self.skills:
            self.skills.append(skill_name)
            self.unspent_skill_points -= 1
            return True
        return False

    def to_dict(self):
        return {
            "name": self.name,
            "biological_origin": self.biological_origin,
            "base_stats": self.stats,
            "current_hp": self.current_hp,
            "current_composure": self.current_composure,
            "active_stamina": self.active_stamina,
            "active_focus": self.active_focus,
            "level": self.level,
            "xp": self.xp,
            "skills": self.skills,
            "unspent_stat_points": self.unspent_stat_points,
            "unspent_skill_points": self.unspent_skill_points,
            "trauma_tokens": self.trauma_tokens,
            "is_stabilized": self.is_stabilized,
            "has_disadvantage": self.has_disadvantage,
            "inventory": self.inventory.to_dict()
        }
        
    @classmethod
    def from_dict(cls, data):
        sheet = cls(data["name"], data["base_stats"], data.get("biological_origin", "Unknown"))
        sheet.current_hp = data["current_hp"]
        sheet.current_composure = data["current_composure"]
        sheet.active_stamina = data["active_stamina"]
        sheet.active_focus = data["active_focus"]
        sheet.level = data.get("level", 1)
        sheet.xp = data.get("xp", 0)
        sheet.skills = data.get("skills", [])
        sheet.unspent_stat_points = data.get("unspent_stat_points", 0)
        sheet.unspent_skill_points = data.get("unspent_skill_points", 0)
        sheet.trauma_tokens = data["trauma_tokens"]
        sheet.is_stabilized = data["is_stabilized"]
        sheet.has_disadvantage = data["has_disadvantage"]
        
        # Load Inventory
        if "inventory" in data:
            inv_data = data["inventory"]
            sheet.inventory.gold = inv_data.get("gold", 0)
            for slot_key, item_data in inv_data.get("slots", {}).items():
                if item_data:
                    item = Item(item_data["name"], item_data["item_type"], item_data["stat_type"], 
                                item_data["modifier"], item_data["loadout_cost"], item_data.get("quantity", 1),
                                item_data.get("consumable_effect", {}), item_data.get("tags", []))
                    sheet.inventory.equip(item, target_slot=slot_key)
                    
        return sheet
