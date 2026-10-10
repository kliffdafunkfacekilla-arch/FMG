"""
OSTRAKA INTER-BURG TRADE CORRIDOR & CARAVAN LOGISTICS ENGINE
============================================================
Connects Burgs across trade networks to allow resource arbitrage, 
caravan logistics, tariff/toll collection, and supply/demand trade 
when local ecology cells run into shortages or surpluses.
"""

import json
import math
from typing import Dict, List, Any


class TradeCorridor:
    def __init__(self, corridor_id: int, origin_burg_id: int, dest_burg_id: int, distance_miles: float, transport_mode: str, hazard_rating: float = 0.1, toll_rate: float = 0.05):
        self.corridor_id = corridor_id
        self.origin_burg_id = origin_burg_id
        self.dest_burg_id = dest_burg_id
        self.distance_miles = distance_miles
        self.transport_mode = transport_mode  # "GROUND_CARAVAN", "RIVER_BARGE", "AETHER_SKIFF"
        self.hazard_rating = hazard_rating    # Risk of banditry, chaos flow, or weather delay
        self.toll_rate = toll_rate            # Toll percentage (e.g. Ivory Gate or Gilded Compass fee)

    def calculate_travel_ticks(self) -> int:
        speed_map = {
            "GROUND_CARAVAN": 15.0,  # miles per tick
            "RIVER_BARGE": 30.0,
            "AETHER_SKIFF": 60.0
        }
        speed = speed_map.get(self.transport_mode, 15.0)
        return max(1, math.ceil(self.distance_miles / speed))


class MerchantCaravan:
    def __init__(self, caravan_id: int, owner_faction: str, corridor: TradeCorridor, cargo_type: str, cargo_amount: float, buy_unit_price: float):
        self.caravan_id = caravan_id
        self.owner_faction = owner_faction
        self.corridor = corridor
        self.cargo_type = cargo_type          # "FOOD", "TIMBER", "ORE"
        self.cargo_amount = cargo_amount
        self.buy_unit_price = buy_unit_price
        
        self.ticks_remaining = corridor.calculate_travel_ticks()
        self.status = "IN_TRANSIT"            # "IN_TRANSIT", "DELIVERED", "RAIDED"

    def advance_tick(self) -> str:
        if self.status != "IN_TRANSIT":
            return self.status
            
        self.ticks_remaining -= 1
        if self.ticks_remaining <= 0:
            self.status = "DELIVERED"
        return self.status


class TradeNodeBurg:
    def __init__(self, burg_id: int, name: str, population: int, food_reserve: float, timber_reserve: float, ore_reserve: float, gold_treasury: float):
        self.burg_id = burg_id
        self.name = name
        self.population = population
        
        # Reserves
        self.reserves = {
            "FOOD": food_reserve,
            "TIMBER": timber_reserve,
            "ORE": ore_reserve
        }
        self.gold_treasury = gold_treasury
        
        # Local Prices (Calculated dynamically based on supply/demand)
        self.prices = {"FOOD": 1.0, "TIMBER": 1.5, "ORE": 3.0}
        self.update_market_prices()

    def update_market_prices(self):
        # Base demand per season
        food_demand = self.population * 0.002
        timber_demand = self.population * 0.0005
        ore_demand = self.population * 0.0002
        
        # Scarcity Multipliers
        self.prices["FOOD"] = round(1.0 * max(0.5, (food_demand * 10.0) / max(1.0, self.reserves["FOOD"])), 2)
        self.prices["TIMBER"] = round(1.5 * max(0.5, (timber_demand * 10.0) / max(1.0, self.reserves["TIMBER"])), 2)
        self.prices["ORE"] = round(3.0 * max(0.5, (ore_demand * 10.0) / max(1.0, self.reserves["ORE"])), 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "burg_id": self.burg_id,
            "name": self.name,
            "population": self.population,
            "treasury_gold": round(self.gold_treasury, 2),
            "reserves": {k: round(v, 2) for k, v in self.reserves.items()},
            "market_prices": self.prices
        }


