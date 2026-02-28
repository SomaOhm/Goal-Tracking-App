"""Test suite for mentor API endpoints."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from uuid import uuid4

client = TestClient(app)


class TestMentorEndpoints:
    """Test mentor operations."""

    def test_assign_mentor(self):
        """Test assigning a mentor to a user."""
        # Create a mentor
        mentor_response = client.post(
            "/members/",
            json={"name": "Dr. Smith"}
        )
        mentor_id = mentor_response.json()["id"]
        
        # Create a mentee
        mentee_response = client.post(
            "/members/",
            json={"name": "Student One"}
        )
        mentee_id = mentee_response.json()["id"]
        
        # Assign mentor
        response = client.post(
            f"/mentors/{mentee_id}/assign",
            json={"mentor_id": mentor_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mentor_id"] == mentor_id

    def test_get_mentor_patients(self):
        """Test retrieving patients for a mentor."""
        response = client.get(f"/mentors/{uuid4()}/patients")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_mentee_goals(self):
        """Test retrieving goals for a mentee."""
        response = client.get(f"/mentors/{uuid4()}/goals")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
