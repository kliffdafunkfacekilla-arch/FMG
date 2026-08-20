from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
from typing import List, Dict, Any, Optional

from combat import resolve_action
from models import ActionRequest, ActionResponse
from vault_ingester import ingest_vault
from guide_orchestrator import get_next_suggestion

app = FastAPI(title="SAGA AI Director Backend")

# Enable CORS for FMG frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ChromaDB Local Client
chroma_client = chromadb.PersistentClient(path="./chroma_db")

# Create Collections
events_collection = chroma_client.get_or_create_collection(name="saga_events")
paragons_collection = chroma_client.get_or_create_collection(name="saga_paragons")
hooks_collection = chroma_client.get_or_create_collection(name="saga_hooks")

# Pydantic Models
class MemoryNode(BaseModel):
    id: str
    type: str
    title: str
    description: str
    timestamp: str

class MemoryNodesPayload(BaseModel):
    nodes: List[MemoryNode]

class Paragon(BaseModel):
    id: str
    name: str
    affiliationType: str
    affiliationId: int
    role: str
    stats: Dict[str, int]
    positiveTrait: str
    neutralTraits: List[str]
    negativeTrait: str

class ParagonsPayload(BaseModel):
    paragons: List[Paragon]

class StoryHook(BaseModel):
    id: str
    cell: int
    threatScore: int
    opportunityScore: int
    issues: List[str]
    actors: List[str]
    openness: str

class StoryHooksPayload(BaseModel):
    hooks: List[StoryHook]

class WorldStatePayload(BaseModel):
    world_state: Dict[str, Any]

class VaultImportOptions(BaseModel):
    build_states: bool = True
    build_cultures: bool = True
    build_religions: bool = True
    build_paragons: bool = True
    missing_data: str = "autofill"

class VaultImportPayload(BaseModel):
    vault_path: str
    options: VaultImportOptions = VaultImportOptions()

# Routes
@app.post("/api/memory/nodes")
def ingest_memory_nodes(payload: MemoryNodesPayload):
    if not payload.nodes:
        return {"success": True, "ingested": 0}
    
    ids = []
    documents = []
    metadatas = []
    
    for node in payload.nodes:
        ids.append(node.id)
        # The document is what Chroma searches against
        documents.append(f"{node.title}\n{node.description}")
        metadatas.append({
            "type": node.type,
            "timestamp": node.timestamp
        })
        
    events_collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )
    return {"success": True, "ingested": len(payload.nodes)}

@app.post("/api/paragons")
def ingest_paragons(payload: ParagonsPayload):
    if not payload.paragons:
        return {"success": True, "ingested": 0}
        
    ids = []
    documents = []
    metadatas = []
    
    for p in payload.paragons:
        ids.append(p.id)
        documents.append(f"{p.name}, {p.role}. Traits: {p.positiveTrait}, {p.negativeTrait}")
        metadatas.append({
            "affiliationType": p.affiliationType,
            "affiliationId": p.affiliationId,
            "role": p.role
        })
        
    paragons_collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )
    return {"success": True, "ingested": len(payload.paragons)}

@app.post("/api/story-hooks")
def ingest_story_hooks(payload: StoryHooksPayload):
    if not payload.hooks:
        return {"success": True, "ingested": 0}
        
    ids = []
    documents = []
    metadatas = []
    
    for h in payload.hooks:
        ids.append(h.id)
        doc = f"Issues: {', '.join(h.issues)}. Actors: {', '.join(h.actors)}"
        documents.append(doc)
        metadatas.append({
            "cell": h.cell,
            "threatScore": h.threatScore,
            "opportunityScore": h.opportunityScore,
            "openness": h.openness
        })
        
    hooks_collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )
    return {"success": True, "ingested": len(payload.hooks)}

@app.get("/api/search/events")
def search_events(query: str, n_results: int = 5):
    results = events_collection.query(
        query_texts=[query],
        n_results=n_results
    )
    return {"results": results}

@app.post("/api/action/resolve", response_model=ActionResponse)
def resolve_action_endpoint(req: ActionRequest):
    """
    Resolve a 1d20 action based on the Margin of Success rules.
    """
    return resolve_action(req)

@app.post("/api/vault/import")
def import_vault_endpoint(payload: VaultImportPayload):
    """
    Reads a vault of notes and ingests them into ChromaDB.
    """
    return ingest_vault(payload.vault_path, payload.options.model_dump())

@app.post("/api/guide/suggest")
def guide_suggest_endpoint(payload: WorldStatePayload):
    """
    Analyzes world state and returns a suggestion for the next building step.
    """
    suggestion = get_next_suggestion(payload.world_state)
    return suggestion.model_dump()

