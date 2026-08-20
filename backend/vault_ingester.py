import os
import uuid
import chromadb
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from PIL import Image

# Re-use the existing Chroma client logic from main.py if possible,
# but for a standalone script, we can initialize it here.
chroma_client = chromadb.PersistentClient(path="./chroma_db")
events_collection = chroma_client.get_or_create_collection(name="saga_events")
paragons_collection = chroma_client.get_or_create_collection(name="saga_paragons")
hooks_collection = chroma_client.get_or_create_collection(name="saga_hooks")

class VaultState(BaseModel):
    name: str
    color: str
    capital: str

class VaultCulture(BaseModel):
    name: str
    color: str

class VaultReligion(BaseModel):
    name: str
    color: str
    type: str

class VaultBurg(BaseModel):
    name: str
    size: int
    capital: bool
    x: int
    y: int

class VaultWorldPayload(BaseModel):
    success: bool
    error: Optional[str] = None
    heightmap: Optional[List[float]] = None
    heightmap_width: Optional[int] = None
    heightmap_height: Optional[int] = None
    states: List[VaultState] = []
    cultures: List[VaultCulture] = []
    religions: List[VaultReligion] = []
    events_ingested: int = 0
    paragons_ingested: int = 0
    political_map: Optional[List[str]] = None
    burgs: List[VaultBurg] = []

def process_map_image(image_path: str, target_width: int = 800, target_height: int = 600) -> tuple[List[float], int, int]:
    """
    Reads map.png or map.jpg, converts to grayscale, and returns a 1D float array of heights (0.0 - 1.0)
    """
    try:
        with Image.open(image_path) as img:
            img = img.convert('L')
            img = img.resize((target_width, target_height), Image.Resampling.BILINEAR)
            pixel_data = list(img.getdata())
            # Normalize to 0-1
            heightmap = [float(p) / 255.0 for p in pixel_data]
            return heightmap, target_width, target_height
    except Exception as e:
        print(f"Error processing image {image_path}: {e}")
        return [], 0, 0

def process_political_map(image_path: str, legend_path: str, target_width: int = 800, target_height: int = 600) -> tuple[List[str], List[VaultBurg]]:
    color_to_state = {}
    number_to_burg = {}
    
    if os.path.exists(legend_path):
        with open(legend_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line: continue
                if line.startswith("#"):
                    parts = line.split(" ", 1)
                    if len(parts) == 2:
                        color_to_state[parts[0].upper()] = parts[1]
                elif line[0].isdigit():
                    parts = line.split(" ", 1)
                    if len(parts) == 2:
                        burg_info = parts[1].split(",")
                        if len(burg_info) >= 3:
                            name = burg_info[0].strip()
                            size = int(burg_info[1].strip())
                            capital = burg_info[2].strip().lower() == 'y'
                            number_to_burg[parts[0]] = VaultBurg(name=name, size=size, capital=capital, x=0, y=0)
                            
    political_map = [""] * (target_width * target_height)
    burgs = []
    
    try:
        with Image.open(image_path) as img:
            img = img.convert('RGB')
            img = img.resize((target_width, target_height), Image.Resampling.NEAREST)
            pixel_data = list(img.getdata())
            
            for i, p in enumerate(pixel_data):
                hex_color = "#{:02X}{:02X}{:02X}".format(p[0], p[1], p[2])
                if hex_color in color_to_state:
                    political_map[i] = color_to_state[hex_color]
                # In a real app we would use OCR or a distinct pixel marker for burg numbers, 
                # for now we return the parsed definitions to the frontend.
    except Exception as e:
        print(f"Error processing political map: {e}")
        
    for k, v in number_to_burg.items():
        burgs.append(v)
        
    return political_map, burgs

def mock_llm_parse_entity(filename: str, content: str, folder_context: str, payload: VaultWorldPayload) -> None:
    """
    Mock LLM function that fakes extracting structured entities from raw notes and populates the payload.
    """
    title = filename.replace(".md", "").replace(".txt", "")
    
    # Very basic mock logic based on folder context
    if folder_context.lower() == "states" or "state" in filename.lower():
        payload.states.append(VaultState(name=title, color="#aa3333", capital=f"City of {title}"))
    elif folder_context.lower() == "cultures" or "culture" in filename.lower():
        payload.cultures.append(VaultCulture(name=title, color="#33aa33"))
    elif folder_context.lower() == "religions" or "religion" in filename.lower():
        payload.religions.append(VaultReligion(name=title, color="#3333aa", type="Folk"))
    elif folder_context.lower() == "paragons" or "character" in filename.lower():
        doc_id = str(uuid.uuid4())
        paragons_collection.upsert(
            ids=[doc_id],
            documents=[f"{title}\n{content[:200]}"],
            metadatas=[{"role": "Leader"}]
        )
        payload.paragons_ingested += 1
    else:
        doc_id = str(uuid.uuid4())
        events_collection.upsert(
            ids=[doc_id],
            documents=[f"{title}\n{content[:200]}"],
            metadatas=[{"layer": folder_context}]
        )
        payload.events_ingested += 1

def ingest_vault(vault_path: str, options: dict = None) -> dict:
    if not options: options = {}
    
    if not os.path.isdir(vault_path):
        return VaultWorldPayload(success=False, error=f"Directory not found: {vault_path}").model_dump()
        
    payload = VaultWorldPayload(success=True)
    
    # Process Map Image if it exists in root
    map_png = os.path.join(vault_path, "map.png")
    map_jpg = os.path.join(vault_path, "map.jpg")
    
    if os.path.exists(map_png):
        h, w, hi = process_map_image(map_png)
        payload.heightmap = h
        payload.heightmap_width = w
        payload.heightmap_height = hi
    elif os.path.exists(map_jpg):
        h, w, hi = process_map_image(map_jpg)
        payload.heightmap = h
        payload.heightmap_width = w
        payload.heightmap_height = hi
        
    pol_png = os.path.join(vault_path, "political.png")
    pol_txt = os.path.join(vault_path, "political.txt")
    if os.path.exists(pol_png) and os.path.exists(pol_txt):
        pmap, burgs = process_political_map(pol_png, pol_txt)
        payload.political_map = pmap
        payload.burgs = burgs
    
    for root, dirs, files in os.walk(vault_path):
        folder_name = os.path.basename(root)
        
        for file in files:
            if file.endswith(".md") or file.endswith(".txt"):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    mock_llm_parse_entity(file, content, folder_name, payload)
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")
                    
    return payload.model_dump()
