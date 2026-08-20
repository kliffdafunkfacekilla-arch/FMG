from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict

router = APIRouter(prefix="/api/agents", tags=["agents"])

class DemographicsRequest(BaseModel):
    population: int
    culture: str
    state: str

class SocialClass(BaseModel):
    name: str
    percentage: float
    description: str

class DemographicsResponse(BaseModel):
    summary: str
    size_category: str
    social_classes: Dict[str, SocialClass]
    primary_industry: str

@router.post("/demographics", response_model=DemographicsResponse)
async def analyze_demographics(req: DemographicsRequest):
    """
    Subagent for Town Demographics.
    Generates a structured report of the demographic distribution of a town.
    """
    size_desc = "Large City" if req.population > 10000 else "Village" if req.population < 1000 else "Town"
    
    # Robust distribution rather than a string placeholder
    social_classes = {
        "nobility": SocialClass(
            name="Nobility",
            percentage=1.5,
            description=f"The ruling elite loyal to {req.state}."
        ),
        "merchants": SocialClass(
            name="Merchants",
            percentage=15.0,
            description="The middle class handling trade and commerce."
        ),
        "commoners": SocialClass(
            name="Commoners",
            percentage=83.5,
            description=f"The working class, mostly adhering to {req.culture} traditions."
        )
    }

    primary_industry = "Agriculture" if req.population < 5000 else "Trade and Crafting"

    summary = (
        f"A {size_desc.lower()} of {req.population} people. "
        f"Dominant culture: {req.culture}. Governed by {req.state}."
    )
    
    return DemographicsResponse(
        summary=summary,
        size_category=size_desc,
        social_classes=social_classes,
        primary_industry=primary_industry
    )
