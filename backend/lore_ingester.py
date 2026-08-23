import os
import re
import chromadb

def parse_frontmatter(content: str):
    """Parses YAML-like frontmatter from markdown content."""
    frontmatter = {}
    body = content
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            fm_text = parts[1]
            body = parts[2].strip()
            for line in fm_text.split('\n'):
                line = line.strip()
                if ':' in line:
                    key, val = line.split(':', 1)
                    frontmatter[key.strip()] = val.strip()
    return frontmatter, body

def ingest_lore(chroma_client=None):
    if not chroma_client:
        chroma_client = chromadb.PersistentClient(path="./chroma_db")
    
    lore_collection = chroma_client.get_or_create_collection(name="saga_lore")
    
    lore_dir = os.path.join(os.path.dirname(__file__), "lore")
    
    if not os.path.exists(lore_dir):
        return {"success": False, "error": f"Lore directory {lore_dir} not found."}

    ids = []
    documents = []
    metadatas = []

    for root, _, files in os.walk(lore_dir):
        for file in files:
            if file.endswith('.md'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                metadata, body = parse_frontmatter(content)
                
                # Make sure ID is unique
                doc_id = f"lore_{metadata.get('category', 'misc')}_{file}"
                
                ids.append(doc_id)
                documents.append(body)
                
                # Metadata must be dict of str, int, float, or bool
                safe_meta = {
                    "title": metadata.get("title", file),
                    "category": metadata.get("category", "misc"),
                    "source_file": file
                }
                metadatas.append(safe_meta)

    if ids:
        # We can upsert all at once
        lore_collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )

    return {"success": True, "ingested": len(ids)}

if __name__ == "__main__":
    result = ingest_lore()
    print(f"Ingested {result.get('ingested', 0)} lore files.")
