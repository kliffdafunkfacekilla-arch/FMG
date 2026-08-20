from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/agents", tags=["agents"])

class WeatherRequest(BaseModel):
    temperature: float
    precipitation: float
    biome: str

class FloraFauna(BaseModel):
    name: str
    type: str
    adaptation: str

class WeatherResponse(BaseModel):
    summary: str
    temp_category: str
    prec_category: str
    hazards: List[str]
    ecology_sample: List[FloraFauna]

@router.post("/weather", response_model=WeatherResponse)
async def analyze_weather_ecology(req: WeatherRequest):
    """
    Subagent for Weather/Ecology.
    Generates a structured report of the ecology based on weather factors.
    """
    temp_desc = "Hot" if req.temperature > 20 else "Cold" if req.temperature < 0 else "Mild"
    prec_desc = "Wet" if req.precipitation > 50 else "Dry" if req.precipitation < 20 else "Moderate"
    
    hazards = []
    if req.temperature > 30 and req.precipitation < 10:
        hazards.append("Drought")
    elif req.precipitation > 80:
        hazards.append("Flooding")
        
    ecology_sample = [
        FloraFauna(
            name="Hardy Shrub",
            type="Flora",
            adaptation=f"Adapted to {temp_desc.lower()} temperatures."
        ),
        FloraFauna(
            name="Scavenger Fox",
            type="Fauna",
            adaptation=f"Thrives in {prec_desc.lower()} environments."
        )
    ]

    summary = f"A {temp_desc.lower()} and {prec_desc.lower()} region, forming a {req.biome} biome."
    
    return WeatherResponse(
        summary=summary,
        temp_category=temp_desc,
        prec_category=prec_desc,
        hazards=hazards,
        ecology_sample=ecology_sample
    )
