from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/agents", tags=["agents"])

class DemographicsRequest(BaseModel):
    population: int
    culture: str
    state: str

class DemographicsResponse(BaseModel):
    summary: str

@router.post("/demographics", response_model=DemographicsResponse)
async def analyze_demographics(req: DemographicsRequest):
    """
    Subagent for Town Demographics.
    Generates a summarized report of the demographic distribution of a town.
    """
    # Placeholder logic to mimic a specialized agent evaluating demographics
    size_desc = "large" if req.population > 10000 else "small" if req.population < 1000 else "medium-sized"
    
    summary = (
        f"This is a {size_desc} settlement with a population of {req.population}. "
        f"The primary culture is {req.culture}, and it is governed by the state of {req.state}."
    )
    
    return DemographicsResponse(summary=summary)
