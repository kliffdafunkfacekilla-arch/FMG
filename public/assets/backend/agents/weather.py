from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/agents", tags=["agents"])

class WeatherRequest(BaseModel):
    temperature: float
    precipitation: float
    biome: str

class WeatherResponse(BaseModel):
    summary: str

@router.post("/weather", response_model=WeatherResponse)
async def analyze_weather_ecology(req: WeatherRequest):
    """
    Subagent for Weather/Ecology.
    Generates a summarized report of the ecology based on weather factors.
    """
    # Placeholder logic to mimic a specialized agent evaluating weather data
    temp_desc = "hot" if req.temperature > 20 else "cold" if req.temperature < 0 else "mild"
    prec_desc = "wet" if req.precipitation > 50 else "dry" if req.precipitation < 20 else "moderate"
    
    summary = (
        f"The region has a {temp_desc} and {prec_desc} climate, typical of a {req.biome} biome. "
        "Local flora and fauna have adapted to these specific conditions."
    )
    
    return WeatherResponse(summary=summary)
