const fs = require('fs');
let code = fs.readFileSync('src/observer/Dashboard.tsx', 'utf8');

// Update FactionPanel signature and usage of state.cells
code = code.replace("function FactionPanel({ state, economy }: { state: ObserverState, economy: any[] }) {", 
                    "function FactionPanel({ state, economy, cells }: { state: ObserverState, economy: any[], cells: any[] }) {");
code = code.replace("const myBurgs = economy.filter(b => state.cells.find(c => c.id === b.cell_id)?.faction_id === f.id);",
                    "const myBurgs = economy.filter(b => cells.find(c => c.id === b.cell_id)?.faction_id === f.id);");

// Update RightPanel signature and usage of state.cells
code = code.replace("function RightPanel({ state, economyMap, factionMap, selectedCell }: { state: ObserverState, economyMap: any, factionMap: any, selectedCell: number | null }) {",
                    "function RightPanel({ state, economyMap, factionMap, selectedCell, cells }: { state: ObserverState, economyMap: any, factionMap: any, selectedCell: number | null, cells: any[] }) {");
code = code.replace("cell = state.cells.find(c => c.id === selectedCell);",
                    "cell = cells.find(c => c.id === selectedCell);");

// Update component invocations
code = code.replace("<FactionPanel state={state} economy={state.economy || []} />",
                    "<FactionPanel state={state} economy={state.economy || []} cells={cells} />");
code = code.replace("<RightPanel state={state} economyMap={economyMap} factionMap={factionMap} selectedCell={selectedCell} />",
                    "<RightPanel state={state} economyMap={economyMap} factionMap={factionMap} selectedCell={selectedCell} cells={cells} />");

fs.writeFileSync('src/observer/Dashboard.tsx', code);
console.log("Dashboard UI fixed");
