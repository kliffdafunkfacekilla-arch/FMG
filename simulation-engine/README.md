# Aetheria Simulation Engine
Welcome to the Aetheria Simulation Engine. This project simulates an extremely complex, interconnected 8-layer reality, processing economics, geopolitics, weather, demographics, and anomalous events across 266 burgs and a 10,000-cell hexagonal map.

## Architecture: The 9-Step Pipeline
The engine executes a rigid turn-based system defined in `src/engine/masterOrchestrator.ts`. Every execution of `/api/observer/tick` runs this exact sequence:

1. **Calendar Agent** (`calendarAgent.ts`): Advances time, determining years, 16-month calendar cycles, and the 5 phases of the Broken Moon (Cruorbus).
2. **Weather Agent** (`weatherAgent.ts`): Generates anomalous weather fronts (blizzards, droughts) and manages the Lunar Chaos Loop (Void Drain, Chaos Flow).
3. **Burg Operations** (`burgOperationsAgent.ts`): Calculates the 10:1 population-to-worker ratio, generating raw materials, food, and complex industrial stockpiles for all 266 burgs.
4. **Local Paragon AI** (`paragonPlanningAgent.ts`): Executes the Base-12 trait multiplier AI for local burg leaders. Calculates crisis scores (Survival, Protection, Pleasure) and modifies the raw output of Burg Operations (e.g. enacting martial law to prevent starvation).
5. **Faction Planning** (`factionPlanningAgent.ts`): The State and Underworld Macro-Layer. 
   - **Intel Filter:** Counselors skew objective data based on their traits.
   - **Economy:** Factions collect gross income and pay upkeep for their standing armies (Infantry, Ranged, Mounted, Airships, Mages).
   - **Ruler Priorities:** Rulers issue 1 Civil, 1 Security, and 1 Social action per tick based on their Faction's perceived economy and defense stats.
6. **Warden Agent** (`wardenAgent.ts`): Spawns Wardens from the Sparkborn population to hunt anomalies and Cultists.
7. **Cultist Agent** (`cultistAgent.ts`): Spawns Cultists from high-unrest populations to disrupt the 12 Seals.
8. **Encounter Agent** (`encounterAgent.ts`): Moves beasts, outlaws, and localized anomalies across the map.
9. **Chronicler Agent** (`chroniclerAgent.ts`): Logs major events and outputs the final tick state.

## Military & Factions
*   **Army Formula:** Burgs generate military based on size `S` ($S$ Infantry, $S-1$ Ranged, $S-2$ Mounted, $S-3$ Airships).
*   **Combat State:** Unit effectiveness is driven by tactical posture (Moving, Stationary, Attacking, Defending) and Terrain (Urban, High Ground).
*   **Underworld (The 5 Fringes):** The Gilded Compass, Sky Barons, Ghostwind Raiders, Ivory Fleet, and Syndicate operate independent Cartel networks led by 60 autonomous Underworld Bosses.

## Directory Structure
*   `src/engine/agents/` - Contains the 9 discrete step logic controllers.
*   `src/engine/masterOrchestrator.ts` - The transaction wrapper that runs the pipeline.
*   `src/api/` - The Express routers serving the UI.
*   `src/db/` - Database connection and schema migration logic.
*   `_archive/legacy_scripts/` - All the obsolete v1.0 and temporary scaffolding scripts.