class GlobalTradeNetworkEngine:
    def __init__(self):
        self.burgs: Dict[int, TradeNodeBurg] = {}
        self.corridors: List[TradeCorridor] = []
        self.active_caravans: List[MerchantCaravan] = []
        self.caravan_counter = 1

    def add_burg(self, burg: TradeNodeBurg):
        self.burgs[burg.burg_id] = burg

    def add_corridor(self, corridor: TradeCorridor):
        self.corridors.append(corridor)

    def process_trade_tick(self):
        # 1. Update Market Prices for all Burgs
        for burg in self.burgs.values():
            burg.update_market_prices()

        # 2. Identify Arbitrage Opportunities & Dispatch Caravans
        for corridor in self.corridors:
            origin = self.burgs.get(corridor.origin_burg_id)
            dest = self.burgs.get(corridor.dest_burg_id)
            if not origin or not dest:
                continue

            for cargo in ["FOOD", "TIMBER", "ORE"]:
                origin_price = origin.prices[cargo]
                dest_price = dest.prices[cargo]
                
                # If price spread is > 40% after tolls, dispatch caravan
                price_margin = (dest_price * (1.0 - corridor.toll_rate)) - origin_price
                if price_margin > 0.4 and origin.reserves[cargo] > 30.0 and origin.gold_treasury >= 100.0:
                    amount_to_buy = min(20.0, origin.reserves[cargo] * 0.25)
                    cost = amount_to_buy * origin_price
                    
                    origin.reserves[cargo] -= amount_to_buy
                    origin.gold_treasury -= cost
                    
                    caravan = MerchantCaravan(
                        caravan_id=self.caravan_counter,
                        owner_faction="Gilded Compass Merchant Fleet",
                        corridor=corridor,
                        cargo_type=cargo,
                        cargo_amount=amount_to_buy,
                        buy_unit_price=origin_price
                    )
                    self.active_caravans.append(caravan)
                    self.caravan_counter += 1

        # 3. Advance Caravans and Deliver Cargo
        surviving_caravans = []
        for c in self.active_caravans:
            status = c.advance_tick()
            if status == "DELIVERED":
                dest = self.burgs.get(c.corridor.dest_burg_id)
                if dest:
                    sale_price = dest.prices[c.cargo_type]
                    gross_revenue = c.cargo_amount * sale_price
                    net_profit = gross_revenue * (1.0 - c.corridor.toll_rate)
                    
                    dest.reserves[c.cargo_type] += c.cargo_amount
                    dest.gold_treasury -= gross_revenue
                    
                    origin = self.burgs.get(c.corridor.origin_burg_id)
                    if origin:
                        origin.gold_treasury += net_profit
            else:
                surviving_caravans.append(c)

        self.active_caravans = surviving_caravans


def run_trade_simulation():
    engine = GlobalTradeNetworkEngine()
    
    # Add 3 Connected Burgs
    b1 = TradeNodeBurg(1, "Excelsis High Burg", population=8000, food_reserve=250.0, timber_reserve=80.0, ore_reserve=20.0, gold_treasury=5000.0)
    b2 = TradeNodeBurg(2, "Forgespire Iron Citadel", population=5000, food_reserve=40.0, timber_reserve=120.0, ore_reserve=300.0, gold_treasury=4000.0)
    b3 = TradeNodeBurg(3, "Sump-Bog Trading Post", population=3000, food_reserve=150.0, timber_reserve=200.0, ore_reserve=50.0, gold_treasury=2000.0)
    
    engine.add_burg(b1)
    engine.add_burg(b2)
    engine.add_burg(b3)
    
    # Add Corridors
    engine.add_corridor(TradeCorridor(101, origin_burg_id=1, dest_burg_id=2, distance_miles=45.0, transport_mode="AETHER_SKIFF", hazard_rating=0.05, toll_rate=0.05))
    engine.add_corridor(TradeCorridor(102, origin_burg_id=2, dest_burg_id=1, distance_miles=45.0, transport_mode="AETHER_SKIFF", hazard_rating=0.05, toll_rate=0.05))
    engine.add_corridor(TradeCorridor(103, origin_burg_id=3, dest_burg_id=2, distance_miles=90.0, transport_mode="RIVER_BARGE", hazard_rating=0.10, toll_rate=0.08))
    
    print("==========================================================================")
    print("🚚 OSTRAKA INTER-BURG TRADE & CARAVAN LOGISTICS SIMULATION 🚚")
    print("==========================================================================")
    print("\nInitial Burg Market States:")
    for b in engine.burgs.values():
        print(json.dumps(b.to_dict(), indent=2))
        
    print("\n--- Running 6 Seasonal Trade Ticks ---")
    for tick in range(1, 7):
        engine.process_trade_tick()
        print(f"Tick {tick}: Active Caravans in transit = {len(engine.active_caravans)}")
        
    print("\nBurg Market States after 6 Trade Ticks:")
    for b in engine.burgs.values():
        print(json.dumps(b.to_dict(), indent=2))


if __name__ == "__main__":
    run_trade_simulation()
