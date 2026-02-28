"""Test suite for member API endpoints."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from uuid import uuid4

client = TestClient(app)


class TestMemberEndpoints:
    """Test member CRUD operations."""

    def test_create_member(self):
        """Test creating a new member."""
        response = client.post(
            "/members/",
            json={"name": "John Doe"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "John Doe"

    def test_get_member(self):
        """Test retrieving a member."""
        # Create a member first
        create_response = client.post(
            "/members/",
            json={"name": "Jane Doe"}
        )
        member_id = create_response.json()["id"]
        
        # Retrieve the member
        response = client.get(f"/members/{member_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Jane Doe"

    def test_list_members(self):
        """Test listing all members."""
        response = client.get("/members/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_update_member(self):
        """Test updating a member."""
        # Create a member first
        create_response = client.post(
            "/members/",
            json={"name": "Original Name"}
        )
        member_id = create_response.json()["id"]
        
        # Update the member
        response = client.put(
            f"/members/{member_id}",
            json={"name": "Updated Name"}
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_delete_member(self):
        """Test deleting a member."""
        # Create a member first
        create_response = client.post(
            "/members/",
            json={"name": "Delete Me"}
        )
        member_id = create_response.json()["id"]
        
        # Delete the member
        response = client.delete(f"/members/{member_id}")
        assert response.status_code == 200
        
        # Verify deletion
        get_response = client.get(f"/members/{member_id}")
        assert get_response.status_code == 404
