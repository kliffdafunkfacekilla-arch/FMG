import { NestedLog, StorySeed, Paragon, MarkerType } from "../../state/store";

export type MemoryNodeType = "Event" | "PlotPoint" | "StoryHook" | "Marker" | "Actor";

export interface MemoryNode {
	id: string;
	type: MemoryNodeType;
	title: string;
	description: string;
	timestamp: string;
	weight: number; // 0 to 1 importance
	references: string[]; // IDs of paragons, burgs, states involved
}

export interface MemoryEdge {
	sourceId: string;
	targetId: string;
	relation: "Involves" | "CausedBy" | "LocatedAt" | "Threatens" | "Aids" | "LeadsTo";
}

export interface MemoryGraph {
	nodes: MemoryNode[];
	edges: MemoryEdge[];
}

export function createEmptyDAG(): MemoryGraph {
	return { nodes: [], edges: [] };
}

// Ingest a log into the DAG
export function ingestLogIntoDAG(dag: MemoryGraph, log: NestedLog, paragons: Paragon[]) {
	const nodeId = `log-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
	
	const newNode: MemoryNode = {
		id: nodeId,
		type: "Event",
		title: log.type.toUpperCase() + " Event",
		description: log.msg,
		timestamp: log.time,
		weight: log.importance || 0.1,
		references: []
	};

	dag.nodes.push(newNode);

	// Try to cross-link with known paragons if mentioned in the log
	for (const p of paragons) {
		if (log.msg.includes(p.name)) {
			newNode.references.push(p.id);
			dag.edges.push({
				sourceId: nodeId,
				targetId: p.id,
				relation: "Involves"
			});
		}
	}
}

// Ingest a StorySeed into the DAG
export function ingestStorySeedIntoDAG(dag: MemoryGraph, seed: StorySeed) {
	const nodeId = seed.id;
	
	// Check if already exists
	if (dag.nodes.some(n => n.id === nodeId)) return;

	const newNode: MemoryNode = {
		id: nodeId,
		type: "StoryHook",
		title: `Story Hook at Cell ${seed.cell}`,
		description: `Threat: ${seed.threatScore.toFixed(1)} | Opportunity: ${seed.opportunityScore.toFixed(1)}. Issues: ${seed.issues.join(", ")}`,
		timestamp: "Current",
		weight: 0.8,
		references: [...seed.actors, `cell-${seed.cell}`]
	};

	dag.nodes.push(newNode);

	for (const actorId of seed.actors) {
		dag.edges.push({
			sourceId: nodeId,
			targetId: actorId,
			relation: "Involves"
		});
	}
}

// Extract a summary of the DAG for the LLM
export function generateDAGSummary(dag: MemoryGraph): string {
	let output = "=== WORLD MEMORY DAG ===\n";
	
	const highWeightNodes = dag.nodes.filter(n => n.weight > 0.5).sort((a,b) => b.weight - a.weight).slice(0, 20);
	
	for (const node of highWeightNodes) {
		output += `[${node.type}] ${node.title} (${node.timestamp}): ${node.description}\n`;
		const connectedEdges = dag.edges.filter(e => e.sourceId === node.id || e.targetId === node.id);
		for (const edge of connectedEdges) {
			const otherId = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
			output += `  -> ${edge.relation}: ${otherId}\n`;
		}
	}
	return output;
}
