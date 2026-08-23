import pytest
import json
from httpx import AsyncClient
from backend.main import app

@pytest.fixture(scope="module")
async def async_client():
    async with AsyncClient(app=app, base_url="http://testserver") as client:
        yield client

# Helper payload for story director
story_payload = {
    "player_id": "test_player",
    "state": {}
}

@pytest.mark.asyncio
async def test_story_director_returns_full_payload(async_client):
    response = await async_client.post("/api/story/director", json=story_payload)
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, dict)
    for key in ["player_data", "current_hex", "narrative_output", "tension"]:
        assert key in payload

@pytest.mark.asyncio
async def test_get_rule_metadata(async_client):
    response = await async_client.get("/api/brutal/rules/clash")
    assert response.status_code == 200
    data = response.json()
    assert data["rule"] == "clash"
    assert "description" in data

@pytest.mark.asyncio
async def test_run_rule_clash(async_client):
    payload = {
        "attacker": {"hp": 10, "strength": 5},
        "defender": {"hp": 8, "strength": 4}
    }
    response = await async_client.post("/api/brutal/rules/clash", json=payload)
    assert response.status_code == 200
    result = response.json()
    assert isinstance(result, dict)
    assert "outcome" in result or "damage" in result
