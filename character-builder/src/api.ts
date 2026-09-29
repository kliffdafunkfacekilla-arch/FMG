const API_BASE = "http://localhost:8000/api";

export async function generateStorySeeds(location: string, worldContext: any) {
  const res = await fetch(`${API_BASE}/story/seeds/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location, world_context: worldContext })
  });
  if (!res.ok) throw new Error("Failed to generate seeds");
  return res.json();
}

export async function generateQuestFromSeed(seedText: string) {
  const res = await fetch(`${API_BASE}/story/quests/generate_from_seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seed_text: seedText })
  });
  if (!res.ok) throw new Error("Failed to generate quest");
  return res.json();
}

export async function talkToNpc(npcId: string, playerName: string, playerInput: string, worldContext: any, storyContext: string = "") {
  const res = await fetch(`${API_BASE}/npc/talk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      npc_id: npcId,
      player_name: playerName,
      player_input: playerInput,
      world_context: worldContext,
      story_context: storyContext
    })
  });
  if (!res.ok) throw new Error("Failed to talk to NPC");
  return res.json();
}

export async function syncSimulation() {
  const res = await fetch(`${API_BASE}/simulation/sync`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to sync simulation");
  return res.json();
}

export async function getStoryState() {
  const res = await fetch(`${API_BASE}/story/state`);
  if (!res.ok) throw new Error("Failed to get story state");
  return res.json();
}

export async function getMesoGrid(macroId: string, seed: number = 42) {
  const res = await fetch(`${API_BASE}/world/grid/meso/${macroId}?seed=${seed}`);
  if (!res.ok) throw new Error("Failed to get meso grid");
  return res.json();
}

export async function getMicroGrid(macroId: string, mesoX: number, mesoY: number, seed: number = 42) {
  const res = await fetch(`${API_BASE}/world/grid/micro/${macroId}/${mesoX}/${mesoY}?seed=${seed}`);
  if (!res.ok) throw new Error("Failed to get micro grid");
  return res.json();
}
