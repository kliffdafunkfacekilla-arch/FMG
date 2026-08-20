import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_weather_endpoint():
    response = client.post(
        "/api/agents/weather",
        json={"temperature": 25.0, "precipitation": 80.0, "biome": "Tropical Rainforest"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "hot" in data["summary"]
    assert "wet" in data["summary"]
    assert "Tropical Rainforest" in data["summary"]

def test_demographics_endpoint():
    response = client.post(
        "/api/agents/demographics",
        json={"population": 15000, "culture": "Elvish", "state": "Sylvandor"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "large" in data["summary"]
    assert "15000" in data["summary"]
    assert "Elvish" in data["summary"]
    assert "Sylvandor" in data["summary"]

def test_master_dm_endpoint():
    response = client.post(
        "/api/agents/master_dm",
        json={
            "temperature": -5.0,
            "precipitation": 10.0,
            "biome": "Tundra",
            "population": 500,
            "culture": "Dwarven",
            "state": "Iron Peaks"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "master_summary" in data
    assert "weather_summary" in data
    assert "demographics_summary" in data
    
    # Check if the master summary aggregated correctly
    assert "Tundra" in data["master_summary"]
    assert "Dwarven" in data["master_summary"]
