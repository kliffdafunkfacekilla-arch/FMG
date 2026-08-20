from fastapi import APIRouter
from pydantic import BaseModel
from .weather import analyze_weather_ecology, WeatherRequest
from .demographics import analyze_demographics, DemographicsRequest

router = APIRouter(prefix="/api/agents", tags=["agents"])

class MasterDMRequest(BaseModel):
    temperature: float
    precipitation: float
    biome: str
    population: int
    culture: str
    state: str

class MasterDMResponse(BaseModel):
    master_summary: str
    weather_summary: str
    demographics_summary: str

@router.post("/master_dm", response_model=MasterDMResponse)
async def master_dm_orchestrate(req: MasterDMRequest):
    """
    Master DM Agent Orchestrator.
    Delegates context gathering to subagents (Weather/Ecology and Town Demographics) 
    to compile a comprehensive summary without exhausting context windows.
    """
    # Calling subagents (in a true microservice setup this would be done via HTTP requests)
    
    weather_req = WeatherRequest(
        temperature=req.temperature, 
        precipitation=req.precipitation, 
        biome=req.biome
    )
    weather_resp = await analyze_weather_ecology(weather_req)
    
    demo_req = DemographicsRequest(
        population=req.population,
        culture=req.culture,
        state=req.state
    )
    demo_resp = await analyze_demographics(demo_req)
    
    master_summary = (
        "Master DM Overview:\n"
        f"- Ecology & Climate: {weather_resp.summary}\n"
        f"- Settlement & People: {demo_resp.summary}\n"
        "The DM can use this aggregated context to generate narrative events."
    )
    
    return MasterDMResponse(
        master_summary=master_summary,
        weather_summary=weather_resp.summary,
        demographics_summary=demo_resp.summary
    )
